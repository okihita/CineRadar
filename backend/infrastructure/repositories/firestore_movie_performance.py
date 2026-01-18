"""
Firestore Movie Performance Repository

Stores and retrieves movie performance data and showtime snapshots.
Collection: movie_performance/{movie_id}/showtimes/{showtime_id}
"""

import json
import logging
import os
import tempfile
from datetime import datetime
from typing import Any

from backend.domain.models import MoviePerformance, ShowtimeSnapshot

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
        movie_performance/{movie_id}           <- MoviePerformance summary doc
        movie_performance/{movie_id}/showtimes/{showtime_id}  <- ShowtimeSnapshot

    Example:
        repo = FirestoreMoviePerformanceRepository()

        # Save a showtime snapshot
        snapshot = ShowtimeSnapshot(...)
        repo.save_showtime(snapshot)

        # Get movie summary
        perf = repo.get_summary("1961889705591132160")
        print(f"{perf.title}: {perf.avg_occupancy_pct}%")
    """

    COLLECTION = "movie_performance"
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

        Stores in: movie_performance/{movie_id}/showtimes/{showtime_id}

        Args:
            snapshot: ShowtimeSnapshot with all occupancy data including layout

        Returns:
            True if saved successfully
        """
        try:
            doc_ref = (
                self.db.collection(self.COLLECTION)
                .document(snapshot.movie_id)
                .collection(self.SHOWTIMES_SUBCOLLECTION)
                .document(snapshot.showtime_id)
            )
            doc_ref.set(snapshot.to_dict())
            logger.debug(f"Saved showtime {snapshot.showtime_id} for movie {snapshot.movie_id}")
            return True
        except Exception as e:
            logger.error(f"Failed to save showtime: {e}")
            return False

    def update_summary(self, perf: MoviePerformance) -> bool:
        """Update a movie's performance summary.

        Stores in: movie_performance/{movie_id}

        Args:
            perf: MoviePerformance aggregated data

        Returns:
            True if saved successfully
        """
        try:
            doc_ref = self.db.collection(self.COLLECTION).document(perf.movie_id)
            doc_ref.set(perf.to_dict())
            logger.debug(f"Updated summary for movie {perf.movie_id}: {perf.avg_occupancy_pct}%")
            return True
        except Exception as e:
            logger.error(f"Failed to update summary: {e}")
            return False

    def get_summary(self, movie_id: str) -> MoviePerformance | None:
        """Get a movie's performance summary.

        Args:
            movie_id: Movie identifier

        Returns:
            MoviePerformance or None if not found
        """
        try:
            doc_ref = self.db.collection(self.COLLECTION).document(movie_id)
            doc = doc_ref.get()

            if not doc.exists:
                return None

            return MoviePerformance.from_dict(doc.to_dict())
        except Exception as e:
            logger.error(f"Failed to get summary for {movie_id}: {e}")
            return None

    def get_all_showtimes(self, movie_id: str) -> list[ShowtimeSnapshot]:
        """Get all showtime snapshots for a movie.

        Args:
            movie_id: Movie identifier

        Returns:
            List of ShowtimeSnapshot objects
        """
        try:
            collection_ref = (
                self.db.collection(self.COLLECTION)
                .document(movie_id)
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
            logger.error(f"Failed to get showtimes for {movie_id}: {e}")
            return []

    def get_showtime(self, movie_id: str, showtime_id: str) -> ShowtimeSnapshot | None:
        """Get a specific showtime snapshot.

        Args:
            movie_id: Movie identifier
            showtime_id: Showtime identifier

        Returns:
            ShowtimeSnapshot or None if not found
        """
        try:
            doc_ref = (
                self.db.collection(self.COLLECTION)
                .document(movie_id)
                .collection(self.SHOWTIMES_SUBCOLLECTION)
                .document(showtime_id)
            )
            doc = doc_ref.get()

            if not doc.exists:
                return None

            return ShowtimeSnapshot.from_dict(doc.to_dict())
        except Exception as e:
            logger.error(f"Failed to get showtime {showtime_id}: {e}")
            return None

    def list_movies(self, limit: int = 100) -> list[MoviePerformance]:
        """List all movie performance summaries.

        Args:
            limit: Maximum movies to return

        Returns:
            List of MoviePerformance objects, sorted by avg occupancy descending
        """
        try:
            collection_ref = self.db.collection(self.COLLECTION).limit(limit)
            docs = collection_ref.stream()

            movies = []
            for doc in docs:
                try:
                    movies.append(MoviePerformance.from_dict(doc.to_dict()))
                except Exception as e:
                    logger.warning(f"Failed to parse movie {doc.id}: {e}")

            # Sort by occupancy descending
            movies.sort(key=lambda m: m.avg_occupancy_pct, reverse=True)
            return movies
        except Exception as e:
            logger.error(f"Failed to list movies: {e}")
            return []

    def delete_movie(self, movie_id: str) -> bool:
        """Delete a movie and all its showtimes.

        Args:
            movie_id: Movie identifier

        Returns:
            True if deleted successfully
        """
        try:
            # Delete all showtimes first
            showtimes_ref = (
                self.db.collection(self.COLLECTION)
                .document(movie_id)
                .collection(self.SHOWTIMES_SUBCOLLECTION)
            )
            for doc in showtimes_ref.stream():
                doc.reference.delete()

            # Delete movie summary
            self.db.collection(self.COLLECTION).document(movie_id).delete()
            logger.info(f"Deleted movie {movie_id} and all showtimes")
            return True
        except Exception as e:
            logger.error(f"Failed to delete movie {movie_id}: {e}")
            return False
