#!/usr/bin/env python3
"""
CineRadar Token Refresh Script
Logs into TIX.id and stores the JWT token in Firestore.

Usage:
    python -m backend.cli.refresh_token [--visible] [--debug-screenshots]
"""
import argparse
import asyncio
import sys
from pathlib import Path

from backend.infrastructure._legacy.base_scraper import BaseScraper
from backend.infrastructure._legacy.token_storage import get_storage, store_token


class TokenRefresher(BaseScraper):
    """Dedicated scraper for token refresh only."""

    def __init__(self, debug_screenshots: bool = False):
        super().__init__()
        self.debug_screenshots = debug_screenshots
        if debug_screenshots:
            self.screenshot_dir = Path("screenshots")
            self.screenshot_dir.mkdir(exist_ok=True)

    async def _save_screenshot(self, page, name: str):
        """Save screenshot if debug mode is enabled."""
        if self.debug_screenshots:
            path = self.screenshot_dir / f"{name}.png"
            await page.screenshot(path=str(path))
            self.log(f"   📸 Screenshot saved: {path}")

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
            await page.goto(f'{self.app_base}/login', wait_until='networkidle', timeout=60000)
            await asyncio.sleep(15)  # Flutter needs time to render
            await self._save_screenshot(page, "01_login_page_loaded")

            # Strip 62 prefix from phone
            phone_clean = self._phone.lstrip('+').lstrip('62')

            # Try to find inputs
            phone_field = page.get_by_placeholder('Type your phone number')
            password_field = page.get_by_placeholder('Type Password')

            phone_count = await phone_field.count()
            pass_count = await password_field.count()
            self.log(f"   📋 Found phone={phone_count}, password={pass_count}")

            if phone_count > 0:
                await phone_field.click()
                await asyncio.sleep(0.5)
                await page.keyboard.type(phone_clean, delay=30)
                self.log(f"   📱 Typed phone: {phone_clean[:4]}***")
                await self._save_screenshot(page, "02_after_phone_typed")

            if pass_count > 0:
                await password_field.click()
                await asyncio.sleep(0.5)
                await page.keyboard.type(self._password, delay=30)
                self.log("   🔑 Typed password")
                await self._save_screenshot(page, "03_after_password_typed")

            # Click Login - simple approach
            # IMPORTANT: TIX.id has TWO Login buttons - header (fake) and form (real)
            # Must use .last to get the form button, not .first!
            login_button = page.get_by_role('button', name='Login').last
            if await login_button.count() > 0:
                await login_button.click()
                self.log("   📤 Clicked Login button")
            else:
                await page.keyboard.press('Enter')
                self.log("   📤 Pressed Enter")

            # Wait for any processing
            await asyncio.sleep(5)
            await self._save_screenshot(page, "04_after_login_click")
            self.log(f"   📍 After click URL: {page.url}")

            # Navigate to home to check session
            self.log("   🔄 Navigating to home...")
            await page.goto(f'{self.app_base}/home', wait_until='networkidle', timeout=30000)
            await asyncio.sleep(5)
            await self._save_screenshot(page, "05_at_home_page")

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
                cookie_names = [c['name'] for c in cookies]
                self.log(f"   🍪 Cookies: {cookie_names}")

                # Look for token in cookies
                token = None  # Initialize before checking
                for cookie in cookies:
                    if 'token' in cookie['name'].lower() or 'auth' in cookie['name'].lower():
                        self.log(f"   ✅ Found token cookie: {cookie['name']}")
                        token = cookie['value']
                        break

                # Try multiple possible token key names in localStorage
                if not token:
                    for key in ['authentication_token', 'token', 'auth_token', 'jwt', 'access_token']:
                        token = await page.evaluate(f"localStorage.getItem('{key}')")
                        if token:
                            self.log(f"   ✅ Found token under key: {key}")
                            break

                if token:
                    self.auth_token = token
                    self.log(f"✅ JWT token captured! (length: {len(token)})")
                    await self._save_screenshot(page, "06_success_token_captured")

                    # Store in Firestore
                    if store_token(token, self._phone):
                        self.log("✅ Token stored in Firestore!")
                        return True
                    else:
                        self.log("⚠️ Token storage failed")
                        return False
                else:
                    self.log("⚠️ No token found in any localStorage key")
            except Exception as e:
                self.log(f"⚠️ Could not read localStorage: {e}")

            self.log("❌ Login failed - could not capture token")
            await self._save_screenshot(page, "06_failed_no_token")
            return False

        finally:
            await self._close_browser(playwright, browser, context, page)


def main():
    parser = argparse.ArgumentParser(description='Refresh TIX.id JWT Token')
    parser.add_argument('--visible', action='store_true', help='Show browser window')
    parser.add_argument('--check', action='store_true', help='Check current token status')
    parser.add_argument('--check-min-ttl', type=int, metavar='MINUTES',
                        help='Check that token has at least N minutes TTL remaining. Exit 1 if not.')
    parser.add_argument('--debug-screenshots', action='store_true', help='Save screenshots at each step')
    args = parser.parse_args()

    if args.check:
        storage = get_storage()
        info = storage.get_token_info()
        if info:
            print("📋 Token Info:")
            print(f"   Stored at: {info.get('stored_at')}")
            print(f"   Expires at: {info.get('expires_at')}")
            print(f"   Phone: {info.get('phone')}")
            print(f"   Valid: {storage.is_token_valid()}")
        else:
            print("❌ No token found")
        return

    if args.check_min_ttl is not None:
        # Check token has minimum TTL for seat scraping
        storage = get_storage()
        info = storage.get_token_info()
        if not info:
            print("❌ No token found in storage")
            sys.exit(1)

        try:
            from datetime import datetime
            expires_at = datetime.fromisoformat(info.get('expires_at', '2000-01-01'))
            minutes_remaining = int((expires_at - datetime.utcnow()).total_seconds() / 60)

            print("📋 Token TTL Check:")
            print(f"   Expires at: {info.get('expires_at')}")
            print(f"   Minutes remaining: {minutes_remaining}")
            print(f"   Required minimum: {args.check_min_ttl}")

            if minutes_remaining >= args.check_min_ttl:
                print(f"✅ Token has sufficient TTL ({minutes_remaining} >= {args.check_min_ttl})")
                sys.exit(0)
            else:
                print(f"❌ Token TTL too low ({minutes_remaining} < {args.check_min_ttl})")
                sys.exit(1)
        except Exception as e:
            print(f"❌ Error checking token TTL: {e}")
            sys.exit(1)

    async def _run():
        refresher = TokenRefresher(debug_screenshots=args.debug_screenshots)
        return await refresher.refresh_token(headless=not args.visible)

    success = asyncio.run(_run())
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()
