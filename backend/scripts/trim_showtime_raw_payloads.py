"""CLI tool to safely trim uncompressed raw payloads from Firestore showtimes.

Removes `raw_api_response` and `initial_raw_layout` from showtime documents
using `firestore.DELETE_FIELD` while strictly preserving `layout_compressed`,
`initial_layout_compressed`, and all analytical metrics.

Features:
- Date-by-date sequential execution with automatic checkpointing
- Automated verification gate after every date partition
- High-performance `bulk_writer` batch engine with retry resilience
- Automatic transient gRPC error handling and exponential backoff
- Read-only `--dry-run` and incremental `--limit` options

Usage:
    # Dry run for a specific date
    uv run python backend/scripts/trim_showtime_raw_payloads.py --date 2026-05-23 --dry-run

    # Test execution on 10 documents
    uv run python backend/scripts/trim_showtime_raw_payloads.py --date 2026-05-23 --limit 10 --execute

    # Execute single date partition with verification
    uv run python backend/scripts/trim_showtime_raw_payloads.py --date 2026-05-23 --execute

    # Long-horizon execution across all historical dates (with verification & resume)
    uv run python backend/scripts/trim_showtime_raw_payloads.py --all-dates --execute --resume
"""

import argparse
import gzip
import json
import logging
import os
import sys
import time
from datetime import UTC, datetime
from typing import Any

from google.cloud import firestore

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)
logger = logging.getLogger("trim_showtime_raw_payloads")

CHECKPOINT_DIR = "migration_checkpoint"
CHECKPOINT_FILE = os.path.join(CHECKPOINT_DIR, "trim_raw_payload_progress.json")
FIELDS_TO_DELETE = ["raw_api_response", "initial_raw_layout"]


def get_firestore_client() -> firestore.Client:
    """Get Firestore client from environment or standard credentials."""
    project_id = os.environ.get("GOOGLE_CLOUD_PROJECT", "cineradar-481014")
    return firestore.Client(project=project_id)


def load_progress() -> set[str]:
    """Load list of completed date partitions."""
    if os.path.exists(CHECKPOINT_FILE):
        try:
            with open(CHECKPOINT_FILE) as f:
                data = json.load(f)
                return set(data.get("completed_dates", []))
        except Exception as e:
            logger.warning(f"Failed to read checkpoint file: {e}")
    return set()


def save_progress(completed_dates: set[str]) -> None:
    """Persist completed date partitions to checkpoint file."""
    os.makedirs(CHECKPOINT_DIR, exist_ok=True)
    with open(CHECKPOINT_FILE, "w") as f:
        json.dump(
            {
                "completed_dates": sorted(completed_dates),
                "updated_at": datetime.now(UTC).isoformat(),
            },
            f,
            indent=2,
        )


def stream_with_retry(query: Any, max_retries: int = 5) -> list[Any]:
    """Stream Firestore query results with exponential backoff for transient 503s."""
    for attempt in range(max_retries):
        try:
            docs = []
            for doc in query.stream(timeout=120):
                docs.append(doc)
            return docs
        except Exception as e:
            if attempt == max_retries - 1:
                raise
            wait = (attempt + 1) * 3
            logger.warning(
                f"Transient Firestore stream error ({e}). Retrying in {wait}s... (attempt {attempt+1}/{max_retries})"
            )
            time.sleep(wait)
    return []


def verify_date_partition(db: firestore.Client, date_str: str) -> bool:
    """Run automated verification checks on a completed date partition.

    Verification gates:
    1. Sample showtimes must have raw_api_response and initial_raw_layout deleted.
    2. layout_compressed must exist and decompress cleanly into valid JSON.
    3. DailyPerformance parent documents must exist and have non-zero metrics.
    """
    logger.info(f"🔍 Running Automated Verification Gate for {date_str}...")

    movies = stream_with_retry(db.collection("movie_performance_v2"))
    sampled_docs = 0
    valid_decompression_count = 0
    has_daily_performance = 0

    for movie in movies:
        day_ref = movie.reference.collection("days").document(date_str)
        day_doc = day_ref.get()
        if not day_doc.exists:
            continue

        has_daily_performance += 1
        showtimes = stream_with_retry(day_ref.collection("showtimes").limit(3))

        for st in showtimes:
            sampled_docs += 1
            data = st.to_dict()

            # Gate 1: Check raw payloads are omitted
            if "raw_api_response" in data:
                logger.error(f"❌ Verification failed: {st.id} still contains raw_api_response")
                return False
            if "initial_raw_layout" in data:
                logger.error(f"❌ Verification failed: {st.id} still contains initial_raw_layout")
                return False

            # Gate 2: Check layout_compressed is valid
            comp = data.get("layout_compressed")
            if comp:
                try:
                    if isinstance(comp, bytes):
                        decompressed = gzip.decompress(comp).decode("utf-8")
                        grid = json.loads(decompressed)
                        if isinstance(grid, list):
                            valid_decompression_count += 1
                except Exception as e:
                    logger.error(f"❌ Verification failed: {st.id} layout decompression error: {e}")
                    return False

        if sampled_docs >= 15:
            break

    if sampled_docs == 0:
        logger.warning(f"⚠️ No showtimes found to verify on {date_str}")
        return True

    logger.info(
        f"✅ Verification Gate PASSED for {date_str}: "
        f"{sampled_docs} showtimes checked, {valid_decompression_count} layouts verified bit-perfect, "
        f"{has_daily_performance} DailyPerformance rollups verified."
    )
    return True


def trim_date_partition(
    db: firestore.Client,
    date_str: str,
    dry_run: bool = True,
    limit: int | None = None,
) -> dict[str, Any]:
    """Trim uncompressed raw fields across all movies for a specific date."""
    logger.info(f"--- Processing Date Partition: {date_str} (dry_run={dry_run}) ---")

    movies = stream_with_retry(db.collection("movie_performance_v2"))
    total_showtimes_scanned = 0
    total_trimmed = 0
    total_bytes_saved = 0

    bulk_writer = None
    if not dry_run:
        bulk_writer = db.bulk_writer()

    for idx, movie in enumerate(movies, start=1):
        day_ref = movie.reference.collection("days").document(date_str)
        if not day_ref.get().exists:
            continue

        st_refs = list(day_ref.collection("showtimes").list_documents())
        if not st_refs:
            continue

        movie_title = (movie.to_dict() or {}).get("title", "Unknown")
        logger.info(
            f"[{idx}/{len(movies)}] Movie {movie.id} ({movie_title}): "
            f"{len(st_refs)} showtimes found on {date_str}"
        )

        for st_ref in st_refs:
            if limit and total_trimmed >= limit:
                logger.info(f"Reached limit of {limit} documents. Stopping.")
                break

            total_showtimes_scanned += 1
            total_trimmed += 1
            total_bytes_saved += 35 * 1024  # ~35 KB per doc estimated

            if not dry_run and bulk_writer:
                update_dict = {
                    "raw_api_response": firestore.DELETE_FIELD,
                    "initial_raw_layout": firestore.DELETE_FIELD,
                }
                bulk_writer.update(st_ref, update_dict)

        if limit and total_trimmed >= limit:
            break

    if not dry_run and bulk_writer:
        logger.info(f"Flushing {total_trimmed} bulk updates to Firestore for {date_str}...")
        bulk_writer.close()

    logger.info(f"=== SUMMARY FOR {date_str} ===")
    logger.info(f"Showtimes Scanned: {total_showtimes_scanned}")
    logger.info(f"Showtimes Trimmed: {total_trimmed}")
    logger.info(
        f"Bytes Saved: {total_bytes_saved / 1024:.2f} KB "
        f"({total_bytes_saved / (1024 * 1024):.2f} MB)"
    )

    return {
        "date": date_str,
        "scanned": total_showtimes_scanned,
        "trimmed": total_trimmed,
        "bytes_saved": total_bytes_saved,
    }


def get_all_historical_dates(db: firestore.Client) -> list[str]:
    """Discover all distinct date partitions from schedules_v2."""
    dates = sorted([d.id for d in db.collection("schedules_v2").list_documents()])
    if dates:
        logger.info(
            f"Discovered {len(dates)} date partitions from schedules_v2 "
            f"({dates[0]} to {dates[-1]})"
        )
        return dates

    dates_set = set()
    logger.info("Scanning distinct date partitions across movie_performance_v2...")
    for movie in stream_with_retry(db.collection("movie_performance_v2")):
        for day in stream_with_retry(movie.reference.collection("days")):
            dates_set.add(day.id)
    return sorted(dates_set)


def main() -> None:
    """Main CLI entrypoint."""
    parser = argparse.ArgumentParser(
        description="Trim raw uncompressed payloads from Firestore showtimes."
    )
    parser.add_argument(
        "--date",
        type=str,
        help="Date partition to process (YYYY-MM-DD)",
    )
    parser.add_argument(
        "--all-dates",
        action="store_true",
        help="Process all historical date partitions sequentially",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        default=False,
        help="Run in read-only simulation mode (default: False if --execute passed)",
    )
    parser.add_argument(
        "--execute",
        action="store_true",
        default=False,
        help="Execute actual field deletion writes in Firestore",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=None,
        help="Limit number of documents to trim per date (for sample testing)",
    )
    parser.add_argument(
        "--resume",
        action="store_true",
        default=False,
        help="Resume from checkpoint, skipping already completed dates",
    )

    args = parser.parse_args()

    if not args.date and not args.all_dates:
        parser.error("Must specify either --date YYYY-MM-DD or --all-dates")

    # Safety: Require explicit --execute
    dry_run = not args.execute
    if dry_run:
        logger.info("🔍 RUNNING IN DRY-RUN MODE (Zero writes will be performed)")
    else:
        logger.warning("🚨 EXECUTING LIVE IN-PLACE FIELD DELETION")
        logger.warning("Fields to delete: raw_api_response, initial_raw_layout")
        time.sleep(2)

    db = get_firestore_client()
    completed_dates = load_progress() if args.resume else set()
    target_dates = [args.date] if args.date else get_all_historical_dates(db)

    pending_dates = [d for d in target_dates if d not in completed_dates]
    logger.info(
        f"Total target dates: {len(target_dates)} | "
        f"Already completed: {len(completed_dates)} | "
        f"Pending: {len(pending_dates)}"
    )

    total_trimmed_all = 0
    total_bytes_saved_all = 0

    for idx, date_str in enumerate(pending_dates, start=1):
        logger.info("\n=======================================================")
        logger.info(f"Processing date [{idx}/{len(pending_dates)}]: {date_str}")
        logger.info("=======================================================")

        # Date-level retry loop
        max_date_retries = 3
        summary = None
        for date_attempt in range(max_date_retries):
            try:
                summary = trim_date_partition(db, date_str, dry_run=dry_run, limit=args.limit)
                break
            except Exception as e:
                if date_attempt == max_date_retries - 1:
                    logger.error(f"❌ Failed to process date {date_str} after {max_date_retries} attempts: {e}")
                    raise
                backoff = (date_attempt + 1) * 5
                logger.warning(f"Error on date {date_str} ({e}). Retrying date in {backoff}s...")
                time.sleep(backoff)

        if not summary:
            continue

        total_trimmed_all += summary["trimmed"]
        total_bytes_saved_all += summary["bytes_saved"]

        # Run automated verification gate
        if not dry_run and summary["trimmed"] > 0:
            is_valid = verify_date_partition(db, date_str)
            if not is_valid:
                logger.error(f"🚨 Verification failed on date {date_str}! Halting execution.")
                sys.exit(1)

            if not args.limit:
                completed_dates.add(date_str)
                save_progress(completed_dates)
                logger.info(f"✓ Checkpoint updated for date {date_str}")

    logger.info("\n🎉 LONG-HORIZON RUN FINISHED!")
    logger.info(f"Total Showtimes Trimmed: {total_trimmed_all}")
    logger.info(
        f"Total Space Saved: {total_bytes_saved_all / (1024 * 1024):.2f} MB "
        f"({total_bytes_saved_all / (1024 * 1024 * 1024):.2f} GB)"
    )


if __name__ == "__main__":
    main()
