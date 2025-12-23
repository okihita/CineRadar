"""
Backend Services Module (Legacy Scrapers)

> [!NOTE]
> This module contains the core scraping implementations using Playwright.
> They are wrapped by the Clean Architecture infrastructure layer.

Current Contents:
- base_scraper.py - Base scraper with login/browser logic
- seat_scraper.py - Seat occupancy API scraper
- tix_client.py - Movie availability scraper

For new code, use the infrastructure layer:
    from backend.infrastructure.scrapers import TixMovieScraper

Import scrapers directly when needed:
    from backend.infrastructure._legacy.base_scraper import BaseScraper
    from backend.infrastructure._legacy.seat_scraper import SeatScraper
    from backend.infrastructure._legacy.tix_client import CineRadarScraper
"""

# Don't import scrapers here - they require playwright
