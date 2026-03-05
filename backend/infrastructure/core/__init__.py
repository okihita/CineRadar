"""
Backend Services Module (Core Scrapers)

> **Note**
> This module contains the core scraping implementations.
> They are wrapped by the Clean Architecture infrastructure layer.

Current Contents:
- seat_scraper.py - Seat occupancy API scraper
- tix_client.py - Movie availability scraper

For new code, use the infrastructure layer:
    from backend.infrastructure.scrapers import TixMovieScraper

Import scrapers directly when needed:
    from backend.infrastructure.core.seat_scraper import SeatScraper
    from backend.infrastructure.core.tix_client import CineRadarScraper
"""

