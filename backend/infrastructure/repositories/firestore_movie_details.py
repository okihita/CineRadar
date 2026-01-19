"""
Firestore Movie Details Repository

Stores detailed movie information with daily rating history.

Schema:
    movies/{movie_id}           - Main movie details document
    movies/{movie_id}/rating_history/{YYYY-MM-DD}  - Daily rating snapshots
"""

import logging
from datetime import UTC, datetime
from typing import Any

from backend.domain.models import MovieDetails, RatingScore
from backend.infrastructure.repositories.firestore_token import _get_firestore_client

logger = logging.getLogger(__name__)


class FirestoreMovieDetailsRepository:
    """Firestore implementation for movie details storage.

    Stores full movie details and tracks rating history over time.

    Example:
        repo = FirestoreMovieDetailsRepository()

        # Save movie details
        details = MovieDetails.from_api_response(api_data)
        repo.save(details)

        # Check if movie exists
        if repo.exists("1991446452714422272"):
            details = repo.get("1991446452714422272")
    """

    COLLECTION = "movies"
    RATING_SUBCOLLECTION = "rating_history"

    def __init__(self) -> None:
        self._db = None

    @property
    def db(self) -> Any:
        if self._db is None:
            self._db = _get_firestore_client()
        return self._db

    def save(self, movie_details: MovieDetails) -> bool:
        """Save movie details to Firestore.

        Saves the full movie document and adds a rating history entry.

        Args:
            movie_details: MovieDetails domain object

        Returns:
            True if save successful
        """
        try:
            movie_id = movie_details.movie_id
            data = movie_details.to_dict()

            # Save main document
            doc_ref = self.db.collection(self.COLLECTION).document(movie_id)
            doc_ref.set(data)

            # Save rating history entry
            self._save_rating_history(movie_id, movie_details.rating_score)

            logger.info(f"✅ Saved movie details: {movie_details.name} ({movie_id})")
            return True

        except Exception as e:
            logger.error(f"⚠️ Error saving movie details: {e}")
            return False

    def _save_rating_history(self, movie_id: str, rating_score: RatingScore | None) -> None:
        """Save daily rating snapshot to subcollection.

        Args:
            movie_id: Movie identifier
            rating_score: Current rating score
        """
        if not rating_score:
            return

        today = datetime.now(UTC).strftime("%Y-%m-%d")
        timestamp = datetime.now(UTC).isoformat()

        rating_data = {
            **rating_score.to_dict(),
            "scraped_at": timestamp,
        }

        doc_ref = (
            self.db.collection(self.COLLECTION)
            .document(movie_id)
            .collection(self.RATING_SUBCOLLECTION)
            .document(today)
        )
        doc_ref.set(rating_data)

    def get(self, movie_id: str) -> MovieDetails | None:
        """Get movie details by ID.

        Args:
            movie_id: TIX.id movie identifier

        Returns:
            MovieDetails or None if not found
        """
        try:
            doc_ref = self.db.collection(self.COLLECTION).document(movie_id)
            doc = doc_ref.get()

            if not doc.exists:
                return None

            return MovieDetails.from_dict(doc.to_dict())

        except Exception as e:
            logger.error(f"⚠️ Error getting movie {movie_id}: {e}")
            return None

    def exists(self, movie_id: str) -> bool:
        """Check if movie details exist.

        Args:
            movie_id: TIX.id movie identifier

        Returns:
            True if document exists
        """
        try:
            doc_ref = self.db.collection(self.COLLECTION).document(movie_id)
            doc = doc_ref.get()
            return doc.exists
        except Exception:
            return False

    def get_existing_ids(self) -> set[str]:
        """Get set of all movie IDs in the collection.

        Returns:
            Set of movie IDs that already have details saved
        """
        try:
            docs = self.db.collection(self.COLLECTION).stream()
            return {doc.id for doc in docs}
        except Exception as e:
            logger.error(f"⚠️ Error getting existing movie IDs: {e}")
            return set()

    def get_rating_history(self, movie_id: str) -> list[dict[str, Any]]:
        """Get rating history for a movie.

        Args:
            movie_id: TIX.id movie identifier

        Returns:
            List of rating snapshots sorted by date
        """
        try:
            history_ref = (
                self.db.collection(self.COLLECTION)
                .document(movie_id)
                .collection(self.RATING_SUBCOLLECTION)
                .order_by("scraped_at")
            )
            docs = history_ref.stream()
            return [{"date": doc.id, **doc.to_dict()} for doc in docs]
        except Exception as e:
            logger.error(f"⚠️ Error getting rating history for {movie_id}: {e}")
            return []

    def save_batch(self, movie_details_list: list[MovieDetails]) -> int:
        """Save multiple movie details.

        Args:
            movie_details_list: List of MovieDetails to save

        Returns:
            Number of successfully saved movies
        """
        saved = 0
        for details in movie_details_list:
            if self.save(details):
                saved += 1
        return saved
