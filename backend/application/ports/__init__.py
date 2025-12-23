"""
CineRadar Application Ports (Interfaces)

Abstract base classes that define contracts for infrastructure implementations.
Following the Ports & Adapters (Hexagonal) architecture pattern.
"""

from backend.application.ports.scraper import IMovieScraper, ISeatScraper
from backend.application.ports.services import IGeocodingService
from backend.application.ports.storage import IMovieRepository, ITheatreRepository, ITokenRepository

__all__ = [
    "IMovieScraper",
    "ISeatScraper",
    "IMovieRepository",
    "ITheatreRepository",
    "ITokenRepository",
    "IGeocodingService",
]
