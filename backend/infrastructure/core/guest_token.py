"""Guest Token fetcher for TIX.id API authentication.

This module provides functionality to acquire short-lived (30-minute)
guest tokens from the TIX.id API. These tokens are sufficient for
accessing public endpoints like /v1/movies and /v1/schedules/movies
without requiring full user authentication.

Usage:
    from backend.infrastructure.core.guest_token import fetch_guest_token

    guest = await fetch_guest_token()
    if guest:
        headers = {"Authorization": f"Bearer {guest.token}"}
        # Make authenticated API calls...
"""

import logging
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

import httpx

logger = logging.getLogger(__name__)

# API Configuration
GUEST_AUTH_URL = "https://api-b2b.tix.id/v1/auth"
GUEST_CLIENT_ID = "tixid_guest"
TOKEN_VALIDITY_MINUTES = 30


@dataclass
class GuestToken:
    """Container for guest token with metadata.

    Attributes:
        token: The JWT token string
        expires_at: When the token expires (UTC)

    """

    token: str
    expires_at: datetime

    @property
    def is_expired(self) -> bool:
        """Check if token has expired."""
        return datetime.now(UTC) >= self.expires_at

    @property
    def minutes_remaining(self) -> float:
        """Get minutes until expiry."""
        delta = self.expires_at - datetime.now(UTC)
        return max(0, delta.total_seconds() / 60)


async def fetch_guest_token() -> GuestToken | None:
    """Fetch a fresh 30-minute Guest Token from TIX.id.

    This token is required for accessing /v1/movies and /v1/schedules
    endpoints without full user login.

    Returns:
        GuestToken object with token and expiry, or None if failed

    Example:
        >>> guest = await fetch_guest_token()
        >>> if guest:
        ...     print(f"Token valid for {guest.minutes_remaining:.1f} min")
        ...     headers = {"Authorization": f"Bearer {guest.token}"}

    """
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                GUEST_AUTH_URL,
                json={
                    "client_id": GUEST_CLIENT_ID,
                    "auth_code": None,
                },
                headers={
                    "Content-Type": "application/json",
                },
                timeout=30,
            )

            if response.status_code == 200:
                data = response.json()

                if not data.get("success", True):
                    error = data.get("error", {})
                    logger.error(f"❌ Guest token API error: {error.get('message', 'Unknown')}")
                    return None

                token = data.get("data", {}).get("token")
                expires_in = data.get("data", {}).get("expires_in", TOKEN_VALIDITY_MINUTES)

                if token:
                    expires_at = datetime.now(UTC) + timedelta(minutes=expires_in)

                    logger.info(f"✅ Guest token acquired (valid for {expires_in} min)")
                    return GuestToken(token=token, expires_at=expires_at)
                else:
                    logger.error("❌ Guest token response missing token field")
            else:
                logger.error(f"❌ Guest token fetch failed: HTTP {response.status_code}")
                logger.debug(f"Response: {response.text[:200]}")

    except httpx.RequestError as e:
        logger.error(f"❌ Guest token request failed: {e}")
    except Exception as e:
        logger.error(f"❌ Unexpected error fetching guest token: {e}")

    return None


def fetch_guest_token_sync() -> GuestToken | None:
    """Synchronous wrapper for fetch_guest_token.

    Useful for CLI scripts and synchronous contexts.

    Returns:
        GuestToken object or None if failed

    """
    import asyncio

    return asyncio.run(fetch_guest_token())
