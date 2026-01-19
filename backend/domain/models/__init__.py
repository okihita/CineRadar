"""
CineRadar Domain Models

Pure Python dataclasses representing core business entities.
No external dependencies - these can be used anywhere.
"""

from backend.domain.models.movie import (
    Movie,
    Room,
    ScrapeResult,
    Showtime,
    TheatreSchedule,
)
from backend.domain.models.movie_details import (
    Cast,
    Genre,
    MovieDetails,
    RatingScore,
    Trailer,
    Video,
)
from backend.domain.models.movie_performance import (
    DailyPerformance,
    MovieMetadata,
    ShowtimeSnapshot,
)
from backend.domain.models.seat import SeatGradeStats, SeatOccupancy
from backend.domain.models.theatre import Theatre
from backend.domain.models.token import Token

__all__ = [
    "Cast",
    "DailyPerformance",
    "Genre",
    "Movie",
    "MovieDetails",
    "MovieMetadata",
    "RatingScore",
    "Room",
    "ScrapeResult",
    "SeatGradeStats",
    "SeatOccupancy",
    "Showtime",
    "ShowtimeSnapshot",
    "Theatre",
    "TheatreSchedule",
    "Token",
    "Trailer",
    "Video",
]

