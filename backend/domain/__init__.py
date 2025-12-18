"""
CineRadar Domain Layer

Pure business objects with no external dependencies.
This layer contains:
- Domain models (Movie, Theatre, Token, etc.)
- Custom exceptions
- Business rules

The domain layer should NEVER import from infrastructure or application layers.
"""

from backend.domain.errors import (
    CineRadarError,
    DataNotFoundError,
    FirestoreError,
    LoginFailedError,
    ScrapingError,
    StorageError,
    TokenExpiredError,
    ValidationError,
)
from backend.domain.models import (
    Movie,
    Room,
    ScrapeResult,
    SeatOccupancy,
    Showtime,
    Theatre,
    TheatreSchedule,
    Token,
)

__all__ = [
    # Models
    'Movie',
    'Theatre',
    'Showtime',
    'Room',
    'TheatreSchedule',
    'Token',
    'ScrapeResult',
    'SeatOccupancy',
    # Errors
    'CineRadarError',
    'ScrapingError',
    'LoginFailedError',
    'TokenExpiredError',
    'ValidationError',
    'DataNotFoundError',
    'StorageError',
    'FirestoreError',
]
