"""
Shared utilities for CLI commands.
"""

import json
import logging
import os
from datetime import datetime
from pathlib import Path
from typing import Any, cast

from google.cloud import firestore
from google.oauth2 import service_account

logger = logging.getLogger(__name__)


def load_movie_data(data_dir: str = "data", use_firestore: bool = False) -> dict[str, Any] | None:
    """Load today's movie data from local files or Firestore.

    Args:
        data_dir: Directory for local JSON files
        use_firestore: If True, load from Firestore instead of local files
    """
    date_str = datetime.now().strftime("%Y-%m-%d")

    # For JIT mode, always use Firestore
    if use_firestore:
        return load_movie_data_from_firestore(date_str)

    data_path = Path(data_dir)

    # Try today's merged file first, then batch files
    candidates = [
        data_path / f"movies_{date_str}.json",
        data_path / f"batch_0_{date_str}.json",
    ]

    for path in candidates:
        if path.exists():
            with open(path) as f:
                return cast("dict[str, Any]", json.load(f))

    logger.warning(f"⚠️ No movie data found for {date_str}")

    # Fall back to Firestore
    logger.info("📥 Attempting to load from Firestore...")
    return load_movie_data_from_firestore(date_str)


def load_movie_data_from_firestore(date_str: str) -> dict[str, Any] | None:
    """Load movie data from Firestore schedules collection.

    Loads from schedules/{date}/movies/{movie_id} collection.
    """
    # Initialize Firestore
    sa_json = os.environ.get("FIREBASE_SERVICE_ACCOUNT")
    if sa_json:
        sa_info = json.loads(sa_json)
        credentials = service_account.Credentials.from_service_account_info(sa_info)  # type: ignore[no-untyped-call]
        db = firestore.Client(credentials=credentials, project=sa_info["project_id"])
    else:
        db = firestore.Client()

    # Load all movies from schedules/{date}/movies
    logger.info(f"📥 Loading movies from Firestore: schedules/{date_str}/movies")
    movies_ref = db.collection("schedules").document(date_str).collection("movies")

    docs = movies_ref.stream()
    movies = []
    for doc in docs:
        movie_data = doc.to_dict()
        if movie_data:
            movies.append(movie_data)

    if not movies:
        logger.warning(f"⚠️ No movies found in Firestore for {date_str}")
        return None

    logger.info(f"✅ Loaded {len(movies)} movies from Firestore")

    return {"date": date_str, "movies": movies, "scraped_at": datetime.now().isoformat()}
