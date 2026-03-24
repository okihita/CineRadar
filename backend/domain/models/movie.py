"""Movie Domain Models.

Core business entities for movies and showtimes.
Pure Python dataclasses with no external dependencies.
"""

from dataclasses import dataclass, field
from typing import Any


@dataclass
class Showtime:
    """A single movie showtime slot.

    Represents one screening time at a theatre.

    Attributes:
        time: Time in HH:MM format (e.g., "19:35")
        showtime_id: TIX.id unique identifier for this showtime
        studio_id: Physical studio identifier (e.g., "11")
        status: 0=sold out, 1=available, 2=almost sold
        is_available: Whether tickets can be purchased

    Example:
        >>> st = Showtime(time="19:35", showtime_id="2000039256042586112", studio_id="11")
        >>> st.is_evening
        True

    """

    time: str  # HH:MM format
    showtime_id: str | None = None
    studio_id: str | None = None
    status: int = 1
    is_available: bool = True

    @property
    def hour(self) -> int:
        """Extract hour from time string."""
        try:
            return int(self.time.split(":")[0])
        except (ValueError, IndexError):
            return 0

    @property
    def is_morning(self) -> bool:
        """Check if this is a morning showtime (before noon)."""
        return self.hour < 12

    @property
    def is_evening(self) -> bool:
        """Check if this is an evening showtime (after 6 PM)."""
        return self.hour >= 18

    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary for serialization."""
        return {
            "time": self.time,
            "showtime_id": self.showtime_id,
            "studio_id": self.studio_id,
            "status": self.status,
            "is_available": self.is_available,
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> Showtime:
        """Create from dictionary."""
        return cls(
            time=data.get("time", ""),
            showtime_id=data.get("showtime_id"),
            studio_id=data.get("studio_id"),
            status=data.get("status", 1),
            is_available=data.get("is_available", True),
        )


@dataclass
class Room:
    """A cinema room/screen with showtimes.

    Represents a screening room type (e.g., 2D, IMAX, GOLD CLASS).

    Attributes:
        category: Room type name
        price: Price string (e.g., "Rp35.000")
        showtimes: List of available showtimes

    """

    category: str
    price: str
    showtimes: list[Showtime] = field(default_factory=list)

    @property
    def showtime_count(self) -> int:
        """Number of showtimes in this room."""
        return len(self.showtimes)

    @property
    def available_count(self) -> int:
        """Number of available showtimes."""
        return sum(1 for st in self.showtimes if st.is_available)

    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary for serialization."""
        return {
            "category": self.category,
            "price": self.price,
            "all_showtimes": [st.to_dict() for st in self.showtimes],
            "showtimes": [st.time for st in self.showtimes],  # Legacy format
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> Room:
        """Create from dictionary."""
        # Handle both 'all_showtimes' and legacy 'showtimes' formats
        all_showtimes = data.get("all_showtimes", [])
        if all_showtimes and isinstance(all_showtimes[0], dict):
            showtimes = [Showtime.from_dict(st) for st in all_showtimes]
        else:
            # Legacy format: just time strings
            legacy = data.get("showtimes", [])
            showtimes = [Showtime(time=t) for t in legacy if isinstance(t, str)]

        return cls(
            category=data.get("category", ""),
            price=data.get("price", ""),
            showtimes=showtimes,
        )


@dataclass
class TheatreSchedule:
    """Theatre with rooms for a specific movie.

    Represents a theatre's schedule for one movie.

    Attributes:
        theatre_id: TIX.id theatre identifier
        theatre_name: Display name
        merchant: Cinema chain (XXI, CGV, Cinépolis)
        address: Physical address
        rooms: Available screening rooms

    """

    theatre_id: str
    theatre_name: str
    merchant: str
    address: str | None = None
    rooms: list[Room] = field(default_factory=list)

    @property
    def total_showtimes(self) -> int:
        """Total showtimes across all rooms."""
        return sum(room.showtime_count for room in self.rooms)

    @property
    def room_categories(self) -> list[str]:
        """List of room categories available."""
        return [room.category for room in self.rooms]

    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary for serialization."""
        return {
            "theatre_id": self.theatre_id,
            "theatre_name": self.theatre_name,
            "merchant": self.merchant,
            "address": self.address,
            "rooms": [room.to_dict() for room in self.rooms],
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> TheatreSchedule:
        """Create from dictionary."""
        return cls(
            theatre_id=data.get("theatre_id", ""),
            theatre_name=data.get("theatre_name", ""),
            merchant=data.get("merchant", ""),
            address=data.get("address"),
            rooms=[Room.from_dict(r) for r in data.get("rooms", [])],
        )


@dataclass
class MovieSchedule:
    """A movie's schedule allocation for a specific date.

    This represents WHERE and WHEN a movie is showing, not the movie itself.
    The same movie can have different schedule allocations across cinema chains.

    TIX.id uses a dual-ID system:
    - schedule_id: Changes when movie moves between cinema chains; used for showtime queries
    - metadata_id: Immutable movie entity identifier; used for movie details

    Attributes:
        schedule_id: TIX.id schedule allocation ID (was 'id')
        title: Movie title
        metadata_id: TIX.id movie entity ID (was 'tix_metadata_id')
        genres: List of genre names
        poster: Poster image URL
        age_category: Age rating (SU, R, D, etc.)
        merchants: Cinema chains showing this movie on this date
        is_presale: Whether this is advance ticket sales
        cities: List of cities where movie is showing on this date
        schedules: City -> List of theatre schedules

    Example:
        >>> schedule = MovieSchedule(
        ...     schedule_id="1996107175268794368",
        ...     metadata_id="1996107160261574656",
        ...     title="Avatar"
        ... )
        >>> schedule.total_theatres
        0
        >>> schedule.is_showing_in("JAKARTA")
        False

    """

    schedule_id: str  # TIX schedule allocation ID (was 'id')
    title: str
    metadata_id: str | None = None  # TIX movie entity ID (was 'tix_metadata_id')
    genres: list[str] = field(default_factory=list)
    poster: str | None = None
    age_category: str | None = None
    country: str | None = None
    merchants: list[str] = field(default_factory=list)
    is_presale: bool = False
    cities: list[str] = field(default_factory=list)
    schedules: dict[str, list[TheatreSchedule]] = field(default_factory=dict)

    # Backward compatibility: allow 'id' as alias for 'schedule_id'
    @property
    def id(self) -> str:
        """Backward compatibility alias for schedule_id."""
        return self.schedule_id

    # Backward compatibility: allow 'tix_metadata_id' as alias for 'metadata_id'
    @property
    def tix_metadata_id(self) -> str | None:
        """Backward compatibility alias for metadata_id."""
        return self.metadata_id

    @property
    def total_theatres(self) -> int:
        """Total theatres showing this movie."""
        return sum(len(theatres) for theatres in self.schedules.values())

    @property
    def city_count(self) -> int:
        """Number of cities where movie is showing."""
        return len(self.cities) if self.cities else len(self.schedules)

    def is_showing_in(self, city: str) -> bool:
        """Check if movie is showing in a city."""
        city_upper = city.upper()
        return city_upper in self.cities or city_upper in self.schedules

    def get_schedules_for_city(self, city: str) -> list[TheatreSchedule]:
        """Get schedules for a specific city."""
        return self.schedules.get(city.upper(), [])

    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary for serialization.

        Uses new field names but includes backward-compatible aliases.
        """
        return {
            # New field names (preferred)
            "schedule_id": self.schedule_id,
            "metadata_id": self.metadata_id,
            # Backward compatibility aliases
            "id": self.schedule_id,
            "tix_metadata_id": self.metadata_id,
            # Other fields
            "title": self.title,
            "genres": self.genres,
            "poster": self.poster,
            "age_category": self.age_category,
            "country": self.country,
            "merchants": self.merchants,
            "is_presale": self.is_presale,
            "cities": self.cities,
            "schedules": {
                city: [ts.to_dict() for ts in theatres] for city, theatres in self.schedules.items()
            },
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> MovieSchedule:
        """Create from dictionary.

        Accepts both new field names and legacy field names for backward compatibility.
        """
        schedules = {}
        for city, theatres in data.get("schedules", {}).items():
            schedules[city] = [TheatreSchedule.from_dict(t) for t in theatres]

        # Support both new and legacy field names
        schedule_id = data.get("schedule_id") or data.get("id", "")
        metadata_id = data.get("metadata_id") or data.get("tix_metadata_id")

        return cls(
            schedule_id=schedule_id,
            title=data.get("title", ""),
            metadata_id=metadata_id,
            genres=data.get("genres", []),
            poster=data.get("poster"),
            age_category=data.get("age_category"),
            country=data.get("country"),
            merchants=data.get("merchants", []),
            is_presale=data.get("is_presale", False),
            cities=data.get("cities", []),
            schedules=schedules,
        )


# Backward compatibility alias
Movie = MovieSchedule


@dataclass
class ScrapeResult:
    """Result of a scraping operation.

    Contains scraped movies plus metadata about the scrape.
    """

    movies: list[Movie]
    scraped_at: str
    date: str
    cities_scraped: int = 0
    success: bool = True
    error: str | None = None

    @property
    def movie_count(self) -> int:
        """Number of movies scraped."""
        return len(self.movies)

    @property
    def presale_count(self) -> int:
        """Number of presale movies."""
        return sum(1 for m in self.movies if m.is_presale)

    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary for serialization."""
        return {
            "scraped_at": self.scraped_at,
            "date": self.date,
            "summary": {
                "total_cities": self.cities_scraped,
                "total_movies": self.movie_count,
                "presale_count": self.presale_count,
            },
            "movies": [m.to_dict() for m in self.movies],
        }
