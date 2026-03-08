"""TIX.id API Response Schemas
Validates and parses JSON responses from TIX.id B2B API.
"""

from pydantic import BaseModel, Field


class TixMovieGenre(BaseModel):
    """Movie genre definition."""

    id: str
    name: str


class TixMerchant(BaseModel):
    """Cinema merchant definition (e.g., XXI, CGV)."""

    merchant_id: str
    merchant_name: str
    sort: int | None = None


class TixMovieItem(BaseModel):
    """Movie item from the /v1/movies endpoint."""

    id: str = Field(..., description="Schedule ID used to fetch schedules")
    title: str
    genres: list[TixMovieGenre] = Field(default_factory=list)
    poster_path: str = ""
    age_category: str = ""
    presale_flag: int = 0
    rating_score: float = 0.0
    score_home_display: bool = False
    movie_id: str = Field("", description="Entity ID used for movie metadata")
    merchant: list[TixMerchant] = Field(default_factory=list)
    country: str = ""


class TixMovieResponse(BaseModel):
    """Response wrapper for /v1/movies."""

    success: bool
    data: list[TixMovieItem] = Field(default_factory=list)


class TixScheduleDateItem(BaseModel):
    """Available dates for a specific schedule."""

    date: str
    is_any_schedule: bool


class TixScheduleDateResponse(BaseModel):
    """Response wrapper for /v1/schedules/date."""

    success: bool
    data: list[TixScheduleDateItem] = Field(default_factory=list)


class TixLocation(BaseModel):
    """Geographic location of a theatre."""

    latitude: str | None = None
    longitude: str | None = None


class TixShowTime(BaseModel):
    """Single showtime for a movie in a theatre."""

    id: str
    time: int
    display_time: str
    studio: str = ""
    expired: int = 0
    status: int
    studio_type: str = ""
    price: int = 0


class TixPriceGroup(BaseModel):
    """Group of showtimes sharing the same price and category."""

    category: str
    low_price: int = 0
    high_price: int = 0
    price_string: str = ""
    show_time: list[TixShowTime] = Field(default_factory=list)


class TixTheatre(BaseModel):
    """Theatre schedules from /v1/schedules/movies endpoint."""

    id: str
    name: str
    type: int = 0
    presale_flag: int = 0
    merchant: TixMerchant | None = None
    address: str = ""
    location: TixLocation | None = None
    price_groups: list[TixPriceGroup] = Field(default_factory=list)


class TixSchedulesData(BaseModel):
    """Data payload for schedules."""

    has_next: bool = False
    page: int = 1
    show_date: int = 0
    theaters: list[TixTheatre] = Field(default_factory=list)


class TixSchedulesResponse(BaseModel):
    """Response wrapper for /v1/schedules/movies."""

    success: bool
    data: TixSchedulesData | None = None
