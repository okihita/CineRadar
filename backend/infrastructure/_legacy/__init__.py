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
    from backend.infrastructure.scrapers import TixMovieScraper

Not:
    from backend.infrastructure._legacy.tix_client import CineRadarScraper  # Legacy

NOTE: Scrapers are NOT imported here to avoid requiring playwright.
Import scrapers directly when needed:
    from backend.infrastructure._legacy.base_scraper import BaseScraper
    from backend.infrastructure._legacy.seat_scraper import SeatScraper
    from backend.infrastructure._legacy.tix_client import CineRadarScraper
"""

# Don't import scrapers here - they require playwright
# This allows firebase_client to be imported without playwright installed

