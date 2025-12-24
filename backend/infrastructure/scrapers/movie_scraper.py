"""
TIX.id Movie Scraper

Implements IMovieScraper interface for scraping movie data from TIX.id.
This is the concrete implementation that contains the actual scraping logic.
"""

from backend.application.ports.scraper import IMovieScraper
from backend.config import CITIES
from backend.domain.models import Movie
from backend.infrastructure.scrapers.base import BaseScraper


class TixMovieScraper(BaseScraper, IMovieScraper):
    """TIX.id implementation of movie scraping.

    Scrapes movie availability and showtimes from app.tix.id.

    Example:
        scraper = TixMovieScraper()
        movies = await scraper.scrape_movies(
            cities=['JAKARTA', 'BANDUNG'],
            fetch_schedules=True
        )
    """

    def __init__(self):
        super().__init__()
        self.cities = CITIES

    async def scrape_movies(
        self,
        cities: list[str] | None = None,
        fetch_schedules: bool = False,
        headless: bool = True,
    ) -> list[Movie]:
        """Scrape movie availability from TIX.id.

        This is the main interface method required by IMovieScraper.

        Args:
            cities: Optional list of city names to scrape
            fetch_schedules: Whether to fetch detailed showtimes
            headless: Run browser in headless mode

        Returns:
            List of Movie domain objects
        """
        # Filter cities if specified
        if cities:
            cities_to_scrape = [c for c in self.cities if c["name"] in cities]
        else:
            cities_to_scrape = self.cities

        # Use the legacy scraper for now
        # TODO: Migrate full scraping logic here
        from backend.infrastructure.core.tix_client import CineRadarScraper

        legacy_scraper = CineRadarScraper()
        result = await legacy_scraper.scrape(
            headless=headless,
            city_names=[c["name"] for c in cities_to_scrape],
            fetch_schedules=fetch_schedules,
        )

        if not result or not result.get("movies"):
            return []

        # Convert legacy dict format to domain objects
        movies = []
        for movie_data in result.get("movies", []):
            movie = Movie.from_dict(movie_data)
            movies.append(movie)

        return movies

    async def login(self) -> bool:
        """Authenticate with TIX.id.

        Returns:
            True if login successful
        """
        playwright, browser, context, page = await self._init_browser(headless=True)

        try:
            success = await self._login(page)
            return success
        finally:
            await self._close_browser(playwright, browser, context, page)
