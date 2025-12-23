"""
CineRadar Domain Errors

Custom exception hierarchy for clear error handling across the application.
All exceptions inherit from CineRadarError for easy catching.

Usage:
    from backend.domain.errors import TokenExpiredError, ScrapingError

    try:
        token = get_token()
    except TokenExpiredError:
        # Handle expired token specifically
        refresh_token()
    except ScrapingError:
        # Handle any scraping error
        log_and_retry()
"""

from typing import Any


class CineRadarError(Exception):
    """Base exception for all CineRadar errors.

    All custom exceptions in the project should inherit from this.
    This allows catching all CineRadar errors with a single except clause.
    """

    def __init__(self, message: str = "", details: dict[str, Any] | None = None):
        super().__init__(message)
        self.message = message
        self.details = details or {}

    def __str__(self) -> str:
        if self.details:
            return f"{self.message} | Details: {self.details}"
        return self.message


# =============================================================================
# Scraping Errors
# =============================================================================


class ScrapingError(CineRadarError):
    """Error during web scraping operations.

    Parent class for all scraping-related errors.
    """

    pass


class LoginFailedError(ScrapingError):
    """TIX.id login failed.

    Raised when:
    - Credentials are invalid
    - Login page not loading
    - CAPTCHA or anti-bot detection triggered
    """

    pass


class TokenExpiredError(ScrapingError):
    """JWT token has expired.

    Raised when:
    - Stored token's expires_at is in the past
    - API returns 401 with expired token
    """

    def __init__(self, message: str = "Token has expired", expires_at: str | None = None):
        super().__init__(message, {"expires_at": expires_at} if expires_at else {})
        self.expires_at = expires_at


class PageLoadError(ScrapingError):
    """Page failed to load properly.

    Raised when:
    - Flutter app doesn't render
    - Network timeout
    - Page returns error status
    """

    pass


class RateLimitError(ScrapingError):
    """API rate limit exceeded.

    Raised when TIX.id API returns 429 or similar.
    """

    def __init__(self, message: str = "Rate limit exceeded", retry_after: int | None = None):
        super().__init__(message, {"retry_after": retry_after} if retry_after else {})
        self.retry_after = retry_after


# =============================================================================
# Data Errors
# =============================================================================


class ValidationError(CineRadarError):
    """Data validation failed.

    Raised when:
    - Pydantic schema validation fails
    - Integrity assertions fail
    - Data format is incorrect
    """

    def __init__(self, message: str, field: str | None = None, value: Any = None):
        details = {}
        if field:
            details["field"] = field
        if value is not None:
            details["value"] = str(value)[:100]  # Truncate for safety
        super().__init__(message, details)
        self.field = field
        self.value = value


class DataNotFoundError(CineRadarError):
    """Required data not found.

    Raised when:
    - Movie data file doesn't exist
    - Firestore document not found
    - Theatre not in database
    """

    def __init__(self, message: str, entity_type: str | None = None, entity_id: str | None = None):
        details = {}
        if entity_type:
            details["entity_type"] = entity_type
        if entity_id:
            details["entity_id"] = entity_id
        super().__init__(message, details)


class IntegrityError(CineRadarError):
    """Data integrity check failed.

    Raised when:
    - Less than expected movies/cities in scrape
    - Duplicate IDs detected
    - Referential integrity violated
    """

    pass


# =============================================================================
# Storage Errors
# =============================================================================


class StorageError(CineRadarError):
    """Error accessing storage.

    Parent class for all storage-related errors.
    """

    pass


class FirestoreError(StorageError):
    """Firestore-specific error.

    Raised when:
    - Firestore connection failed
    - Write operation failed
    - Permission denied
    """

    pass


class FileStorageError(StorageError):
    """Local file storage error.

    Raised when:
    - File not found
    - Permission denied
    - Disk full
    """

    pass


# =============================================================================
# Configuration Errors
# =============================================================================


class ConfigurationError(CineRadarError):
    """Configuration error.

    Raised when:
    - Required environment variable missing
    - Invalid configuration value
    """

    def __init__(self, message: str, config_key: str | None = None):
        super().__init__(message, {"config_key": config_key} if config_key else {})
        self.config_key = config_key
