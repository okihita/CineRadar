"""
CineRadar TIX.id Scraper Client
Core scraping logic for movie availability and showtimes.

NOTE: Playwright V1 scraper has been permanently removed.
"""

from typing import Any

from backend.infrastructure.city_data import CITIES
from backend.infrastructure.scrapers.base import BaseScraper


class CineRadarScraper(BaseScraper):
    """Legacy Movie availability scraper for TIX.id (Deprecated)"""

    def __init__(self) -> None:
        super().__init__()
        self.cities = CITIES

    async def scrape(self, *args: Any, **kwargs: Any) -> dict[str, Any]:
        """Deprecated."""
        raise NotImplementedError("Playwright V1 scraper has been permanently removed.")
