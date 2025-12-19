"""
CineRadar Infrastructure Layer

Concrete implementations of application ports.
This layer connects to external systems:
- TIX.id (scrapers)
- Firestore (repositories)
- OpenStreetMap (geocoding)
- CLI (entry points)
"""

# Re-export for convenience
from backend.infrastructure.repositories import (
    FileMovieRepository,
    FirestoreMovieRepository,
    FirestoreTheatreRepository,
    FirestoreTokenRepository,
)
from backend.infrastructure.scrapers import TixMovieScraper, TixSeatScraper

__all__ = [
    # Scrapers
    'TixMovieScraper',
    'TixSeatScraper',
    # Repositories
    'FirestoreMovieRepository',
    'FirestoreTheatreRepository',
    'FirestoreTokenRepository',
    'FileMovieRepository',
]
