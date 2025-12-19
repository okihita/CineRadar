#!/usr/bin/env python3
"""
Upload seat snapshots to Firestore.
Merges batch files if present and uploads to seat_snapshots collection.
"""
import json
import os
from datetime import datetime
from pathlib import Path

from google.cloud import firestore
from google.oauth2 import service_account


def get_firestore_client():
    """Initialize Firestore client from service account."""
    sa_json = os.environ.get('FIREBASE_SERVICE_ACCOUNT')
    if sa_json:
        sa_info = json.loads(sa_json)
        credentials = service_account.Credentials.from_service_account_info(sa_info)
        return firestore.Client(credentials=credentials, project=sa_info['project_id'])
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
        print(f"📂 Found {len(batch_files)} batch files to merge")
        for batch_file in sorted(batch_files):
            with open(batch_file, encoding='utf-8') as f:
                batch_data = json.load(f)
                seats = batch_data.get('seats', [])
                all_seats.extend(seats)
                print(f"   + {batch_file.name}: {len(seats)} seats")
    else:
        # Try single file
        seat_files = list(data_path.glob("seats_*.json"))
        for seat_file in seat_files:
            if 'batch' not in seat_file.name:
                with open(seat_file, encoding='utf-8') as f:
                    data = json.load(f)
                    seats = data.get('seats', [])
                    all_seats.extend(seats)
                    print(f"   + {seat_file.name}: {len(seats)} seats")

    return all_seats


def upload_seats_to_firestore(seats: list, batch_size: int = 500):
    """Upload seat snapshots to Firestore in batches."""
    if not seats:
        print("ℹ️ No seats to upload")
        return

    db = get_firestore_client()
    collection = db.collection('seat_snapshots')

    print(f"📤 Uploading {len(seats)} seat snapshots to Firestore...")

    uploaded = 0
    for i in range(0, len(seats), batch_size):
        batch = db.batch()
        chunk = seats[i:i + batch_size]

        for seat in chunk:
            # Create document ID from showtime_id + snapshot_type + timestamp
            doc_id = f"{seat.get('showtime_id')}_{seat.get('snapshot_type', 'unknown')}_{datetime.now().strftime('%H%M')}"
            doc_ref = collection.document(doc_id)
            batch.set(doc_ref, seat)

        batch.commit()
        uploaded += len(chunk)
        print(f"   Uploaded {uploaded}/{len(seats)}")

    print(f"✅ Successfully uploaded {len(seats)} seat snapshots")


def main():
    print("\n" + "=" * 60)
    print("🪑 CineRadar Seat Data Upload")
    print("=" * 60 + "\n")

    # Merge batch files
    seats = merge_seat_batches()

    if not seats:
        print("⚠️ No seat data found to upload")
        return

    print(f"\n📊 Total seats to upload: {len(seats)}")

    # Upload to Firestore
    upload_seats_to_firestore(seats)

    print("\n🏁 Done")


if __name__ == "__main__":
    main()
