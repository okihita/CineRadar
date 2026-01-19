"""
Movie Performance Domain Models

Represents aggregated movie performance data and individual showtime snapshots.
Used for tracking occupancy across all cities/theatres for a specific movie.
"""

import gzip
import json
from dataclasses import dataclass, field
from datetime import UTC, datetime
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
    scraped_at: str = field(default_factory=lambda: datetime.now(UTC).isoformat())

    @property
    def available_seats(self) -> int:
        """Calculate available seats."""
        return self.total_seats - self.sold_seats

    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary for Firestore storage.

        Note: layout is gzip-compressed to reduce storage by ~70%.
        Uses 'layout_compressed' field (bytes) instead of 'layout_json' (string).
        """
        # Compress layout to bytes (reduces ~10.8KB to ~3.2KB)
        layout_json_str = json.dumps(self.layout)
        layout_compressed = gzip.compress(layout_json_str.encode("utf-8"))

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
            "layout_compressed": layout_compressed,  # gzip bytes (~3.2KB)
            "scraped_at": self.scraped_at,
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "ShowtimeSnapshot":
        """Create from Firestore document.

        Supports both new compressed format and legacy layout_json.
        """
        # Try compressed format first (new), fall back to legacy JSON string
        layout_compressed = data.get("layout_compressed")
        layout_json = data.get("layout_json", "[]")

        try:
            if layout_compressed:
                # Decompress gzip bytes
                layout_json_str = gzip.decompress(layout_compressed).decode("utf-8")
                layout = json.loads(layout_json_str)
            elif isinstance(layout_json, str):
                # Legacy format: JSON string
                layout = json.loads(layout_json)
            else:
                layout = []
        except (json.JSONDecodeError, gzip.BadGzipFile, OSError):
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
class MovieMetadata:
    """Static movie details for the root collection.

    Collection: movie_performance
    Document ID: movie_id
    """

    movie_id: str
    title: str
    poster: str
    age_category: str | None = None
    last_updated: str = field(default_factory=lambda: datetime.now(UTC).isoformat())

    def to_dict(self) -> dict[str, Any]:
        return {
            "movie_id": self.movie_id,
            "title": self.title,
            "poster": self.poster,
            "age_category": self.age_category,
            "last_updated": self.last_updated,
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "MovieMetadata":
        return cls(
            movie_id=data.get("movie_id", ""),
            title=data.get("title", ""),
            poster=data.get("poster", ""),
            age_category=data.get("age_category"),
            last_updated=data.get("last_updated", ""),
        )


@dataclass
class DailyPerformance:
    """Daily performance stats for a movie.

    Collection: movie_performance/{movie_id}/days
    Document ID: YYYY-MM-DD
    """

    date: str
    total_showtimes: int = 0
    total_showtimes_scraped: int = 0
    total_seats: int = 0
    total_sold: int = 0
    avg_occupancy_pct: float = 0.0
    cities: list[str] = field(default_factory=list)
    last_updated: str = field(default_factory=lambda: datetime.now(UTC).isoformat())

    def to_dict(self) -> dict[str, Any]:
        return {
            "date": self.date,
            "total_showtimes": self.total_showtimes,
            "total_showtimes_scraped": self.total_showtimes_scraped,
            "total_seats": self.total_seats,
            "total_sold": self.total_sold,
            "avg_occupancy_pct": self.avg_occupancy_pct,
            "cities": self.cities,
            "last_updated": self.last_updated,
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "DailyPerformance":
        return cls(
            date=data.get("date", ""),
            total_showtimes=data.get("total_showtimes", 0),
            total_showtimes_scraped=data.get("total_showtimes_scraped", 0),
            total_seats=data.get("total_seats", 0),
            total_sold=data.get("total_sold", 0),
            avg_occupancy_pct=data.get("avg_occupancy_pct", 0.0),
            cities=data.get("cities", []),
            last_updated=data.get("last_updated", ""),
        )
