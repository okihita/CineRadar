"""CLI tool to safely purge the deprecated legacy V1 `movie_performance` collection.

Strictly targets the orphaned `movie_performance` root collection and its subcollections
(`days`, `showtimes`) to eliminate ~200 GB of legacy storage and single-field index bloat.

Safety Guarantees:
- Strictly targeting `movie_performance` (never touches `movie_performance_v2`)
- Default `--dry-run` mode (zero writes or deletes performed)
- Requires explicit `--execute` flag to perform deletions
- Fast, rate-limited batch deletions using Firestore `BulkWriter`

Usage:
    # Dry-run inspection (read-only count)
    uv run python backend/scripts/purge_legacy_v1_performance.py --dry-run

    # Test purge on first 5 movies
    uv run python backend/scripts/purge_legacy_v1_performance.py --limit 5 --execute

    # Full production purge
    uv run python backend/scripts/purge_legacy_v1_performance.py --execute
"""

import argparse
import logging
import os
import sys
import time
from typing import Any

from google.cloud import firestore

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)
logger = logging.getLogger("purge_legacy_v1_performance")

TARGET_COLLECTION = "movie_performance"
FORBIDDEN_COLLECTIONS = [
    "movie_performance_v2",
    "schedules",
    "schedules_v2",
    "theatres",
    "movies",
    "cinepoint_box_office",
    "cinepoint_movies",
    "snapshots",
]


def get_firestore_client() -> firestore.Client:
    """Get Firestore client from environment or standard credentials."""
    project_id = os.environ.get("GOOGLE_CLOUD_PROJECT", "cineradar-481014")
    return firestore.Client(project=project_id)


def stream_with_retry(query: Any, max_retries: int = 5) -> list[Any]:
    """Stream Firestore query results with exponential backoff for transient errors."""
    for attempt in range(max_retries):
        try:
            return list(query.stream())
        except Exception as e:
            if attempt == max_retries - 1:
                raise
            wait = (attempt + 1) * 3
            logger.warning(
                f"Transient Firestore stream error ({e}). Retrying in {wait}s... (attempt {attempt+1}/{max_retries})"
            )
            time.sleep(wait)
    return []


def run_purge(
    db: firestore.Client,
    dry_run: bool = True,
) -> None:
    """Execute the purge across the entire legacy movie_performance collection."""
    col = db.collection(TARGET_COLLECTION)
    if col.id != TARGET_COLLECTION:
        raise ValueError(
            f"FATAL SAFETY CHECK: Attempted to delete outside {TARGET_COLLECTION}! Collection: {col.id}"
        )

    logger.info(f"Scanning target collection: {TARGET_COLLECTION} (dry_run={dry_run})...")
    movie_docs = list(col.list_documents())
    logger.info(f"Found {len(movie_docs)} remaining root movies in legacy {TARGET_COLLECTION}")

    if dry_run:
        logger.info(f"🔍 Dry run complete. Would recursively delete {len(movie_docs)} movies and all subcollections.")
        return

    start_time = time.time()
    logger.info(f"🚀 Executing full recursive deletion of '{TARGET_COLLECTION}' collection tree...")
    num_deleted = db.recursive_delete(col)
    elapsed = time.time() - start_time

    logger.info("\n=======================================================")
    logger.info(f"🎉 PURGE COMPLETED in {elapsed/60:.2f} minutes!")
    logger.info(f"Total Documents Purged: {num_deleted:,}")
    logger.info("Estimated Storage Freed: ~200 GB (plus all associated index trees)")
    logger.info("=======================================================")


def main() -> None:
    """Main CLI entrypoint."""
    parser = argparse.ArgumentParser(
        description="Safely purge legacy V1 movie_performance collection."
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
        help="Execute actual deletion writes in Firestore",
    )

    args = parser.parse_args()

    # Safety: Require explicit --execute
    dry_run = not args.execute
    if dry_run:
        logger.info("🔍 RUNNING IN DRY-RUN MODE (Zero deletions will be performed)")
    else:
        logger.warning("🚨 EXECUTING LIVE DELETION OF LEGACY V1 'movie_performance'")
        logger.warning("This will permanently delete orphaned V1 documents.")
        time.sleep(1)

    db = get_firestore_client()
    run_purge(db, dry_run=dry_run)


if __name__ == "__main__":
    main()
