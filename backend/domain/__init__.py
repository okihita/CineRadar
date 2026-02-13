"""
CineRadar Domain Layer (The Core) 🧠

Technical Explanation:
The **Domain Layer** represents the "Business Logic" and "Entities" of the application.

- **No Dependencies**: This layer MUST NOT import from `application` or `infrastructure`. It stands alone.
- **Pure Python**: It uses standard libraries (like `dataclasses`) to define what a "Movie" or "Theatre" is.
- **Business Rules**: It contains logic inherent to the data (e.g., `showtime.is_morning`), but not logic about *how* to get that data.

Think of this as the "Dictionary" of your project. It defines the language that the rest of the application speaks.
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
    "CineRadarError",
    "DataNotFoundError",
    "FirestoreError",
    "LoginFailedError",
    "Movie",
    "Room",
    "ScrapeResult",
    "ScrapingError",
    "SeatOccupancy",
    "Showtime",
    "StorageError",
    "Theatre",
    "TheatreSchedule",
    "Token",
    "TokenExpiredError",
    "ValidationError",
]
