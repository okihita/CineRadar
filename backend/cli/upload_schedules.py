#!/usr/bin/env python3
"""
Upload movie schedules to Firestore.
Creates per-movie documents in schedules/{date}/movies/{movie_id} collection.
"""

import json
import logging
import os
from datetime import UTC, datetime
from pathlib import Path
from typing import Any, cast

from google.cloud import firestore
from google.oauth2 import service_account

from backend.infrastructure.firestore_collections import MOVIES, SCHEDULES

logger = logging.getLogger(__name__)


def get_firestore_client() -> firestore.Client:
    """Initialize Firestore client from service account."""
    sa_json = os.environ.get("FIREBASE_SERVICE_ACCOUNT")
    if sa_json:
        sa_info = json.loads(sa_json)
        credentials = service_account.Credentials.from_service_account_info(sa_info)  # type: ignore[no-untyped-call]
        return firestore.Client(credentials=credentials, project=sa_info["project_id"])
    else:
        # Local development - use default credentials
        return firestore.Client()


def load_movie_data(data_dir: str = "data") -> dict[str, Any] | None:
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
        return cast("dict[str, Any]", json.load(f))


def transform_for_firestore(movie: dict[str, Any], date: str) -> dict[str, Any]:
    """Transform a movie dict into Firestore document format.

    Crucially, this enforces the dual-ID schema mapping:
    - The Firestore Document relies on the `id` field from the scraper.
    - We explicitly pass `tix_metadata_id` for metadata cross-referencing.

    Args:
        movie: Raw movie dict from JSON.
        date: Date string (YYYY-MM-DD).

    Returns:
        Transformed dict ready for Firestore.
    """
    return {
        "movie_id": movie.get("id", ""),
        "tix_metadata_id": movie.get("tix_metadata_id", ""),
        "title": movie.get("title", ""),
        "poster": movie.get("poster", ""),
        "genres": movie.get("genres", []),
        "age_category": movie.get("age_category", ""),
        "merchants": movie.get("merchants", []),
        "is_presale": movie.get("is_presale", False),
        "date": date,
        "uploaded_at": datetime.now(UTC).isoformat(),
        "cities": movie.get("schedules", {}),
    }


def upload_schedules_to_firestore(movies: list[dict[str, Any]], date: str) -> None:
    """Upload per-movie schedule documents to Firestore.

    Args:
        movies: List of movie dicts with schedules.
        date: Date string (YYYY-MM-DD).
    """
    if not movies:
        logger.warning("⚠️ No movies to upload")
        return

    db = get_firestore_client()
    logger.info(f"📤 Uploading {len(movies)} movie schedules for {date}...")

    uploaded = 0
    for movie in movies:
        movie_id = movie.get("id")
        if not movie_id:
            continue

        schedule_doc = transform_for_firestore(movie, date)

        # Write to schedules/{date}/movies/{movie_id}
        doc_ref = db.collection(SCHEDULES).document(date).collection(MOVIES).document(movie_id)
        doc_ref.set(schedule_doc)
        uploaded += 1
        logger.info(f"   ✓ {movie.get('title', movie_id)[:40]}")

    logger.info(f"\n✅ Uploaded {uploaded} movie schedules to {SCHEDULES}/{date}/{MOVIES}/")


def main() -> None:
    logger.info("\n" + "=" * 60)
    logger.info("🎬 CineRadar Schedule Upload")
    logger.info("=" * 60 + "\n")

    data = load_movie_data()
    if not data:
        logger.error("❌ No movie files found in data/")
        return

    movies = data.get("movies", [])
    date = data.get("date", datetime.now().strftime("%Y-%m-%d"))

    logger.info(f"📂 Loaded {len(movies)} movies for {date}")
    upload_schedules_to_firestore(movies, date)

    logger.info("\n🏁 Done")


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(message)s")
    main()
