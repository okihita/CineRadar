"""Backend Services Module (Core Scrapers).

> **Note**
> This module contains the core scraping implementations.
> They are wrapped by the Clean Architecture infrastructure layer.

Current Contents:
- guest_token.py - TIX Guest Token generator
- tix_client_v2.py - V2 API Movie availability scraper

For new code, use the infrastructure layer:
    from backend.infrastructure.scrapers import TixMovieScraper

Import scrapers directly when needed:
    from backend.infrastructure.core.guest_token import fetch_guest_token
    from backend.infrastructure.core.tix_client_v2 import CineRadarScraperV2
"""
