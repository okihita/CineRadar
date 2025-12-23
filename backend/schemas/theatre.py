"""
Theatre Schema
Validates theatre data for Firestore storage.
"""

from pydantic import BaseModel, Field, field_validator


class TheatreSchema(BaseModel):
    """Theatre location for Firestore.

    Example:
        {
            "theatre_id": "986744938815295488",
            "name": "ARAYA XXI",
            "merchant": "XXI",
            "city": "MALANG",
            "address": "Araya Mall Lt. 3",
            "lat": -7.9423,
            "lng": 112.6547,
            "room_types": ["2D", "GOLD CLASS"]
        }
    """

    theatre_id: str = Field(..., min_length=1)
    name: str = Field(..., min_length=1)
    merchant: str = Field(..., description="Cinema chain: XXI, CGV, or Cinépolis")
    city: str = Field(..., min_length=1)
    address: str | None = None
    lat: float | None = Field(None, ge=-90, le=90, description="Latitude")
    lng: float | None = Field(None, ge=-180, le=180, description="Longitude")
    place_id: str | None = Field(None, description="Google Places ID")
    room_types: list[str] = Field(default_factory=list)

    @field_validator("merchant")
    @classmethod
    def validate_merchant(cls, v):
        """Validate merchant is a known cinema chain."""
        valid = {"XXI", "CGV", "Cinépolis", "CINEPOLIS"}
        if v not in valid:
            raise ValueError(f"Unknown merchant '{v}', expected one of {valid}")
        return v

    @field_validator("city")
    @classmethod
    def uppercase_city(cls, v):
        """Ensure city is uppercase for consistency."""
        return v.upper() if v else v
