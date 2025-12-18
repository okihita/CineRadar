"""
Token Domain Model

Represents a JWT authentication token.
"""

from dataclasses import dataclass
from datetime import datetime, timedelta


@dataclass
class Token:
    """JWT authentication token for TIX.id API.

    Manages token lifecycle including expiry checking.

    Attributes:
        token: The JWT token string
        phone: Phone number used for login (masked)
        stored_at: When token was stored
        expires_at: When token expires

    Example:
        >>> token = Token(
        ...     token="eyJ...",
        ...     stored_at="2025-12-18T06:00:00",
        ...     expires_at="2025-12-18T06:30:00"
        ... )
        >>> token.is_expired
        True  # If current time is past expires_at
    """
    token: str
    stored_at: str
    expires_at: str
    phone: str | None = None

    # Default TTL for new tokens (in hours)
    DEFAULT_TTL_HOURS = 20

    # Minimum minutes required for scraping operations
    MIN_SCRAPE_TTL_MINUTES = 25

    @property
    def expiry_datetime(self) -> datetime:
        """Parse expires_at as datetime."""
        return datetime.fromisoformat(self.expires_at)

    @property
    def stored_datetime(self) -> datetime:
        """Parse stored_at as datetime."""
        return datetime.fromisoformat(self.stored_at)

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
        return self.minutes_until_expiry >= self.MIN_SCRAPE_TTL_MINUTES

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
            return f"⚠️ Only {self.minutes_until_expiry} minutes remaining (need {self.MIN_SCRAPE_TTL_MINUTES})"

    def to_dict(self) -> dict:
        """Convert to dictionary for serialization."""
        return {
            'token': self.token,
            'phone': self.phone,
            'stored_at': self.stored_at,
            'expires_at': self.expires_at,
        }

    @classmethod
    def from_dict(cls, data: dict) -> 'Token':
        """Create from dictionary."""
        return cls(
            token=data.get('token', ''),
            phone=data.get('phone'),
            stored_at=data.get('stored_at', ''),
            expires_at=data.get('expires_at', ''),
        )

    @classmethod
    def create_new(cls, token: str, phone: str = None, ttl_hours: int = None) -> 'Token':
        """Create a new token with computed expiry.

        Args:
            token: JWT token string
            phone: Phone number used for login
            ttl_hours: Hours until expiry (default: DEFAULT_TTL_HOURS)

        Returns:
            Token instance with computed timestamps
        """
        now = datetime.utcnow()
        ttl = ttl_hours or cls.DEFAULT_TTL_HOURS

        return cls(
            token=token,
            phone=phone,
            stored_at=now.isoformat(),
            expires_at=(now + timedelta(hours=ttl)).isoformat(),
        )
