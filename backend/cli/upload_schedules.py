#!/usr/bin/env python3
"""
Upload movie schedules to Firestore.
Creates per-movie documents in schedules/{date}/movies/{movie_id} collection.
"""

import json
import os
from datetime import datetime
from pathlib import Path

from google.cloud import firestore
from google.oauth2 import service_account


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


def load_movie_data(data_dir: str = "data") -> dict | None:
    """Load the most recent movies JSON file.

    Args:
        data_dir: Directory containing movies JSON files.

    Returns:
        Parsed movie data dict, or None if no files found.
    """
    data_path = Path(data_dir)
    movie_files = list(data_path.glob("movies_*.json"))
    if not movie_files:
        return None

    # Sort by modification time, newest first
    movie_files.sort(key=lambda f: f.stat().st_mtime, reverse=True)
    latest_file = movie_files[0]

    with open(latest_file, encoding="utf-8") as f:
        return json.load(f)


def transform_for_firestore(movie: dict, date: str) -> dict:
    """Transform a movie dict into Firestore document format.

    Args:
        movie: Raw movie dict from JSON.
        date: Date string (YYYY-MM-DD).

    Returns:
        Transformed dict ready for Firestore.
    """
    return {
        "movie_id": movie.get("id", ""),
        "title": movie.get("title", ""),
        "poster": movie.get("poster", ""),
        "genres": movie.get("genres", []),
        "age_category": movie.get("age_category", ""),
        "merchants": movie.get("merchants", []),
        "is_presale": movie.get("is_presale", False),
        "date": date,
        "uploaded_at": datetime.utcnow().isoformat(),
        "cities": movie.get("schedules", {}),
    }


def upload_schedules_to_firestore(movies: list, date: str):
    """Upload per-movie schedule documents to Firestore.

    Args:
        movies: List of movie dicts with schedules.
        date: Date string (YYYY-MM-DD).
    """
    if not movies:
        print("⚠️ No movies to upload")
        return

    db = get_firestore_client()
    print(f"📤 Uploading {len(movies)} movie schedules for {date}...")

    uploaded = 0
    for movie in movies:
        movie_id = movie.get("id")
        if not movie_id:
            continue

        schedule_doc = transform_for_firestore(movie, date)

        # Write to schedules/{date}/movies/{movie_id}
        doc_ref = db.collection("schedules").document(date).collection("movies").document(movie_id)
        doc_ref.set(schedule_doc)
        uploaded += 1
        print(f"   ✓ {movie.get('title', movie_id)[:40]}")

    print(f"\n✅ Uploaded {uploaded} movie schedules to schedules/{date}/movies/")


def main():
    print("\n" + "=" * 60)
    print("🎬 CineRadar Schedule Upload")
    print("=" * 60 + "\n")

    data = load_movie_data()
    if not data:
        print("❌ No movie files found in data/")
        return

    movies = data.get("movies", [])
    date = data.get("date", datetime.now().strftime("%Y-%m-%d"))

    print(f"📂 Loaded {len(movies)} movies for {date}")
    upload_schedules_to_firestore(movies, date)

    print("\n🏁 Done")


if __name__ == "__main__":
    main()
