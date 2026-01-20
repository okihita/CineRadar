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
    """Dedicated scraper for token refresh only."""

    def __init__(self):
        super().__init__()

    async def refresh_token(self, headless: bool = True) -> bool:
        """
        Login to TIX.id and store the JWT token.

        Returns:
            True if token was refreshed successfully
        """
        self.log("🔐 Starting token refresh...")

        playwright, browser, context, page = await self._init_browser(headless)

        try:
            # Navigate to login - wait longer for Flutter to render
            await page.goto(f"{self.app_base}/login", wait_until="networkidle", timeout=60000)
            await asyncio.sleep(15)  # Flutter needs time to render

            # Strip 62 prefix from phone
            phone_clean = self._phone.lstrip("+").lstrip("62")

            # Try to find inputs
            phone_field = page.get_by_placeholder("Type your phone number")
            password_field = page.get_by_placeholder("Type Password")

            phone_count = await phone_field.count()
            pass_count = await password_field.count()
            self.log(f"   📋 Found phone={phone_count}, password={pass_count}")

            if phone_count > 0:
                await phone_field.click()
                await asyncio.sleep(0.5)
                await page.keyboard.type(phone_clean, delay=30)
                self.log(f"   📱 Typed phone: {phone_clean[:4]}***")

            if pass_count > 0:
                await password_field.click()
                await asyncio.sleep(0.5)
                await page.keyboard.type(self._password, delay=30)
                self.log("   🔑 Typed password")

            # Click Login - simple approach
            # IMPORTANT: TIX.id has TWO Login buttons - header (fake) and form (real)
            # Must use .last to get the form button, not .first!
            login_button = page.get_by_role("button", name="Login").last
            if await login_button.count() > 0:
                await login_button.click()
                self.log("   📤 Clicked Login button")
            else:
                await page.keyboard.press("Enter")
                self.log("   📤 Pressed Enter")

            # Wait for any processing
            await asyncio.sleep(5)
            self.log(f"   📍 After click URL: {page.url}")

            # Navigate to home to check session
            self.log("   🔄 Navigating to home...")
            await page.goto(f"{self.app_base}/home", wait_until="networkidle", timeout=30000)
            await asyncio.sleep(5)

            current_url = page.url
            self.log(f"   📍 Home page URL: {current_url}")

            # Try to capture JWT from localStorage
            try:
                # Debug: list all localStorage keys
                all_keys = await page.evaluate("Object.keys(localStorage)")
                self.log(f"   🔑 localStorage keys: {all_keys}")

                # Also check sessionStorage
                session_keys = await page.evaluate("Object.keys(sessionStorage)")
                self.log(f"   🔑 sessionStorage keys: {session_keys}")

                # Check cookies
                cookies = await context.cookies()
                cookie_names = [c["name"] for c in cookies]
                self.log(f"   🍪 Cookies: {cookie_names}")

                # Look for token in cookies
                token = None  # Initialize before checking
                refresh_token = None  # Also capture refresh token
                for cookie in cookies:
                    if "token" in cookie["name"].lower() or "auth" in cookie["name"].lower():
                        self.log(f"   ✅ Found token cookie: {cookie['name']}")
                        token = cookie["value"]
                        break

                # Try multiple possible token key names in localStorage
                if not token:
                    for key in [
                        "authentication_token",
                        "token",
                        "auth_token",
                        "jwt",
                        "access_token",
                    ]:
                        token = await page.evaluate(f"localStorage.getItem('{key}')")
                        if token:
                            self.log(f"   ✅ Found token under key: {key}")
                            break

                # Also get refresh token from localStorage
                refresh_token = await page.evaluate(
                    "localStorage.getItem('authentication_refresh_token')"
                )
                if refresh_token:
                    # Strip quotes if present
                    if refresh_token.startswith('"') and refresh_token.endswith('"'):
                        refresh_token = refresh_token[1:-1]
                    self.log(f"   ✅ Found refresh token (length: {len(refresh_token)})")

                if token:
                    # Strip extra quotes if present (localStorage returns JSON-encoded strings)
                    if token.startswith('"') and token.endswith('"'):
                        token = token[1:-1]
                    self.auth_token = token
                    self.log(f"✅ JWT token captured! (length: {len(token)})")

                    # Store in Firestore (with refresh token if available)
                    if store_token(token, self._phone, refresh_token=refresh_token):
                        self.log("✅ Token stored in Firestore!")
                        if refresh_token:
                            self.log("✅ Refresh token also stored!")
                        return True
                    else:
                        self.log("⚠️ Token storage failed")
                        return False
                else:
                    self.log("⚠️ No token found in any localStorage key")
            except Exception as e:
                self.log(f"⚠️ Could not read localStorage: {e}")

            self.log("❌ Login failed - could not capture token")
            return False

        finally:
            await self._close_browser(playwright, browser, context, page)


def main():
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

    async def _run():
        refresher = TokenRefresher()
        return await refresher.refresh_token(headless=not args.visible)

    success = asyncio.run(_run())
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(message)s")
    main()
