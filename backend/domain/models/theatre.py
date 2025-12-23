"""
Theatre Domain Model

Represents a cinema theatre location.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    from backend.domain.models.movie import TheatreSchedule


@dataclass
class Theatre:
    """A cinema theatre location.

    Represents a physical theatre with location and capabilities.

    Attributes:
        theatre_id: TIX.id unique identifier
        name: Theatre display name
        merchant: Cinema chain (XXI, CGV, Cinépolis)
        city: City name (uppercase)
        address: Physical address
        lat: Latitude for mapping
        lng: Longitude for mapping
        place_id: Google Places ID
        room_types: Available room types (2D, IMAX, etc.)
        last_seen: Last time this theatre was seen in a scrape
        created_at: When this theatre was first added
        updated_at: Last modification time

    Example:
        >>> theatre = Theatre(
        ...     theatre_id="123",
        ...     name="ARAYA XXI",
        ...     merchant="XXI",
        ...     city="MALANG"
        ... )
        >>> theatre.has_location
        False
        >>> theatre.is_premium
        False
    """

    theatre_id: str
    name: str
    merchant: str
    city: str
    address: str | None = None
    lat: float | None = None
    lng: float | None = None
    place_id: str | None = None
    room_types: list[str] = field(default_factory=list)
    last_seen: str | None = None
    created_at: str | None = None
    updated_at: str | None = None

    # Valid merchants (for validation)
    VALID_MERCHANTS = {"XXI", "CGV", "Cinépolis", "CINEPOLIS"}

    # Premium room types
    PREMIUM_ROOMS = {"IMAX", "GOLD CLASS", "VELVET", "PREMIERE", "4DX", "SCREENX"}

    @property
    def has_location(self) -> bool:
        """Check if theatre has geocoded location."""
        return self.lat is not None and self.lng is not None

    @property
    def is_premium(self) -> bool:
        """Check if theatre has premium room types."""
        return any(room.upper() in self.PREMIUM_ROOMS for room in self.room_types)

    @property
    def display_name(self) -> str:
        """Get display name with merchant if not in name."""
        if self.merchant and self.merchant not in self.name:
            return f"{self.name} ({self.merchant})"
        return self.name

    def is_valid_merchant(self) -> bool:
        """Validate merchant is a known cinema chain."""
        return self.merchant in self.VALID_MERCHANTS

    def set_location(self, lat: float, lng: float, place_id: str | None = None) -> None:
        """Set geocoded location."""
        self.lat = lat
        self.lng = lng
        if place_id:
            self.place_id = place_id
        self.updated_at = datetime.utcnow().isoformat()

    def add_room_type(self, room_type: str) -> None:
        """Add a room type if not already present."""
        if room_type and room_type not in self.room_types:
            self.room_types.append(room_type)

    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary for serialization."""
        return {
            "theatre_id": self.theatre_id,
            "name": self.name,
            "merchant": self.merchant,
            "city": self.city,
            "address": self.address,
            "lat": self.lat,
            "lng": self.lng,
            "place_id": self.place_id,
            "room_types": self.room_types,
            "last_seen": self.last_seen,
            "created_at": self.created_at,
            "updated_at": self.updated_at,
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> Theatre:
        """Create from dictionary."""
        return cls(
            theatre_id=data.get("theatre_id", ""),
            name=data.get("name", ""),
            merchant=data.get("merchant", ""),
            city=data.get("city", "").upper(),
            address=data.get("address"),
            lat=data.get("lat"),
            lng=data.get("lng"),
            place_id=data.get("place_id"),
            room_types=data.get("room_types", []),
            last_seen=data.get("last_seen"),
            created_at=data.get("created_at"),
            updated_at=data.get("updated_at"),
        )

    @classmethod
    def from_schedule(cls, schedule: TheatreSchedule, city: str) -> Theatre:
        """Create Theatre from a TheatreSchedule (from scrape data)."""

        room_types = [room.category for room in schedule.rooms]

        return cls(
            theatre_id=schedule.theatre_id,
            name=schedule.theatre_name,
            merchant=schedule.merchant,
            city=city.upper(),
            address=schedule.address,
            room_types=room_types,
            last_seen=datetime.utcnow().isoformat(),
        )
