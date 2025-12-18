"""
Movie Domain Models

Core business entities for movies and showtimes.
Pure Python dataclasses with no external dependencies.
"""

from dataclasses import dataclass, field


@dataclass
class Showtime:
    """A single movie showtime slot.

    Represents one screening time at a theatre.

    Attributes:
        time: Time in HH:MM format (e.g., "19:35")
        showtime_id: TIX.id unique identifier for this showtime
        status: 0=sold out, 1=available, 2=almost sold
        is_available: Whether tickets can be purchased

    Example:
        >>> st = Showtime(time="19:35", showtime_id="2000039256042586112")
        >>> st.is_evening
        True
    """
    time: str  # HH:MM format
    showtime_id: str | None = None
    status: int = 1
    is_available: bool = True

    @property
    def hour(self) -> int:
        """Extract hour from time string."""
        try:
            return int(self.time.split(':')[0])
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

    def to_dict(self) -> dict:
        """Convert to dictionary for serialization."""
        return {
            'time': self.time,
            'showtime_id': self.showtime_id,
            'status': self.status,
            'is_available': self.is_available,
        }

    @classmethod
    def from_dict(cls, data: dict) -> 'Showtime':
        """Create from dictionary."""
        return cls(
            time=data.get('time', ''),
            showtime_id=data.get('showtime_id'),
            status=data.get('status', 1),
            is_available=data.get('is_available', True),
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

    def to_dict(self) -> dict:
        """Convert to dictionary for serialization."""
        return {
            'category': self.category,
            'price': self.price,
            'all_showtimes': [st.to_dict() for st in self.showtimes],
            'showtimes': [st.time for st in self.showtimes],  # Legacy format
        }

    @classmethod
    def from_dict(cls, data: dict) -> 'Room':
        """Create from dictionary."""
        # Handle both 'all_showtimes' and legacy 'showtimes' formats
        all_showtimes = data.get('all_showtimes', [])
        if all_showtimes and isinstance(all_showtimes[0], dict):
            showtimes = [Showtime.from_dict(st) for st in all_showtimes]
        else:
            # Legacy format: just time strings
            legacy = data.get('showtimes', [])
            showtimes = [Showtime(time=t) for t in legacy if isinstance(t, str)]

        return cls(
            category=data.get('category', ''),
            price=data.get('price', ''),
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

    def to_dict(self) -> dict:
        """Convert to dictionary for serialization."""
        return {
            'theatre_id': self.theatre_id,
            'theatre_name': self.theatre_name,
            'merchant': self.merchant,
            'address': self.address,
            'rooms': [room.to_dict() for room in self.rooms],
        }

    @classmethod
    def from_dict(cls, data: dict) -> 'TheatreSchedule':
        """Create from dictionary."""
        return cls(
            theatre_id=data.get('theatre_id', ''),
            theatre_name=data.get('theatre_name', ''),
            merchant=data.get('merchant', ''),
            address=data.get('address'),
            rooms=[Room.from_dict(r) for r in data.get('rooms', [])],
        )


@dataclass
class Movie:
    """A movie with all its schedules across cities.

    The primary entity in the domain. Contains movie metadata
    and schedules organized by city.

    Attributes:
        id: TIX.id movie identifier
        title: Movie title
        genres: List of genre names
        poster: Poster image URL
        age_category: Age rating (SU, R, D, etc.)
        merchants: Cinema chains showing this movie
        is_presale: Whether this is advance ticket sales
        cities: List of cities where movie is showing
        schedules: City -> List of theatre schedules

    Example:
        >>> movie = Movie(id="123", title="Avatar")
        >>> movie.total_theatres
        0
        >>> movie.is_showing_in("JAKARTA")
        False
    """
    id: str
    title: str
    genres: list[str] = field(default_factory=list)
    poster: str | None = None
    age_category: str | None = None
    country: str | None = None
    merchants: list[str] = field(default_factory=list)
    is_presale: bool = False
    cities: list[str] = field(default_factory=list)
    schedules: dict[str, list[TheatreSchedule]] = field(default_factory=dict)

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

    def to_dict(self) -> dict:
        """Convert to dictionary for serialization."""
        return {
            'id': self.id,
            'title': self.title,
            'genres': self.genres,
            'poster': self.poster,
            'age_category': self.age_category,
            'country': self.country,
            'merchants': self.merchants,
            'is_presale': self.is_presale,
            'cities': self.cities,
            'schedules': {
                city: [ts.to_dict() for ts in theatres]
                for city, theatres in self.schedules.items()
            },
        }

    @classmethod
    def from_dict(cls, data: dict) -> 'Movie':
        """Create from dictionary."""
        schedules = {}
        for city, theatres in data.get('schedules', {}).items():
            schedules[city] = [TheatreSchedule.from_dict(t) for t in theatres]

        return cls(
            id=data.get('id', ''),
            title=data.get('title', ''),
            genres=data.get('genres', []),
            poster=data.get('poster'),
            age_category=data.get('age_category'),
            country=data.get('country'),
            merchants=data.get('merchants', []),
            is_presale=data.get('is_presale', False),
            cities=data.get('cities', []),
            schedules=schedules,
        )


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

    def to_dict(self) -> dict:
        """Convert to dictionary for serialization."""
        return {
            'scraped_at': self.scraped_at,
            'date': self.date,
            'summary': {
                'total_cities': self.cities_scraped,
                'total_movies': self.movie_count,
                'presale_count': self.presale_count,
            },
            'movies': [m.to_dict() for m in self.movies],
        }
