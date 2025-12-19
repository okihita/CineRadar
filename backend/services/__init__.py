"""
Backend Services Module (Legacy Adapters)

> [!NOTE]
> This module contains the original scraping implementations.
> They are now wrapped by the Clean Architecture infrastructure layer.

These files are kept for backwards compatibility and as the core
scraping implementation. The infrastructure layer delegates to these.

Migration Path:
1. infrastructure/scrapers/movie_scraper.py calls services/tix_client.py
2. infrastructure/scrapers/seat_scraper.py calls services/seat_scraper.py

For new code, use the infrastructure layer:
    from backend.infrastructure import TixMovieScraper

Not:
    from backend.services.tix_client import CineRadarScraper  # Legacy
"""

from backend.services.base_scraper import BaseScraper as LegacyBaseScraper
from backend.services.seat_scraper import SeatScraper
from backend.services.tix_client import CineRadarScraper

__all__ = [
    'CineRadarScraper',
    'SeatScraper',
    'LegacyBaseScraper',
]
