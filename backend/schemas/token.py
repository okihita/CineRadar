"""
Token Schema
Validates JWT tokens with TTL checking for TIX.id API authentication.
"""

from datetime import datetime

from pydantic import BaseModel, Field, field_validator


class TokenSchema(BaseModel):
    """JWT token with TTL validation.

    Used to ensure tokens are valid before seat scraping runs.

    Example:
        {
            "token": "eyJhbGciOiJIUzI1NiIs...",
            "phone": "6285***",
            "stored_at": "2025-12-17T09:06:29.115024",
            "expires_at": "2025-12-18T05:06:29.115029"
        }
    """

    token: str = Field(..., min_length=50, description="JWT token (typically 100+ chars)")
    phone: str | None = Field(None, description="Masked phone number")
    stored_at: str = Field(..., description="ISO timestamp when token was stored")
    expires_at: str = Field(..., description="ISO timestamp when token expires")

    @field_validator("stored_at", "expires_at")
    @classmethod
    def validate_iso_timestamp(cls, v):
        """Ensure timestamps are valid ISO format."""
        try:
            datetime.fromisoformat(v)
        except ValueError:
            raise ValueError(f"Invalid ISO timestamp: {v}") from None
        return v

    def get_expiry_datetime(self) -> datetime:
        """Parse expires_at as datetime."""
        return datetime.fromisoformat(self.expires_at)

    def minutes_until_expiry(self) -> int:
        """Returns minutes until token expires. Negative if already expired."""
        expires = self.get_expiry_datetime()
        delta = expires - datetime.utcnow()
        return int(delta.total_seconds() / 60)

    def is_expired(self) -> bool:
        """Check if token has expired."""
        return datetime.utcnow() > self.get_expiry_datetime()

    def is_valid_for_scrape(self, min_minutes: int = 30) -> bool:
        """Check if token has enough TTL for a scrape run.

        Args:
            min_minutes: Minimum minutes of validity required

        Returns:
            True if token will be valid for at least min_minutes
        """
        return self.minutes_until_expiry() >= min_minutes


class TokenValidationResult(BaseModel):
    """Result of token validation check."""

    is_valid: bool
    minutes_remaining: int
    message: str
    can_scrape: bool = Field(description="True if token has enough TTL for a scrape")
