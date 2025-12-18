"""
Scrapers Package

TIX.id scraping implementations.
"""

from backend.infrastructure.scrapers.base import BaseScraper
from backend.infrastructure.scrapers.movie_scraper import TixMovieScraper
from backend.infrastructure.scrapers.seat_scraper import TixSeatScraper

__all__ = [
    'BaseScraper',
    'TixMovieScraper',
    'TixSeatScraper',
]
