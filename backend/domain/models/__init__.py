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
from backend.domain.models.seat import SeatGradeStats, SeatOccupancy
from backend.domain.models.theatre import Theatre
from backend.domain.models.token import Token

__all__ = [
    'Showtime',
    'Room',
    'TheatreSchedule',
    'Movie',
    'ScrapeResult',
    'Theatre',
    'Token',
    'SeatOccupancy',
    'SeatGradeStats',
]
