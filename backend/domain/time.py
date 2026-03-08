"""Time utility functions for domain models."""

from datetime import UTC, datetime
from zoneinfo import ZoneInfo

# Jakarta timezone - used throughout the application for business hours
JAKARTA_TZ = ZoneInfo("Asia/Jakarta")


def get_now_iso() -> str:
    """Get current UTC time as ISO 8601 string.

    Returns:
        ISO 8601 formatted datetime string in UTC timezone.

    """
    return datetime.now(UTC).isoformat()


def get_now_jakarta() -> datetime:
    """Get current datetime in Jakarta timezone.

    Returns:
        Timezone-aware datetime in Asia/Jakarta timezone.

    """
    return datetime.now(JAKARTA_TZ)


def get_jakarta_date_str() -> str:
    """Get current date in Jakarta timezone as YYYY-MM-DD string.

    Convenience function for CLI scripts.

    Returns:
        Date string in YYYY-MM-DD format.

    """
    return datetime.now(JAKARTA_TZ).strftime("%Y-%m-%d")


def get_jakarta_datetime_str() -> str:
    """Get current datetime in Jakarta timezone as YYYY-MM-DD HH:MM:SS string.

    Convenience function for CLI scripts and scrape timestamps.

    Returns:
        Datetime string in YYYY-MM-DD HH:MM:SS format.

    """
    return datetime.now(JAKARTA_TZ).strftime("%Y-%m-%d %H:%M:%S")
