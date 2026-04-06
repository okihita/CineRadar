"""Resend Implementation of Notification Port."""

import logging
import os
from typing import Any

import httpx

from backend.application.ports.notification import INotificationService

logger = logging.getLogger(__name__)

class ResendNotificationService(INotificationService):
    """Notification service using Resend API."""

    def __init__(self) -> None:
        self.api_key = os.environ.get("RESEND_API_KEY")
        self.recipient = os.environ.get("NOTIFICATION_EMAIL")
        self.from_email = os.environ.get("SENDER_EMAIL", "onboarding@resend.dev")
        self.api_url = "https://api.resend.com/emails"

    async def send_alert(self, subject: str, body: str, metadata: dict[str, Any] | None = None) -> bool:
        """Send an email alert via Resend."""
        if not self.api_key or not self.recipient:
            logger.warning("Resend credentials missing (RESEND_API_KEY or NOTIFICATION_EMAIL). Skipping alert.")
            return False

        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }

        # Enhance body with metadata if present
        full_body = body
        if metadata:
            full_body += "\n\n---\n**Metadata**:\n"
            for k, v in metadata.items():
                full_body += f"- {k}: {v}\n"

        payload = {
            "from": self.from_email,
            "to": [self.recipient],
            "subject": subject,
            "text": full_body
        }

        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(self.api_url, headers=headers, json=payload)
                if response.status_code in (200, 201):
                    logger.info(f"✅ Alert sent successfully: {subject}")
                    return True
                else:
                    logger.error(f"❌ Failed to send alert: {response.status_code} - {response.text}")
                    return False
        except Exception as e:
            logger.error(f"❌ Exception sending alert: {e}")
            return False
