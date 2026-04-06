"""Notification Port Interface."""

from abc import ABC, abstractmethod
from typing import Any


class INotificationService(ABC):
    """Interface for sending notifications/alerts."""

    @abstractmethod
    async def send_alert(self, subject: str, body: str, metadata: dict[str, Any] | None = None) -> bool:
        """Send an alert notification.

        Args:
            subject: The alert subject/title
            body: Detailed message body (can be Markdown/HTML)
            metadata: Optional structured data related to the alert

        Returns:
            True if sent successfully
        """
        pass
