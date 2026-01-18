#!/usr/bin/env python3
"""
Upload seat snapshots to Firestore.
Merges batch files if present and uploads to seat_snapshots collection.
"""

import json
import logging
import os
from datetime import datetime
from pathlib import Path

from google.cloud import firestore
from google.oauth2 import service_account

logger = logging.getLogger(__name__)


def get_firestore_client():
    """Initialize Firestore client from service account."""
    sa_json = os.environ.get("FIREBASE_SERVICE_ACCOUNT")
    if sa_json:
        sa_info = json.loads(sa_json)
        credentials = service_account.Credentials.from_service_account_info(sa_info)
        return firestore.Client(credentials=credentials, project=sa_info["project_id"])
    else:
        # Local development - use default credentials
        return firestore.Client()


def merge_seat_batches(data_dir: str = "data") -> list:
    """Merge all seat batch files into a single list."""
    data_path = Path(data_dir)
    all_seats = []

    # Find all seat batch files
    batch_files = list(data_path.glob("seats_*_batch*.json"))
    if batch_files:
        logger.info(f"📂 Found {len(batch_files)} batch files to merge")
        for batch_file in sorted(batch_files):
            with open(batch_file, encoding="utf-8") as f:
                batch_data = json.load(f)
                # Support both 'results' (new) and 'seats' (legacy) keys
                seats = batch_data.get("results", batch_data.get("seats", []))
                all_seats.extend(seats)
                logger.info(f"   + {batch_file.name}: {len(seats)} seats")
    else:
        # Try single file
        seat_files = list(data_path.glob("seats_*.json"))
        for seat_file in seat_files:
            if "batch" not in seat_file.name:
                with open(seat_file, encoding="utf-8") as f:
                    data = json.load(f)
                    # Support both 'results' (new) and 'seats' (legacy) keys
                    seats = data.get("results", data.get("seats", []))
                    all_seats.extend(seats)
                    logger.info(f"   + {seat_file.name}: {len(seats)} seats")

    return all_seats


def upload_seats_to_firestore(seats: list, batch_size: int = 500):
    """Upload seat snapshots to Firestore in batches."""
    if not seats:
        logger.info("No seats to upload")
        return

    db = get_firestore_client()
    collection = db.collection("seat_snapshots")

    logger.info(f"📤 Uploading {len(seats)} seat snapshots to Firestore...")

    uploaded = 0
    for i in range(0, len(seats), batch_size):
        batch = db.batch()
        chunk = seats[i : i + batch_size]

        for seat in chunk:
            # Create document ID from showtime_id + snapshot_type + timestamp
            doc_id = f"{seat.get('showtime_id')}_{seat.get('snapshot_type', 'unknown')}_{datetime.now().strftime('%H%M')}"
            doc_ref = collection.document(doc_id)
            batch.set(doc_ref, seat)

        batch.commit()
        uploaded += len(chunk)
        logger.info(f"   Uploaded {uploaded}/{len(seats)}")

    logger.info(f"✅ Successfully uploaded {len(seats)} seat snapshots")


def main():
    logger.info("\n" + "=" * 60)
    logger.info("🪑 CineRadar Seat Data Upload")
    logger.info("=" * 60 + "\n")

    # Merge batch files
    seats = merge_seat_batches()

    if not seats:
        logger.warning("⚠️ No seat data found to upload")
        return

    logger.info(f"\n📊 Total seats to upload: {len(seats)}")

    # Upload to Firestore
    upload_seats_to_firestore(seats)

    logger.info("\n🏁 Done")


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(message)s")
    main()
