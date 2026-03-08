"""CineRadar Base Scraper.

Common functionality for all TIX.id scrapers.
Provides browser initialization, login, and logging.
"""

import logging
import os

from backend.infrastructure.core.config import (
    API_BASE,
    APP_BASE,
)
from backend.infrastructure.core.guest_token import GuestToken, fetch_guest_token

logger = logging.getLogger(__name__)


class BaseScraper:
    """Base class for TIX.id scrapers with common browser and auth functionality.

    Provides:
    - Browser initialization with anti-detection
    - Login handling
    - Token capture
    - Logging utilities

    Subclasses should implement specific scraping logic.
    """

    def __init__(self) -> None:
        """Initialize with configuration from environment."""
        self.api_base = API_BASE
        self.app_base = APP_BASE
        self.auth_token: str | None = None
        self._phone = os.environ.get("TIX_PHONE_NUMBER", "")
        self._password = os.environ.get("TIX_PASSWORD", "")

    async def _get_guest_token(self) -> GuestToken | None:
        """Fetch a fresh Guest Token for API authentication.

        This is a lightweight alternative to _login() for endpoints
        that don't require full user authentication (e.g., /v1/movies).

        Returns:
            GuestToken if successful, None otherwise

        """
        self.log("🎫 Fetching Guest Token via API...")
        guest = await fetch_guest_token()
        if guest:
            self.auth_token = guest.token
            self.log(f"   ✅ Guest token valid for {guest.minutes_remaining:.0f} min")
        else:
            self.log("   ❌ Failed to fetch guest token")
        return guest

    def log(self, message: str) -> None:
        """Print timestamped log message.

        Args:
            message: Message to log

        """
        logger.info(message)

    def has_valid_token(self) -> bool:
        """Check if a token has been captured.

        Returns:
            True if auth_token is set

        """
        return bool(self.auth_token)
