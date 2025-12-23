"""
CineRadar Base Scraper
Common functionality for all TIX.id scrapers.
"""
import asyncio
import os
import time

from playwright.async_api import Page, async_playwright

from backend.config import API_BASE, APP_BASE, LOCALE, TIMEZONE, USER_AGENT, VIEWPORT


class BaseScraper:
    """Base class for TIX.id scrapers with common browser and auth functionality."""

    def __init__(self):
        self.api_base = API_BASE
        self.app_base = APP_BASE
        self.auth_token: str | None = None
        self._phone = os.environ.get('TIX_PHONE', '')
        self._password = os.environ.get('TIX_PASSWORD', '')

    def log(self, message: str) -> None:
        """Print timestamped log message."""
        print(f"[{time.strftime('%H:%M:%S')}] {message}")

    async def _init_browser(
        self,
        headless: bool = True
    ) -> tuple:
        """
        Initialize Playwright browser with anti-detection settings.

        Returns:
            Tuple of (playwright, browser, context, page)
        """
        playwright = await async_playwright().start()
        browser = await playwright.chromium.launch(
            headless=headless,
            args=['--disable-blink-features=AutomationControlled', '--no-sandbox']
        )

        context = await browser.new_context(
            viewport=VIEWPORT,
            user_agent=USER_AGENT,
            locale=LOCALE,
            timezone_id=TIMEZONE,
        )

        page = await context.new_page()
        await page.add_init_script(
            "Object.defineProperty(navigator, 'webdriver', { get: () => undefined });"
        )

        return playwright, browser, context, page

    async def _close_browser(
        self,
        playwright,
        browser,
        context,
        page
    ) -> None:
        """Clean up browser resources."""
        await page.close()
        await context.close()
        await browser.close()
        await playwright.stop()

    async def _login(self, page: Page) -> bool:
        """
        Login to TIX.id and capture JWT token.

        Args:
            page: Playwright page

        Returns:
            True if login successful, False otherwise
        """
        if not self._phone or not self._password:
            self.log("⚠️ No credentials provided")
            return False

        self.log("🔐 Logging in to TIX.id...")

        try:
            await page.goto(f'{self.app_base}/login', wait_until='networkidle')
            await asyncio.sleep(8)  # Flutter needs time to render

            # Strip 62 prefix from phone
            phone_clean = self._phone.lstrip('+').lstrip('62')

            # Try get_by_placeholder first (Flutter friendly)
            phone_field = page.get_by_placeholder('Type your phone number')
            password_field = page.get_by_placeholder('Type Password')

            phone_count = await phone_field.count()
            pass_count = await password_field.count()
            self.log(f"   📋 Found phone={phone_count}, password={pass_count} via placeholder")

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

            # Click Login button
            await asyncio.sleep(0.5)
            # IMPORTANT: TIX.id has TWO Login buttons - header (fake) and form (real)
            # Must use .last to get the form button, not .first!
            login_button = page.get_by_role('button', name='Login').last
            if await login_button.count() > 0:
                await login_button.click()
                self.log("   📤 Clicked Login button")
            else:
                await page.keyboard.press('Enter')
                self.log("   📤 Pressed Enter to submit")

            # Wait for login
            await asyncio.sleep(5)

            # Verify login
            current_url = page.url
            self.log(f"   📍 Post-login URL: {current_url}")

            if '/login' not in current_url or 'login-success' in current_url:
                # Capture JWT token
                try:
                    token = await page.evaluate("localStorage.getItem('authentication_token')")
                    if token:
                        self.auth_token = token
                        self.log("✅ Logged in and JWT token captured")
                        return True
                except Exception:
                    pass
                self.log("✅ Logged in successfully")
                return True
            else:
                self.log("⚠️ Login may have failed - still on login page")
                return False

        except Exception as e:
            self.log(f"⚠️ Login failed: {e}")
            return False
