"""
Scraper Port Interfaces

Abstract interfaces for scraping operations.
Infrastructure layer must provide concrete implementations.
"""

from abc import ABC, abstractmethod

from backend.domain.models import Movie, SeatOccupancy


class IMovieScraper(ABC):
    """Interface for movie data scraping.

    Any movie scraping implementation (TIX.id, other sources) must implement this.

    Example implementation:
        class TixMovieScraper(IMovieScraper):
            async def scrape_movies(self, cities=None, fetch_schedules=True):
                # ... Playwright scraping logic ...
                return [Movie(...), Movie(...)]
    """

    @abstractmethod
    async def scrape_movies(
        self,
        cities: list[str] | None = None,
        fetch_schedules: bool = False,
        headless: bool = True,
    ) -> list[Movie]:
        """Scrape movie availability from external source.

        Args:
            cities: Optional list of city names to scrape. If None, scrape all.
            fetch_schedules: Whether to fetch detailed showtimes.
            headless: Run browser in headless mode.

        Returns:
            List of Movie domain objects with scraped data.

        Raises:
            ScrapingError: If scraping fails
            LoginFailedError: If authentication required and fails
        """
        pass

    @abstractmethod
    async def login(self) -> bool:
        """Authenticate with the data source.

        Returns:
            True if login successful

        Raises:
            LoginFailedError: If login fails
        """
        pass


class ISeatScraper(ABC):
    """Interface for seat occupancy scraping.

    Scrapes real-time seat availability for showtimes.
    """

    @abstractmethod
    async def scrape_seats(
        self,
        showtime_ids: list[str],
        merchant: str,
    ) -> list[SeatOccupancy]:
        """Scrape seat occupancy for given showtimes.

        Args:
            showtime_ids: List of showtime IDs to check
            merchant: Cinema chain (XXI, CGV, Cinépolis)

        Returns:
            List of SeatOccupancy domain objects

        Raises:
            ScrapingError: If scraping fails
            TokenExpiredError: If auth token is invalid
        """
        pass

    @abstractmethod
    def set_token(self, token: str) -> None:
        """Set authentication token for API calls.

        Args:
            token: JWT token string
        """
        pass
