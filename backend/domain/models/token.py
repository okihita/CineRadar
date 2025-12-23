"""
Token Domain Model

Represents a JWT authentication token.
"""

from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Any


@dataclass
class Token:
    """JWT authentication token for TIX.id API.

    Manages token lifecycle including expiry checking.
    Access tokens have a fixed 30-minute TTL from stored_at.

    Attributes:
        token: The JWT token string
        stored_at: When token was stored (ISO format)
        phone: Phone number used for login (masked)
        refresh_token: Long-lived refresh token (~91 days)

    Example:
        >>> token = Token(
        ...     token="eyJ...",
        ...     stored_at="2025-12-18T06:00:00"
        ... )
        >>> token.is_expired
        True  # If current time is past stored_at + 30 min
    """
    token: str
    stored_at: str
    phone: str | None = None
    refresh_token: str | None = None  # For programmatic token refresh

    # Fixed TTL for TIX.id access tokens
    ACCESS_TOKEN_TTL_MINUTES = 30

    @property
    def stored_datetime(self) -> datetime:
        """Parse stored_at as datetime."""
        return datetime.fromisoformat(self.stored_at)

    @property
    def expiry_datetime(self) -> datetime:
        """Calculate expiry based on stored time + 30 minutes."""
        return self.stored_datetime + timedelta(minutes=self.ACCESS_TOKEN_TTL_MINUTES)

    @property
    def is_expired(self) -> bool:
        """Check if token has expired."""
        return datetime.utcnow() > self.expiry_datetime

    @property
    def minutes_until_expiry(self) -> int:
        """Minutes until token expires. Negative if already expired."""
        delta = self.expiry_datetime - datetime.utcnow()
        return int(delta.total_seconds() / 60)

    @property
    def is_valid_for_scrape(self) -> bool:
        """Check if token has enough TTL for a scrape operation."""
        # Require at least 5 minutes of buffer
        return self.minutes_until_expiry >= 5

    @property
    def age_minutes(self) -> int:
        """How many minutes since token was stored."""
        delta = datetime.utcnow() - self.stored_datetime
        return int(delta.total_seconds() / 60)

    def get_status_message(self) -> str:
        """Get human-readable status message."""
        if self.is_expired:
            return f"❌ Expired {abs(self.minutes_until_expiry)} minutes ago"
        elif self.is_valid_for_scrape:
            return f"✅ Valid for {self.minutes_until_expiry} minutes"
        else:
            return f"⚠️ Only {self.minutes_until_expiry} minutes remaining"

    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary for serialization."""
        data = {
            'token': self.token,
            'phone': self.phone,
            'stored_at': self.stored_at,
        }
        if self.refresh_token:
            data['refresh_token'] = self.refresh_token
        return data

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> 'Token':
        """Create from dictionary."""
        return cls(
            token=data.get('token', ''),
            phone=data.get('phone'),
            stored_at=data.get('stored_at', ''),
            refresh_token=data.get('refresh_token'),
        )

    @classmethod
    def create_new(
        cls,
        token: str,
        phone: str | None = None,
        refresh_token: str | None = None,
    ) -> 'Token':
        """Create a new token.

        Args:
            token: JWT token string
            phone: Phone number used for login
            refresh_token: Refresh token for programmatic token refresh

        Returns:
            Token instance
        """
        now = datetime.utcnow()

        return cls(
            token=token,
            phone=phone,
            stored_at=now.isoformat(),
            refresh_token=refresh_token,
        )
