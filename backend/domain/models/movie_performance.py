"""
Movie Performance Domain Models

Represents aggregated movie performance data and individual showtime snapshots.
Used for tracking occupancy across all cities/theatres for a specific movie.
"""

import json
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any


@dataclass
class ShowtimeSnapshot:
    """Final seat snapshot for a single showtime, captured at T-8 minutes.

    Attributes:
        showtime_id: TIX.id showtime identifier
        movie_id: Movie identifier
        movie_title: Movie name
        theatre_id: Theatre identifier
        theatre_name: Theatre name
        city: City name (uppercase)
        room_category: Room type (e.g., "2D", "IMAX", "GOLD CLASS")
        merchant: Cinema chain (XXI, CGV, Cinépolis)
        showtime: Time string (HH:MM)
        date: Date string (YYYY-MM-DD)
        total_seats: Total seating capacity
        sold_seats: Number of sold/unavailable seats
        occupancy_pct: Percentage of seats sold (0-100)
        layout: Full seat map as nested list
        scraped_at: ISO timestamp when captured
    """

    showtime_id: str
    movie_id: str
    movie_title: str
    theatre_id: str
    theatre_name: str
    city: str
    room_category: str
    merchant: str
    showtime: str
    date: str
    total_seats: int
    sold_seats: int
    occupancy_pct: float
    layout: list[list[dict[str, Any]]] = field(default_factory=list)
    scraped_at: str = field(default_factory=lambda: datetime.utcnow().isoformat())

    @property
    def available_seats(self) -> int:
        """Calculate available seats."""
        return self.total_seats - self.sold_seats

    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary for Firestore storage.

        Note: layout is serialized to JSON string to avoid Firestore's
        nested array limitation.
        """
        return {
            "showtime_id": self.showtime_id,
            "movie_id": self.movie_id,
            "movie_title": self.movie_title,
            "theatre_id": self.theatre_id,
            "theatre_name": self.theatre_name,
            "city": self.city,
            "room_category": self.room_category,
            "merchant": self.merchant,
            "showtime": self.showtime,
            "date": self.date,
            "total_seats": self.total_seats,
            "sold_seats": self.sold_seats,
            "occupancy_pct": self.occupancy_pct,
            "layout_json": json.dumps(self.layout),  # Serialize to avoid nested arrays
            "scraped_at": self.scraped_at,
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "ShowtimeSnapshot":
        """Create from Firestore document."""
        # Deserialize layout from JSON string
        layout_json = data.get("layout_json", "[]")
        try:
            layout = json.loads(layout_json) if isinstance(layout_json, str) else []
        except json.JSONDecodeError:
            layout = []

        return cls(
            showtime_id=data.get("showtime_id", ""),
            movie_id=data.get("movie_id", ""),
            movie_title=data.get("movie_title", ""),
            theatre_id=data.get("theatre_id", ""),
            theatre_name=data.get("theatre_name", ""),
            city=data.get("city", ""),
            room_category=data.get("room_category", ""),
            merchant=data.get("merchant", ""),
            showtime=data.get("showtime", ""),
            date=data.get("date", ""),
            total_seats=data.get("total_seats", 0),
            sold_seats=data.get("sold_seats", 0),
            occupancy_pct=data.get("occupancy_pct", 0.0),
            layout=layout,
            scraped_at=data.get("scraped_at", ""),
        )


@dataclass
class MoviePerformance:
    """Aggregated performance data for a single movie across all showtimes.

    Updated in real-time after each showtime snapshot is captured.

    Attributes:
        movie_id: Movie identifier
        title: Movie title
        poster: Poster URL
        date: Date string (YYYY-MM-DD)
        cities: List of cities where movie is showing
        total_showtimes: Number of showtimes scraped
        avg_occupancy_pct: Average occupancy across all showtimes
        total_seats: Sum of all seats across showtimes
        total_sold: Sum of all sold seats
        last_updated: ISO timestamp of last update
    """

    movie_id: str
    title: str
    poster: str
    date: str
    cities: list[str] = field(default_factory=list)
    total_showtimes: int = 0
    avg_occupancy_pct: float = 0.0
    total_seats: int = 0
    total_sold: int = 0
    last_updated: str = field(default_factory=lambda: datetime.utcnow().isoformat())

    @property
    def cities_count(self) -> int:
        """Number of unique cities."""
        return len(self.cities)

    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary for Firestore storage."""
        return {
            "movie_id": self.movie_id,
            "title": self.title,
            "poster": self.poster,
            "date": self.date,
            "cities": self.cities,
            "total_showtimes": self.total_showtimes,
            "avg_occupancy_pct": self.avg_occupancy_pct,
            "total_seats": self.total_seats,
            "total_sold": self.total_sold,
            "last_updated": self.last_updated,
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "MoviePerformance":
        """Create from Firestore document."""
        return cls(
            movie_id=data.get("movie_id", ""),
            title=data.get("title", ""),
            poster=data.get("poster", ""),
            date=data.get("date", ""),
            cities=data.get("cities", []),
            total_showtimes=data.get("total_showtimes", 0),
            avg_occupancy_pct=data.get("avg_occupancy_pct", 0.0),
            total_seats=data.get("total_seats", 0),
            total_sold=data.get("total_sold", 0),
            last_updated=data.get("last_updated", ""),
        )
