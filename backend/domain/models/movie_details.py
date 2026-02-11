"""
Movie Details Domain Model

Represents detailed movie information from the TIX.id movie details API.
This is enriched data beyond the basic movie scraped during daily runs.
"""

from dataclasses import dataclass, field
from datetime import UTC, datetime
from typing import Any

from backend.utils import get_now_iso


@dataclass
class Trailer:
    """Movie trailer information."""

    type: str  # e.g., "youtube"
    key: str  # Video ID
    path: str  # Full URL
    thumbnail: str

    def to_dict(self) -> dict[str, Any]:
        return {
            "type": self.type,
            "key": self.key,
            "path": self.path,
            "thumbnail": self.thumbnail,
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "Trailer":
        return cls(
            type=data.get("type", ""),
            key=data.get("key", ""),
            path=data.get("path", ""),
            thumbnail=data.get("thumbnail", ""),
        )


@dataclass
class Cast:
    """Movie cast member."""

    name: str
    profile_photo: str
    cast_type: str  # "Director" or "Actor"
    character: str

    def to_dict(self) -> dict[str, Any]:
        return {
            "name": self.name,
            "profile_photo": self.profile_photo,
            "cast_type": self.cast_type,
            "character": self.character,
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "Cast":
        return cls(
            name=data.get("name", ""),
            profile_photo=data.get("profile_photo", ""),
            cast_type=data.get("cast_type", ""),
            character=data.get("character", ""),
        )


@dataclass
class Video:
    """Movie video (trailers, teasers, etc.)."""

    id: str
    type: str  # e.g., "youtube"
    key: str
    path: str
    thumbnail: str
    title: str

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "type": self.type,
            "key": self.key,
            "path": self.path,
            "thumbnail": self.thumbnail,
            "title": self.title,
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "Video":
        return cls(
            id=data.get("id", ""),
            type=data.get("type", ""),
            key=data.get("key", ""),
            path=data.get("path", ""),
            thumbnail=data.get("thumbnail", ""),
            title=data.get("title", ""),
        )


@dataclass
class Genre:
    """Movie genre."""

    id: str
    name: str

    def to_dict(self) -> dict[str, Any]:
        return {"id": self.id, "name": self.name}

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "Genre":
        return cls(id=data.get("id", ""), name=data.get("name", ""))


@dataclass
class RatingScore:
    """Movie rating information."""

    vote_average: float
    vote_count: int
    average_source: int
    detail: dict[str, int] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        return {
            "vote_average": self.vote_average,
            "vote_count": self.vote_count,
            "average_source": self.average_source,
            "detail": self.detail,
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "RatingScore":
        return cls(
            vote_average=data.get("vote_average", 0.0),
            vote_count=data.get("vote_count", 0),
            average_source=data.get("average_source", 0),
            detail=data.get("detail", {}),
        )


@dataclass
class MovieDetails:
    """Detailed movie information from TIX.id API.

    Contains enriched data like cast, videos, synopsis, ratings.

    Example:
        >>> details = MovieDetails.from_api_response(api_data)
        >>> print(details.name, details.director)
    """

    # Primary identifiers
    id: str
    movie_id: str
    name: str

    # Media
    trailer: Trailer | None = None
    poster_path: str = ""
    images: list[str] = field(default_factory=list)
    videos: list[Video] = field(default_factory=list)

    # Cast & crew
    casts: list[Cast] = field(default_factory=list)
    director: str = ""
    producer: str = ""
    actor: str = ""  # Comma-separated string

    # Movie info
    status: str = ""  # "NOW_PLAYING", etc.
    presale_flag: int = 0
    release_date: int = 0  # Unix timestamp
    synopsis: str = ""
    information: str = ""  # English summary
    production_company: str = ""

    # Classification
    genres: list[Genre] = field(default_factory=list)
    duration: int = 0  # Minutes
    age_category: str = ""
    age_category_message: str = ""
    country: str = ""

    # Trailers (alternative format)
    trailer_path: str = ""
    trailer_thumbnail_path: str = ""

    # Ratings
    rating_score: RatingScore | None = None

    # Metadata
    scraped_at: str = ""

    @property
    def release_datetime(self) -> datetime | None:
        """Convert release_date timestamp to datetime."""
        if self.release_date:
            return datetime.fromtimestamp(self.release_date, tz=UTC)
        return None

    @property
    def genre_names(self) -> list[str]:
        """List of genre names."""
        return [g.name for g in self.genres]

    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary for Firestore storage."""
        return {
            "id": self.id,
            "movie_id": self.movie_id,
            "name": self.name,
            "trailer": self.trailer.to_dict() if self.trailer else None,
            "poster_path": self.poster_path,
            "images": self.images,
            "videos": [v.to_dict() for v in self.videos],
            "casts": [c.to_dict() for c in self.casts],
            "director": self.director,
            "producer": self.producer,
            "actor": self.actor,
            "status": self.status,
            "presale_flag": self.presale_flag,
            "release_date": self.release_date,
            "synopsis": self.synopsis,
            "information": self.information,
            "production_company": self.production_company,
            "genres": [g.to_dict() for g in self.genres],
            "duration": self.duration,
            "age_category": self.age_category,
            "age_category_message": self.age_category_message,
            "country": self.country,
            "trailer_path": self.trailer_path,
            "trailer_thumbnail_path": self.trailer_thumbnail_path,
            "rating_score": self.rating_score.to_dict() if self.rating_score else None,
            "scraped_at": self.scraped_at,
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "MovieDetails":
        """Create from dictionary (Firestore document)."""
        trailer_data = data.get("trailer")
        rating_data = data.get("rating_score")

        return cls(
            id=data.get("id", ""),
            movie_id=data.get("movie_id", ""),
            name=data.get("name", ""),
            trailer=Trailer.from_dict(trailer_data) if trailer_data else None,
            poster_path=data.get("poster_path", ""),
            images=data.get("images", []),
            videos=[Video.from_dict(v) for v in data.get("videos", [])],
            casts=[Cast.from_dict(c) for c in data.get("casts", [])],
            director=data.get("director", ""),
            producer=data.get("producer", ""),
            actor=data.get("actor", ""),
            status=data.get("status", ""),
            presale_flag=data.get("presale_flag", 0),
            release_date=data.get("release_date", 0),
            synopsis=data.get("synopsis", ""),
            information=data.get("information", ""),
            production_company=data.get("production_company", ""),
            genres=[Genre.from_dict(g) for g in data.get("genres", [])],
            duration=data.get("duration", 0),
            age_category=data.get("age_category", ""),
            age_category_message=data.get("age_category_message", ""),
            country=data.get("country", ""),
            trailer_path=data.get("trailer_path", ""),
            trailer_thumbnail_path=data.get("trailer_thumbnail_path", ""),
            rating_score=RatingScore.from_dict(rating_data) if rating_data else None,
            scraped_at=data.get("scraped_at", ""),
        )

    @classmethod
    def from_api_response(cls, data: dict[str, Any]) -> "MovieDetails":
        """Create from TIX.id API response.

        Args:
            data: The 'data' field from API response

        Returns:
            MovieDetails instance
        """
        return cls.from_dict(
            {
                **data,
                "scraped_at": get_now_iso(),
            }
        )
