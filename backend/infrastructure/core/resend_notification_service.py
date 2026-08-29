"""Unified Implementation of Notification Port (Resend Email + Telegram)."""

import asyncio
import logging
import os
from typing import Any

import httpx
from google.cloud import firestore

from backend.application.ports.notification import INotificationService

logger = logging.getLogger(__name__)


class ResendNotificationService(INotificationService):
    """Notification service supporting both Resend Email and Telegram."""

    def __init__(self, db: firestore.Client | None = None) -> None:
        self.api_key = os.environ.get("RESEND_API_KEY")
        self.recipient = os.environ.get("NOTIFICATION_EMAIL")
        self.from_email = os.environ.get("SENDER_EMAIL", "onboarding@resend.dev")
        self.api_url = "https://api.resend.com/emails"

        # Telegram credentials (env or Firestore)
        self.telegram_bot_token = os.environ.get("TELEGRAM_BOT_TOKEN")
        self.telegram_chat_id = os.environ.get("TELEGRAM_CHAT_ID")
        self.db = db
        self._ensure_telegram_creds()

    def _ensure_telegram_creds(self) -> None:
        """Loads Telegram credentials from Firestore auth_tokens/socials if available."""
        if (self.telegram_bot_token and self.telegram_chat_id) or not self.db:
            return

        try:
            doc = self.db.collection("auth_tokens").document("socials").get()
            if doc.exists:
                data = doc.to_dict() or {}
                if not self.telegram_bot_token:
                    self.telegram_bot_token = str(data.get("telegram_bot_token") or "").strip()
                if not self.telegram_chat_id:
                    self.telegram_chat_id = str(data.get("telegram_chat_id") or "").strip()
        except Exception as e:
            logger.warning(f"Could not load Telegram credentials from Firestore: {e}")

    async def send_email(self, subject: str, body: str, metadata: dict[str, Any] | None = None) -> bool:
        """Send an email alert via Resend."""
        if not self.api_key or not self.recipient:
            logger.info("Resend credentials missing (RESEND_API_KEY or NOTIFICATION_EMAIL). Skipping email.")
            return False

        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

        full_body = body
        if metadata:
            full_body += "\n\n---\n**Metadata**:\n"
            for k, v in metadata.items():
                full_body += f"- {k}: {v}\n"

        payload = {
            "from": self.from_email,
            "to": [self.recipient],
            "subject": subject,
            "text": full_body,
        }

        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                response = await client.post(self.api_url, headers=headers, json=payload)
                if response.status_code in (200, 201):
                    logger.info(f"✅ Email alert sent: {subject}")
                    return True
                else:
                    logger.error(f"❌ Failed to send email alert: {response.status_code} - {response.text}")
                    return False
        except Exception as e:
            logger.error(f"❌ Exception sending email alert: {e}")
            return False

    async def send_telegram(self, message: str) -> bool:
        """Send a push message to Telegram."""
        if not self.telegram_bot_token or not self.telegram_chat_id:
            logger.info("Telegram credentials missing. Skipping Telegram message.")
            return False

        url = f"https://api.telegram.org/bot{self.telegram_bot_token}/sendMessage"
        payload = {
            "chat_id": str(self.telegram_chat_id),
            "text": message,
            "parse_mode": "Markdown",
        }

        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                response = await client.post(url, json=payload)
                if response.status_code == 200:
                    logger.info("✅ Telegram alert sent successfully")
                    return True
                else:
                    logger.error(f"❌ Failed to send Telegram alert: {response.status_code} - {response.text}")
                    return False
        except Exception as e:
            logger.error(f"❌ Exception sending Telegram alert: {e}")
            return False

    async def send_alert(self, subject: str, body: str, metadata: dict[str, Any] | None = None) -> bool:
        """Send alert via both Resend Email and Telegram."""
        # 1. Email
        email_task = self.send_email(subject, body, metadata)

        # 2. Telegram (Markdown formatted)
        tg_text = f"*{subject}*\n\n{body}"
        if metadata:
            tg_text += "\n"
            for k, v in metadata.items():
                tg_text += f"\n• *{k}*: {v}"
        tg_task = self.send_telegram(tg_text)

        results = await asyncio.gather(email_task, tg_task, return_exceptions=True)
        return any(isinstance(r, bool) and r for r in results)
