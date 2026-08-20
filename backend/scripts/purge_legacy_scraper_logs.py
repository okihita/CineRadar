#!/usr/bin/env python3
"""
Purge Legacy Scraper Logs CLI
Safely deletes scraper_logs documents and their subcollections (dispatches, jobs, errors)
older than a specified cutoff date (default: 2 weeks ago) using Firestore native recursive_delete.

Usage:
    # 1. Preview what will be deleted (dry-run):
    PYTHONPATH=. uv run python backend/scripts/purge_legacy_scraper_logs.py --dry-run

    # 2. Execute deletion:
    PYTHONPATH=. uv run python backend/scripts/purge_legacy_scraper_logs.py --execute

    # 3. Resume from last checkpoint if interrupted:
    PYTHONPATH=. uv run python backend/scripts/purge_legacy_scraper_logs.py --execute --resume
"""

from __future__ import annotations

import argparse
import json
import logging
import os
import sys
import time
from datetime import datetime, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

from google.cloud import firestore

# Configuration
JAKARTA_TZ = ZoneInfo("Asia/Jakarta")
CHECKPOINT_DIR = Path("migration_checkpoint")
CHECKPOINT_DIR.mkdir(exist_ok=True)
PROGRESS_FILE = CHECKPOINT_DIR / "purge_scraper_logs_progress.json"

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-5s | %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger(__name__)


def load_env(env_file: str = "admin/.env.local") -> None:
    """Load environment variables from a .env file."""
    env_path = Path(env_file)
    if not env_path.exists():
        return
    with open(env_path) as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, _, value = line.partition("=")
            key = key.strip()
            value = value.strip().strip('"').strip("'")
            if key and key not in os.environ:
                os.environ[key] = value


load_env()
load_env(".env")
load_env(".env.local")


def get_firestore_client() -> firestore.Client:
    """Initialize Firestore client from environment or credentials."""
    project_id = os.environ.get("FIREBASE_PROJECT_ID", "cineradar-481014")
    private_key = os.environ.get("FIREBASE_PRIVATE_KEY")
    client_email = os.environ.get("FIREBASE_CLIENT_EMAIL")

    if private_key and client_email:
        from google.oauth2 import service_account

        cleaned_key = private_key.replace("\\n", "\n")
        cred_dict = {
            "type": "service_account",
            "project_id": project_id,
            "private_key": cleaned_key,
            "client_email": client_email,
            "token_uri": "https://oauth2.googleapis.com/token",
        }
        credentials = service_account.Credentials.from_service_account_info(
            cred_dict,
            scopes=["https://www.googleapis.com/auth/cloud-platform"],
        )
        return firestore.Client(project=project_id, credentials=credentials)

    return firestore.Client(project=project_id)


def load_progress() -> set[str]:
    """Load previously completed date IDs from progress file."""
    if PROGRESS_FILE.exists():
        try:
            with open(PROGRESS_FILE) as f:
                data = json.load(f)
                return set(data.get("completed_dates", []))
        except Exception as e:
            logger.warning(f"Could not load progress file: {e}")
    return set()


def save_progress(completed_dates: set[str]) -> None:
    """Persist completed date IDs to progress file."""
    with open(PROGRESS_FILE, "w") as f:
        json.dump(
            {
                "completed_dates": sorted(completed_dates),
                "updated_at": datetime.now(JAKARTA_TZ).isoformat(),
            },
            f,
            indent=2,
        )


def main() -> None:
    parser = argparse.ArgumentParser(description="Purge legacy scraper_logs older than cutoff date")
    parser.add_argument(
        "--cutoff",
        type=str,
        default=(datetime.now(JAKARTA_TZ) - timedelta(days=14)).strftime("%Y-%m-%d"),
        help="Cutoff date in YYYY-MM-DD format (dates strictly before this will be deleted, default: 14 days ago)",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Preview dates and documents to be deleted without making any changes",
    )
    parser.add_argument(
        "--execute",
        action="store_true",
        help="Execute the recursive deletion in Firestore",
    )
    parser.add_argument(
        "--resume",
        action="store_true",
        help="Resume from last checkpoint progress file",
    )
    args = parser.parse_args()

    if not args.dry_run and not args.execute:
        logger.error("Please specify either --dry-run or --execute")
        sys.exit(1)

    cutoff_date = args.cutoff
    logger.info(f"Target Cutoff Date: {cutoff_date} (Dates < {cutoff_date} will be purged)")

    db = get_firestore_client()

    # Step 1: Scan all date documents under scraper_logs
    logger.info("Scanning scraper_logs root collection...")
    all_date_docs = [doc.id for doc in db.collection("scraper_logs").stream()]
    all_date_docs.sort()

    target_dates = [d for d in all_date_docs if d < cutoff_date]
    retained_dates = [d for d in all_date_docs if d >= cutoff_date]

    logger.info(f"Total dates in scraper_logs: {len(all_date_docs)}")
    logger.info(f"Dates to be PURGED (< {cutoff_date}): {len(target_dates)}")
    logger.info(f"Dates to be RETAINED (>= {cutoff_date}): {len(retained_dates)}")
    if retained_dates:
        logger.info(f"Retained range: {retained_dates[0]} to {retained_dates[-1]}")

    if not target_dates:
        logger.info("No legacy scraper_logs found matching cutoff criteria. Nothing to do!")
        return

    if args.dry_run:
        logger.info("=" * 60)
        logger.info("🔍 DRY-RUN SUMMARY (NO WRITES / DELETES PERFORMED)")
        logger.info("=" * 60)
        logger.info(f"Earliest target date : {target_dates[0]}")
        logger.info(f"Latest target date   : {target_dates[-1]}")
        logger.info(f"Total date partitions: {len(target_dates)}")
        logger.info("Target Dates list (first 10): " + ", ".join(target_dates[:10]))
        if len(target_dates) > 10:
            logger.info("... and " + str(len(target_dates) - 10) + " more dates.")
        logger.info("=" * 60)
        logger.info("To execute this purge safely, run with --execute")
        return

    # Step 2: Execution mode
    completed_dates: set[str] = set()
    if args.resume:
        completed_dates = load_progress()
        logger.info(f"Resuming: {len(completed_dates)} dates already marked completed.")

    pending_dates = [d for d in target_dates if d not in completed_dates]
    logger.info(f"Starting purge of {len(pending_dates)} pending date partitions...")

    start_time = time.time()
    deleted_count = 0

    for idx, date_str in enumerate(pending_dates, 1):
        doc_ref = db.collection("scraper_logs").document(date_str)
        logger.info(f"[{idx}/{len(pending_dates)}] Deleting scraper_logs/{date_str} and all subcollections...")

        for attempt in range(1, 4):
            try:
                bulk_writer = db.bulk_writer()
                db.recursive_delete(doc_ref, bulk_writer=bulk_writer)
                bulk_writer.close()

                completed_dates.add(date_str)
                save_progress(completed_dates)
                deleted_count += 1
                break
            except Exception as e:
                logger.warning(f"Attempt {attempt}/3 failed for scraper_logs/{date_str}: {e}")
                if attempt < 3:
                    time.sleep(3 * attempt)
                else:
                    logger.error(f"Failed to purge scraper_logs/{date_str} after 3 attempts.")
                    logger.info("You can resume safely by re-running with --execute --resume")
                    raise

        if idx % 10 == 0 or idx == len(pending_dates):
            elapsed = time.time() - start_time
            rate = deleted_count / elapsed if elapsed > 0 else 0
            eta = (len(pending_dates) - idx) / rate if rate > 0 else 0
            logger.info(
                f"Progress: {idx}/{len(pending_dates)} dates purged ({idx/len(pending_dates)*100:.1f}%) "
                f"| Rate: {rate:.1f} dates/sec | ETA: {eta/60:.1f} mins"
            )

    total_time = time.time() - start_time
    logger.info("=" * 60)
    logger.info(f"🎉 PURGE COMPLETED SUCCESSFULLY in {total_time/60:.2f} minutes!")
    logger.info(f"Total date partitions deleted: {deleted_count}")
    logger.info(f"Remaining active dates in scraper_logs: {len(retained_dates)}")
    logger.info("=" * 60)


if __name__ == "__main__":
    main()
