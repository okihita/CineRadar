"""
TIX.id Movie Scraper (Deprecated)

Implements IMovieScraper interface for scraping movie data from TIX.id.
Playwright V1 scraper has been permanently removed.
"""

from typing import Any

from backend.application.ports.scraper import IMovieScraper
from backend.domain.models import Movie
from backend.infrastructure.city_data import CITIES
from backend.infrastructure.scrapers.base import BaseScraper


class TixMovieScraper(BaseScraper, IMovieScraper):
    """Legacy TIX.id implementation of movie scraping."""

    def __init__(self) -> None:
        super().__init__()
        self.cities = CITIES

    async def scrape_movies(self, *args: Any, **kwargs: Any) -> list[Movie]:
        """Deprecated."""
        raise NotImplementedError("Playwright V1 scraper has been permanently removed.")

    async def login(self) -> bool:
        """Deprecated."""
        raise NotImplementedError("Playwright V1 scraper has been permanently removed.")
