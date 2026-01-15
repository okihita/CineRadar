"""
Firestore Movie Repository

Implements IMovieRepository using Firebase Firestore.
"""

from typing import Any

from backend.application.ports.storage import IMovieRepository
from backend.domain.models import Movie, ScrapeResult
from backend.infrastructure.repositories.firestore_token import _get_firestore_client


class FirestoreMovieRepository(IMovieRepository):
    """Firestore implementation of movie storage.

    Stores daily movie snapshots in the snapshots collection.

    Example:
        repo = FirestoreMovieRepository()

        # Save snapshot
        result = ScrapeResult(movies=[...], scraped_at="...", date="2025-12-18")
        repo.save_snapshot(result)

        # Get latest
        latest = repo.get_latest_snapshot()
    """

    COLLECTION = "snapshots"
    LATEST_DOC = "latest"

    def __init__(self) -> None:
        self._db = None

    @property
    def db(self) -> Any:
        if self._db is None:
            self._db = _get_firestore_client()
        return self._db

    def save_snapshot(self, result: ScrapeResult) -> bool:
        """Save a daily movie snapshot.

        Saves to both a dated document and updates 'latest'.

        Args:
            result: ScrapeResult containing movies and metadata

        Returns:
            True if save successful
        """
        try:
            data = result.to_dict()

            # Add city_stats
            city_stats: dict[str, int] = {}
            for movie in result.movies:
                for city in movie.cities:
                    city_stats[city] = city_stats.get(city, 0) + 1
            data["city_stats"] = city_stats

            # Calculate theatre counts per movie
            for movie_data in data["movies"]:
                theatre_counts = {}
                movie = Movie.from_dict(movie_data)
                for city, schedules in movie.schedules.items():
                    theatre_counts[city] = len(schedules)
                movie_data["theatre_counts"] = theatre_counts

            # Save to dated document
            date_doc = self.db.collection(self.COLLECTION).document(result.date)
            date_doc.set(data)

            # Update latest
            latest_doc = self.db.collection(self.COLLECTION).document(self.LATEST_DOC)
            latest_doc.set(data)

            return True

        except Exception as e:
            print(f"⚠️ Error saving snapshot: {e}")
            return False

    def get_latest_snapshot(self) -> ScrapeResult | None:
        """Get the most recent movie snapshot.

        Returns:
            ScrapeResult or None if no snapshots exist
        """
        try:
            doc_ref = self.db.collection(self.COLLECTION).document(self.LATEST_DOC)
            doc = doc_ref.get()

            if not doc.exists:
                return None

            data = doc.to_dict()
            return self._dict_to_result(data)

        except Exception as e:
            print(f"⚠️ Error getting latest snapshot: {e}")
            return None

    def get_snapshot_by_date(self, date: str) -> ScrapeResult | None:
        """Get snapshot for a specific date.

        Args:
            date: Date string in YYYY-MM-DD format

        Returns:
            ScrapeResult or None if not found
        """
        try:
            doc_ref = self.db.collection(self.COLLECTION).document(date)
            doc = doc_ref.get()

            if not doc.exists:
                return None

            data = doc.to_dict()
            return self._dict_to_result(data)

        except Exception as e:
            print(f"⚠️ Error getting snapshot for {date}: {e}")
            return None

    def _dict_to_result(self, data: dict) -> ScrapeResult:
        """Convert Firestore dict to ScrapeResult."""
        movies = [Movie.from_dict(m) for m in data.get("movies", [])]

        return ScrapeResult(
            movies=movies,
            scraped_at=data.get("scraped_at", ""),
            date=data.get("date", ""),
            cities_scraped=len(data.get("city_stats", {})),
            success=True,
        )
