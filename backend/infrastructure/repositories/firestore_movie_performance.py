"""
Firestore Movie Performance Repository

Stores and retrieves movie performance data and showtime snapshots.
Collection: movie_performance/{movie_id}/showtimes/{showtime_id}
"""

import json
import logging
import os
import tempfile
from typing import Any

from backend.domain.models import DailyPerformance, MovieMetadata, ShowtimeSnapshot

logger = logging.getLogger(__name__)


def _get_firestore_client() -> Any:
    """Get Firestore client with proper credentials.

    Supports:
    - FIREBASE_SERVICE_ACCOUNT env var (JSON string) for CI/CD
    - GOOGLE_APPLICATION_CREDENTIALS file path
    - Default application credentials (local dev)
    """
    from google.cloud import firestore

    service_account_json = os.environ.get("FIREBASE_SERVICE_ACCOUNT")
    if service_account_json:
        creds_data = json.loads(service_account_json)
        with tempfile.NamedTemporaryFile(mode="w", suffix=".json", delete=False) as f:
            json.dump(creds_data, f)
            temp_path = f.name
        os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = temp_path
        return firestore.Client(project=creds_data.get("project_id", "cineradar-481014"))

    return firestore.Client(project=os.environ.get("FIREBASE_PROJECT_ID", "cineradar-481014"))


class FirestoreMoviePerformanceRepository:
    """Firestore repository for movie performance data.

    Schema:
        movie_performance/{movie_id}                                <- MovieMetadata
        movie_performance/{movie_id}/days/{date}                    <- DailyPerformance
        movie_performance/{movie_id}/days/{date}/showtimes/{id}     <- ShowtimeSnapshot
    """

    COLLECTION = "movie_performance"
    DAYS_SUBCOLLECTION = "days"
    SHOWTIMES_SUBCOLLECTION = "showtimes"

    def __init__(self) -> None:
        """Initialize repository."""
        self._db = None

    @property
    def db(self) -> Any:
        """Lazy-load Firestore client."""
        if self._db is None:
            self._db = _get_firestore_client()
        return self._db

    def save_showtime(self, snapshot: ShowtimeSnapshot) -> bool:
        """Save a showtime snapshot.

        Stores in: movie_performance/{movie_id}/days/{date}/showtimes/{showtime_id}
        """
        try:
            doc_ref = (
                self.db.collection(self.COLLECTION)
                .document(snapshot.movie_id)
                .collection(self.DAYS_SUBCOLLECTION)
                .document(snapshot.date)
                .collection(self.SHOWTIMES_SUBCOLLECTION)
                .document(snapshot.showtime_id)
            )
            doc_ref.set(snapshot.to_dict())
            logger.debug(
                f"Saved showtime {snapshot.showtime_id} for movie {snapshot.movie_id} on {snapshot.date}"
            )
            return True
        except Exception as e:
            logger.error(f"Failed to save showtime: {e}")
            return False

    def update_metadata(self, metadata: MovieMetadata) -> bool:
        """Update a movie's static metadata (Root Collection)."""
        try:
            doc_ref = self.db.collection(self.COLLECTION).document(metadata.movie_id)
            doc_ref.set(metadata.to_dict(), merge=True)
            logger.debug(f"Updated metadata for movie {metadata.movie_id}")
            return True
        except Exception as e:
            logger.error(f"Failed to update metadata: {e}")
            return False

    def update_daily_stats(self, daily: DailyPerformance, movie_id: str) -> bool:
        """Update a movie's daily performance stats (Days Subcollection)."""
        try:
            doc_ref = (
                self.db.collection(self.COLLECTION)
                .document(movie_id)
                .collection(self.DAYS_SUBCOLLECTION)
                .document(daily.date)
            )
            doc_ref.set(daily.to_dict(), merge=True)
            logger.debug(f"Updated daily stats for movie {movie_id} on {daily.date}")
            return True
        except Exception as e:
            logger.error(f"Failed to update daily stats: {e}")
            return False

    def get_metadata(self, movie_id: str) -> MovieMetadata | None:
        """Get a movie's metadata."""
        try:
            doc_ref = self.db.collection(self.COLLECTION).document(movie_id)
            doc = doc_ref.get()

            if not doc.exists:
                return None

            return MovieMetadata.from_dict(doc.to_dict())
        except Exception as e:
            logger.error(f"Failed to get metadata for {movie_id}: {e}")
            return None

    def get_daily_stats(self, movie_id: str, date: str) -> DailyPerformance | None:
        """Get daily performance stats."""
        try:
            doc_ref = (
                self.db.collection(self.COLLECTION)
                .document(movie_id)
                .collection(self.DAYS_SUBCOLLECTION)
                .document(date)
            )
            doc = doc_ref.get()

            if not doc.exists:
                return None

            return DailyPerformance.from_dict(doc.to_dict())
        except Exception as e:
            logger.error(f"Failed to get daily stats for {movie_id} on {date}: {e}")
            return None

    def list_movies(self, limit: int = 100) -> list[MovieMetadata]:
        """List all movies (metadata only)."""
        try:
            # Order by last_updated desc
            collection_ref = (
                self.db.collection(self.COLLECTION)
                .order_by("last_updated", direction="DESCENDING")
                .limit(limit)
            )
            docs = collection_ref.stream()

            movies = []
            for doc in docs:
                try:
                    movies.append(MovieMetadata.from_dict(doc.to_dict()))
                except Exception as e:
                    logger.warning(f"Failed to parse movie {doc.id}: {e}")

            return movies
        except Exception as e:
            logger.error(f"Failed to list movies: {e}")
            return []

    def get_daily_showtimes(self, movie_id: str, date: str) -> list[ShowtimeSnapshot]:
        """Get all showtime snapshots for a movie on a specific date.

        Args:
            movie_id: Movie identifier
            date: Date string

        Returns:
            List of ShowtimeSnapshot objects
        """
        try:
            collection_ref = (
                self.db.collection(self.COLLECTION)
                .document(movie_id)
                .collection(self.DAYS_SUBCOLLECTION)
                .document(date)
                .collection(self.SHOWTIMES_SUBCOLLECTION)
            )
            docs = collection_ref.stream()

            snapshots = []
            for doc in docs:
                try:
                    snapshots.append(ShowtimeSnapshot.from_dict(doc.to_dict()))
                except Exception as e:
                    logger.warning(f"Failed to parse showtime {doc.id}: {e}")

            return snapshots
        except Exception as e:
            logger.error(f"Failed to get showtimes for {movie_id} on {date}: {e}")
            return []
