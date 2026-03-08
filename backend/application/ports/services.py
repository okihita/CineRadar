"""External Service Port Interfaces.

Abstract interfaces for external services like geocoding.
"""

from abc import ABC, abstractmethod


class INotificationService(ABC):
    """Interface for sending notifications.

    Could be implemented with Slack, email, push notifications, etc.
    """

    @abstractmethod
    def send_alert(self, title: str, message: str, severity: str = "info") -> bool:
        """Send an alert notification.

        Args:
            title: Alert title
            message: Alert body
            severity: 'info', 'warning', 'error', 'critical'

        Returns:
            True if sent successfully

        """
        pass

    @abstractmethod
    def send_scrape_report(
        self,
        movies: int,
        cities: int,
        success: bool,
        error: str | None = None,
    ) -> bool:
        """Send a scrape completion report.

        Args:
            movies: Number of movies scraped
            cities: Number of cities covered
            success: Whether scrape was successful
            error: Error message if failed

        Returns:
            True if sent successfully

        """
        pass
