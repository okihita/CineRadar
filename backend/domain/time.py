"""Time utility functions for domain models."""

from datetime import UTC, datetime


def get_now_iso() -> str:
    """Get current UTC time as ISO 8601 string.

    Returns:
        ISO 8601 formatted datetime string in UTC timezone.
    """
    return datetime.now(UTC).isoformat()
