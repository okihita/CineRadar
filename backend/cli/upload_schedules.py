#!/usr/bin/env python3
"""
Upload movie schedules to Firestore.
Creates per-movie documents in schedules/{date}/{movie_id} collection.
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


def find_latest_movie_file(data_dir: str = "data") -> Path | None:
    """Find the most recent movies JSON file."""
    data_path = Path(data_dir)
    movie_files = list(data_path.glob("movies_*.json"))
    if not movie_files:
        return None
    # Sort by date in filename and return most recent
    return sorted(movie_files, reverse=True)[0]


def upload_schedules_to_firestore(data_dir: str = "data"):
    """Upload per-movie schedule documents to Firestore."""
    movie_file = find_latest_movie_file(data_dir)
    if not movie_file:
        print("❌ No movie files found in data/")
        return

    print(f"📂 Loading {movie_file.name}")
    with open(movie_file, encoding='utf-8') as f:
        data = json.load(f)

    movies = data.get('movies', [])
    date = data.get('date', datetime.now().strftime('%Y-%m-%d'))

    if not movies:
        print("⚠️ No movies found in data")
        return

    db = get_firestore_client()
    print(f"📤 Uploading {len(movies)} movie schedules for {date}...")

    uploaded = 0
    for movie in movies:
        movie_id = movie.get('id')
        if not movie_id:
            continue

        # Build the schedule document
        schedule_doc = {
            'movie_id': movie_id,
            'title': movie.get('title', ''),
            'poster': movie.get('poster', ''),
            'genres': movie.get('genres', []),
            'age_category': movie.get('age_category', ''),
            'merchants': movie.get('merchants', []),
            'is_presale': movie.get('is_presale', False),
            'date': date,
            'uploaded_at': datetime.utcnow().isoformat(),
            'cities': movie.get('schedules', {}),
        }

        # Write to schedules/{date}/{movie_id}
        doc_ref = db.collection('schedules').document(date).collection('movies').document(movie_id)
        doc_ref.set(schedule_doc)
        uploaded += 1
        print(f"   ✓ {movie.get('title', movie_id)[:40]}")

    print(f"\n✅ Uploaded {uploaded} movie schedules to schedules/{date}/movies/")


def main():
    print("\n" + "=" * 60)
    print("🎬 CineRadar Schedule Upload")
    print("=" * 60 + "\n")

    upload_schedules_to_firestore()

    print("\n🏁 Done")


if __name__ == "__main__":
    main()
