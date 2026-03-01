"""
CineRadar Application Layer

Use cases and port interfaces.
This layer orchestrates business logic using domain objects.

Ports: Abstract interfaces that infrastructure must implement
Use Cases: Application-specific business rules
"""

from backend.application.ports import (
    IMovieRepository,
    IMovieScraper,
    ISeatScraper,
    ITheatreRepository,
    ITokenRepository,
)

__all__ = [
    "IMovieRepository",
    # Ports (interfaces)
    "IMovieScraper",
    "ISeatScraper",
    "ITheatreRepository",
    "ITokenRepository",
]
