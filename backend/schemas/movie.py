"""
Movie and Showtime Schemas
Validates movie data from TIX.id scraper output.
"""
from pydantic import BaseModel, Field, field_validator
from typing import List, Dict, Optional


class ShowtimeSchema(BaseModel):
    """Single showtime slot.
    
    Example:
        {"time": "19:35", "showtime_id": "2000039256042586112", "status": 1, "is_available": true}
    
    Note: showtime_id may be missing in some batch files but should exist in final merged output.
    """
    time: str = Field(..., pattern=r'^\d{2}:\d{2}$', description="Time in HH:MM format")
    showtime_id: Optional[str] = Field(None, description="Unique showtime identifier (optional in batches)")
    status: int = Field(ge=0, le=2, description="0=sold out, 1=available, 2=almost sold")
    is_available: bool


class RoomSchema(BaseModel):
    """Cinema room/screen with showtimes.
    
    Example:
        {"category": "2D", "price": "Rp35.000", "all_showtimes": [...]}
    """
    category: str = Field(..., min_length=1, description="Room type: 2D, IMAX, GOLD CLASS, etc.")
    price: str = Field(..., description="Price string like 'Rp35.000'")
    all_showtimes: List[ShowtimeSchema] = Field(default_factory=list)
    showtimes: List[str] = Field(default_factory=list, description="Legacy field for backwards compat")

    @field_validator('all_showtimes', mode='before')
    @classmethod
    def ensure_list(cls, v):
        """Handle None or missing all_showtimes."""
        return v if v else []


class TheatreScheduleSchema(BaseModel):
    """Theatre with available rooms/times for a specific movie.
    
    Example:
        {"theatre_id": "986744938815295488", "theatre_name": "ARAYA XXI", "merchant": "XXI", "rooms": [...]}
    """
    theatre_id: str = Field(..., min_length=1)
    theatre_name: str = Field(..., min_length=1)
    merchant: str = Field(..., description="Cinema chain: XXI, CGV, or Cinépolis")
    address: Optional[str] = None
    rooms: List[RoomSchema] = Field(default_factory=list)

    @field_validator('merchant')
    @classmethod
    def validate_merchant(cls, v):
        """Validate merchant is a known cinema chain."""
        valid = {'XXI', 'CGV', 'Cinépolis', 'CINEPOLIS'}
        if v not in valid:
            raise ValueError(f"Unknown merchant '{v}', expected one of {valid}")
        return v


class MovieSchema(BaseModel):
    """Complete movie with all schedules across cities.
    
    This is the primary data unit from the scraper.
    """
    id: str = Field(..., min_length=1, description="TIX.id movie ID")
    title: str = Field(..., min_length=1)
    genres: List[str] = Field(default_factory=list)
    poster: Optional[str] = None
    age_category: Optional[str] = None
    country: Optional[str] = None
    merchants: List[str] = Field(default_factory=list)
    is_presale: bool = False
    cities: List[str] = Field(default_factory=list)
    schedules: Dict[str, List[TheatreScheduleSchema]] = Field(default_factory=dict)

    @field_validator('id')
    @classmethod
    def id_not_empty(cls, v):
        if not v or not v.strip():
            raise ValueError('Movie ID cannot be empty')
        return v


class SummarySchema(BaseModel):
    """Summary statistics from a scrape run."""
    total_cities: int = Field(ge=0, default=0)
    total_movies: int = Field(ge=0, default=0)
    presale_count: int = Field(ge=0, default=0)


class DailySnapshotSchema(BaseModel):
    """Full daily scrape output - the main validation target.
    
    This schema validates the entire merged output before Firestore upload.
    Batch files may not have summary - it's added during merge.
    """
    scraped_at: str = Field(..., description="ISO timestamp of scrape completion")
    date: str = Field(..., pattern=r'^\d{4}-\d{2}-\d{2}$', description="Date in YYYY-MM-DD format")
    summary: Optional[SummarySchema] = Field(default_factory=SummarySchema, description="Summary stats (optional in batches)")
    movies: List[MovieSchema] = Field(..., min_length=1, description="At least 1 movie expected")
    city_stats: Dict[str, int] = Field(default_factory=dict)
    batch: Optional[int] = Field(None, description="Batch number if this is a batch file")

    def integrity_check(self, min_movies: int = 10, min_cities: int = 50) -> None:
        """Run integrity assertions.
        
        Raises:
            AssertionError: If minimum thresholds not met
        """
        assert len(self.movies) >= min_movies, f"Too few movies: {len(self.movies)} < {min_movies}"
        assert len(self.city_stats) >= min_cities, f"Too few cities: {len(self.city_stats)} < {min_cities}"
