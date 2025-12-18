"""
Seat Occupancy Domain Model

Represents seat availability data for a showtime.
"""

from dataclasses import dataclass, field


@dataclass
class SeatGradeStats:
    """Statistics for a specific seat grade (e.g., SATIN, SWEETBOX)."""
    total: int = 0
    available: int = 0
    sold: int = 0

    @property
    def occupancy_pct(self) -> float:
        """Occupancy percentage for this grade."""
        if self.total == 0:
            return 0.0
        return round(self.sold / self.total * 100, 1)


@dataclass
class SeatOccupancy:
    """Seat occupancy data for a single showtime.

    Captured by the seat scraper to track ticket sales.

    Attributes:
        showtime_id: TIX.id showtime identifier
        movie_id: Movie identifier
        movie_title: Movie name
        theatre_id: Theatre identifier
        theatre_name: Theatre name
        city: City name
        merchant: Cinema chain
        room_category: Room type
        showtime: Time string (HH:MM)
        date: Date of showtime
        scraped_at: When occupancy was captured
        total_seats: Total seating capacity
        sold_seats: Number of sold/booked seats
        available_seats: Number of available seats
        occupancy_pct: Percentage of seats sold
        seat_grades: Breakdown by seat type

    Example:
        >>> occ = SeatOccupancy(
        ...     showtime_id="123",
        ...     total_seats=100,
        ...     sold_seats=75
        ... )
        >>> occ.occupancy_pct
        75.0
        >>> occ.is_nearly_full
        True
    """
    showtime_id: str
    movie_id: str | None = None
    movie_title: str | None = None
    theatre_id: str | None = None
    theatre_name: str | None = None
    city: str | None = None
    merchant: str | None = None
    room_category: str | None = None
    showtime: str | None = None
    date: str | None = None
    scraped_at: str | None = None
    total_seats: int = 0
    sold_seats: int = 0
    available_seats: int = 0
    occupancy_pct: float = 0.0
    seat_grades: dict[str, SeatGradeStats] = field(default_factory=dict)

    # Thresholds for occupancy categories
    NEARLY_FULL_THRESHOLD = 70.0
    LOW_OCCUPANCY_THRESHOLD = 30.0

    @property
    def is_nearly_full(self) -> bool:
        """Check if showtime is nearly sold out."""
        return self.occupancy_pct >= self.NEARLY_FULL_THRESHOLD

    @property
    def is_low_occupancy(self) -> bool:
        """Check if showtime has low ticket sales."""
        return self.occupancy_pct < self.LOW_OCCUPANCY_THRESHOLD

    @property
    def occupancy_category(self) -> str:
        """Get occupancy category."""
        if self.occupancy_pct >= 90:
            return "sold_out"
        elif self.occupancy_pct >= self.NEARLY_FULL_THRESHOLD:
            return "nearly_full"
        elif self.occupancy_pct >= self.LOW_OCCUPANCY_THRESHOLD:
            return "moderate"
        else:
            return "low"

    def calculate_occupancy(self) -> None:
        """Recalculate occupancy percentage from seat counts."""
        if self.total_seats > 0:
            self.occupancy_pct = round(self.sold_seats / self.total_seats * 100, 1)
            self.available_seats = self.total_seats - self.sold_seats

    def to_dict(self) -> dict:
        """Convert to dictionary for serialization."""
        return {
            'showtime_id': self.showtime_id,
            'movie_id': self.movie_id,
            'movie_title': self.movie_title,
            'theatre_id': self.theatre_id,
            'theatre_name': self.theatre_name,
            'city': self.city,
            'merchant': self.merchant,
            'room_category': self.room_category,
            'showtime': self.showtime,
            'date': self.date,
            'scraped_at': self.scraped_at,
            'total_seats': self.total_seats,
            'sold_seats': self.sold_seats,
            'available_seats': self.available_seats,
            'occupancy_pct': self.occupancy_pct,
            'seat_grades': {
                name: {'total': g.total, 'available': g.available, 'sold': g.sold}
                for name, g in self.seat_grades.items()
            },
        }

    @classmethod
    def from_dict(cls, data: dict) -> 'SeatOccupancy':
        """Create from dictionary."""
        seat_grades = {}
        for name, stats in data.get('seat_grades', {}).items():
            seat_grades[name] = SeatGradeStats(
                total=stats.get('total', 0),
                available=stats.get('available', 0),
                sold=stats.get('sold', 0),
            )

        return cls(
            showtime_id=data.get('showtime_id', ''),
            movie_id=data.get('movie_id'),
            movie_title=data.get('movie_title'),
            theatre_id=data.get('theatre_id'),
            theatre_name=data.get('theatre_name'),
            city=data.get('city'),
            merchant=data.get('merchant'),
            room_category=data.get('room_category'),
            showtime=data.get('showtime'),
            date=data.get('date'),
            scraped_at=data.get('scraped_at'),
            total_seats=data.get('total_seats', 0),
            sold_seats=data.get('sold_seats', 0),
            available_seats=data.get('available_seats', 0),
            occupancy_pct=data.get('occupancy_pct', 0.0),
            seat_grades=seat_grades,
        )
