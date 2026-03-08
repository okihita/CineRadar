"""Movie Details Schemas.

Pydantic schemas for validating TIX.id movie details API responses.
"""

from pydantic import BaseModel, Field


class TrailerSchema(BaseModel):
    """Trailer information."""

    type: str = ""
    key: str = ""
    path: str = ""
    thumbnail: str = ""


class CastSchema(BaseModel):
    """Cast member information."""

    name: str = ""
    profile_photo: str = ""
    cast_type: str = Field(default="", description="Director or Actor")
    character: str = ""


class VideoSchema(BaseModel):
    """Video information (trailers, teasers)."""

    id: str = ""
    type: str = ""
    key: str = ""
    path: str = ""
    thumbnail: str = ""
    title: str = ""


class GenreSchema(BaseModel):
    """Genre information."""

    id: str = ""
    name: str = ""


class RatingScoreSchema(BaseModel):
    """Rating information."""

    vote_average: float = 0.0
    vote_count: int = 0
    average_source: int = 0
    detail: dict[str, int] = Field(default_factory=dict)


class MovieDetailsDataSchema(BaseModel):
    """The 'data' field from movie details API response."""

    id: str = Field(..., min_length=1)
    movie_id: str = Field(..., min_length=1)
    name: str = Field(..., min_length=1)
    trailer: TrailerSchema | None = None
    poster_path: str = ""
    casts: list[CastSchema] = Field(default_factory=list)
    images: list[str] = Field(default_factory=list)
    videos: list[VideoSchema] = Field(default_factory=list)
    status: str = ""
    presale_flag: int = 0
    release_date: int = 0
    synopsis: str = ""
    production_company: str = ""
    actor: str = ""
    genres: list[GenreSchema] = Field(default_factory=list)
    duration: int = 0
    trailer_path: str = ""
    trailer_thumbnail_path: str = ""
    producer: str = ""
    director: str = ""
    age_category: str = ""
    age_category_message: str = ""
    information: str = ""
    rating_score: RatingScoreSchema | None = None
    country: str = ""


class MovieDetailsResponseSchema(BaseModel):
    """Full API response from movie details endpoint."""

    success: bool
    data: MovieDetailsDataSchema
