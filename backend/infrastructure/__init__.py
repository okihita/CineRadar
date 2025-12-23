"""
CineRadar Infrastructure Layer

Concrete implementations of application ports.
This layer connects to external systems:
- TIX.id (scrapers)
- Firestore (repositories)
- OpenStreetMap (geocoding)
- CLI (entry points)
"""

# Re-export repositories for convenience
# NOTE: Scrapers are NOT imported here to avoid requiring playwright
# Import scrapers directly: from backend.infrastructure.scrapers import TixMovieScraper
from backend.infrastructure.repositories import (
    FileMovieRepository,
    FirestoreMovieRepository,
    FirestoreTheatreRepository,
    FirestoreTokenRepository,
)

__all__ = [
    # Repositories
    'FirestoreMovieRepository',
    'FirestoreTheatreRepository',
    'FirestoreTokenRepository',
    'FileMovieRepository',
]
