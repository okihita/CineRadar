#!/usr/bin/env python3
"""
CineRadar Token Refresh Script
Logs into TIX.id and stores the JWT token in Firestore.

Usage:
    python -m backend.cli.refresh_token [--visible] [--debug-screenshots]
"""

import argparse
import asyncio
import logging
import sys

from backend.infrastructure.repositories.firestore_token import get_storage, store_token
from backend.infrastructure.scrapers.base import BaseScraper

logger = logging.getLogger(__name__)


class TokenRefresher(BaseScraper):
    """Dedicated scraper for token refresh only using fast API login."""

    def __init__(self) -> None:
        super().__init__()

    async def refresh_token(self, headless: bool = True) -> bool:
        """
        Login to TIX.id via API and store the JWT tokens.

        Args:
            headless: Ignored, kept for backward compatibility with CLI parser

        Returns:
            True if token was refreshed successfully
        """
        self.log("🔐 Starting fast API token refresh...")
        import uuid

        import httpx

        from backend.cli.commands.encrypt_password import encrypt_password

        try:
            # 1. Clean phone number like the app expects
            phone_clean = "+" + self._phone.lstrip("+")
            if not phone_clean.startswith("+62"):
                # fallback just in case it's literally just the numbers
                phone_clean = "+62" + self._phone.lstrip("0")

            enc_password = encrypt_password(self._password, use_oaep=False)

            # Generate a random UUID for device_id if we don't have a static one
            device_uuid = str(uuid.uuid4())

            headers = {
                'accept': '*/*',
                'app_version': '1.0.0',
                'content-type': 'application/json',
                'device_id': device_uuid,
                'platform': 'web',
                'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }

            async with httpx.AsyncClient() as client:
                self.log("   📡 Fetching 30-minute Guest Token...")
                auth_resp = await client.post(
                    "https://api-b2b.tix.id/v1/auth",
                    headers=headers,
                    json={"client_id": "tixid_guest", "auth_code": None},
                    timeout=10.0
                )

                if auth_resp.status_code != 200:
                    self.log(f"❌ Failed to get Guest Token: {auth_resp.status_code}")
                    return False

                guest_data = auth_resp.json()
                guest_token = guest_data.get("data", {}).get("token")
                if not guest_token:
                    self.log("❌ Failed to parse Guest Token from /v1/auth")
                    return False

                self.log(f"   ✅ Received Guest Token: {guest_token[:20]}...")

                # 2. Inject Guest Token into Headers for the real login
                headers["Authorization"] = f"Bearer {guest_token}"

                payload = {
                    "msisdn": phone_clean,
                    "password": enc_password
                }

                self.log(f"   📡 Sending Encrypted Login for {phone_clean}")

                response = await client.post(
                    "https://api-b2b.tix.id/v1/users/login",
                    headers=headers,
                    json=payload,
                    timeout=10.0
                )

            if response.status_code != 200:
                self.log(f"❌ Login failed with status {response.status_code}: {response.text}")
                return False

            data = response.json()
            if not data.get("success"):
                self.log(f"❌ API rejected login: {data}")
                return False

            token = data.get("data", {}).get("token")
            refresh_token = data.get("data", {}).get("refresh_token")

            if not token:
                self.log("❌ Login succeeded but no Access Token returned in data payload")
                return False

            if not refresh_token:
                self.log("⚠️ Warning: No Refresh Token returned, only Access Token")

            # Store in Firestore (with refresh token if available)
            if store_token(token, self._phone, refresh_token=refresh_token):
                self.log("✅ Token stored in Firestore!")
                if refresh_token:
                    self.log("✅ Refresh token also stored!")
                return True
            else:
                self.log("⚠️ Token storage failed")
                return False

        except Exception as e:
            self.log(f"⚠️ Exception during API login: {e}")
            return False


def main() -> None:
    parser = argparse.ArgumentParser(description="Refresh TIX.id JWT Token")
    parser.add_argument("--visible", action="store_true", help="Show browser window")
    parser.add_argument("--check", action="store_true", help="Check current token status")
    parser.add_argument(
        "--check-min-ttl",
        type=int,
        metavar="MINUTES",
        help="Check that token has at least N minutes TTL remaining. Exit 1 if not.",
    )
    args = parser.parse_args()

    if args.check:
        storage = get_storage()
        token = storage.get_current()
        if token:
            logger.info("📋 Token Info:")
            logger.info(f"   Stored at: {token.stored_at}")
            logger.info(f"   Age: {token.age_minutes} minutes")
            logger.info(f"   TTL: {token.minutes_until_expiry} minutes remaining")
            logger.info(f"   Phone: {token.phone}")
            logger.info(f"   Valid: {storage.is_valid()}")
            logger.info(f"   Has refresh token: {bool(token.refresh_token)}")
        else:
            logger.error("❌ No token found")
        return

    if args.check_min_ttl is not None:
        # Check token has minimum TTL for seat scraping
        storage = get_storage()
        info = storage.get_token_info()
        if not info:
            logger.error("❌ No token found in storage")
            sys.exit(1)

        try:
            token = storage.get_current()
            if not token:
                logger.error("❌ No current token found")
                sys.exit(1)

            minutes_remaining = token.minutes_until_expiry

            logger.info("📋 Token TTL Check:")
            logger.info(f"   Stored at: {token.stored_at}")
            logger.info(f"   Minutes remaining: {minutes_remaining}")
            logger.info(f"   Required minimum: {args.check_min_ttl}")

            if minutes_remaining >= args.check_min_ttl:
                logger.info(
                    f"✅ Token has sufficient TTL ({minutes_remaining} >= {args.check_min_ttl})"
                )
                sys.exit(0)
            else:
                logger.error(f"❌ Token TTL too low ({minutes_remaining} < {args.check_min_ttl})")
                sys.exit(1)
        except Exception as e:
            logger.error(f"❌ Error checking token TTL: {e}")
            sys.exit(1)

    async def _run() -> bool:
        refresher = TokenRefresher()
        return await refresher.refresh_token(headless=not args.visible)

    success = asyncio.run(_run())
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(message)s")
    main()
