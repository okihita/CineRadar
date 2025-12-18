"""
Storage Port Interfaces (Repositories)

Abstract interfaces for data persistence.
Follows the Repository pattern - abstracts storage details from business logic.
"""

from abc import ABC, abstractmethod

from backend.domain.models import ScrapeResult, Theatre, Token


class IMovieRepository(ABC):
    """Interface for movie data persistence.

    Handles saving and retrieving movie snapshots.
    Could be implemented by Firestore, PostgreSQL, local files, etc.
    """

    @abstractmethod
    def save_snapshot(self, result: ScrapeResult) -> bool:
        """Save a daily movie snapshot.

        Args:
            result: ScrapeResult containing movies and metadata

        Returns:
            True if save successful

        Raises:
            StorageError: If save fails
        """
        pass

    @abstractmethod
    def get_latest_snapshot(self) -> ScrapeResult | None:
        """Get the most recent movie snapshot.

        Returns:
            ScrapeResult or None if no snapshots exist

        Raises:
            StorageError: If retrieval fails
        """
        pass

    @abstractmethod
    def get_snapshot_by_date(self, date: str) -> ScrapeResult | None:
        """Get snapshot for a specific date.

        Args:
            date: Date string in YYYY-MM-DD format

        Returns:
            ScrapeResult or None if not found
        """
        pass


class ITheatreRepository(ABC):
    """Interface for theatre data persistence.

    Manages the theatre database with geocoding information.
    """

    @abstractmethod
    def upsert(self, theatre: Theatre) -> bool:
        """Insert or update a theatre.

        If theatre exists (by theatre_id), merge room_types and update fields.
        Otherwise, create new record.

        Args:
            theatre: Theatre domain object

        Returns:
            True if operation successful

        Raises:
            StorageError: If operation fails
        """
        pass

    @abstractmethod
    def get_by_id(self, theatre_id: str) -> Theatre | None:
        """Get theatre by ID.

        Args:
            theatre_id: TIX.id theatre identifier

        Returns:
            Theatre or None if not found
        """
        pass

    @abstractmethod
    def get_all(self) -> list[Theatre]:
        """Get all theatres.

        Returns:
            List of all Theatre objects
        """
        pass

    @abstractmethod
    def get_by_city(self, city: str) -> list[Theatre]:
        """Get theatres in a specific city.

        Args:
            city: City name (case-insensitive)

        Returns:
            List of theatres in that city
        """
        pass

    @abstractmethod
    def get_without_location(self) -> list[Theatre]:
        """Get theatres that haven't been geocoded.

        Returns:
            List of theatres with no lat/lng
        """
        pass

    @abstractmethod
    def update_location(
        self,
        theatre_id: str,
        lat: float,
        lng: float,
        place_id: str = None
    ) -> bool:
        """Update theatre location.

        Args:
            theatre_id: Theatre identifier
            lat: Latitude
            lng: Longitude
            place_id: Optional Google Places ID

        Returns:
            True if update successful
        """
        pass


class ITokenRepository(ABC):
    """Interface for token persistence.

    Manages JWT token storage for API authentication.
    """

    @abstractmethod
    def store(self, token: Token) -> bool:
        """Store a token.

        Args:
            token: Token domain object

        Returns:
            True if stored successfully

        Raises:
            StorageError: If store fails
        """
        pass

    @abstractmethod
    def get_current(self) -> Token | None:
        """Get the current stored token.

        Returns:
            Token or None if no token stored
        """
        pass

    @abstractmethod
    def is_valid(self) -> bool:
        """Check if stored token is still valid.

        Returns:
            True if token exists and not expired
        """
        pass

    @abstractmethod
    def delete(self) -> bool:
        """Delete the stored token.

        Returns:
            True if deleted successfully
        """
        pass


class IScraperRunRepository(ABC):
    """Interface for scraper run logging.

    Tracks scraper execution history for monitoring.
    """

    @abstractmethod
    def log_run(
        self,
        status: str,
        movies: int,
        theatres: int,
        cities: int,
        error: str = None,
    ) -> bool:
        """Log a scraper run.

        Args:
            status: 'success', 'partial', or 'failed'
            movies: Number of movies scraped
            theatres: Number of theatres synced
            cities: Number of cities covered
            error: Error message if failed

        Returns:
            True if logged successfully
        """
        pass

    @abstractmethod
    def get_recent_runs(self, limit: int = 10) -> list[dict]:
        """Get recent scraper runs.

        Args:
            limit: Maximum runs to return

        Returns:
            List of run records, most recent first
        """
        pass
