"""
CineRadar Base Scraper

Common functionality for all TIX.id scrapers.
Provides browser initialization, login, and logging.
"""

import asyncio
import os
import time

from playwright.async_api import Browser, BrowserContext, Page, Playwright, async_playwright

from backend.config import API_BASE, APP_BASE, LOCALE, TIMEZONE, USER_AGENT, VIEWPORT
from backend.domain.errors import LoginFailedError, PageLoadError


class BaseScraper:
    """Base class for TIX.id scrapers with common browser and auth functionality.

    Provides:
    - Browser initialization with anti-detection
    - Login handling
    - Token capture
    - Logging utilities

    Subclasses should implement specific scraping logic.

    Example:
        class MyScraper(BaseScraper):
            async def scrape(self):
                playwright, browser, context, page = await self._init_browser()
                try:
                    # ... scraping logic ...
                finally:
                    await self._close_browser(playwright, browser, context, page)
    """

    def __init__(self):
        """Initialize with configuration from environment."""
        self.api_base = API_BASE
        self.app_base = APP_BASE
        self.auth_token: str | None = None
        self._phone = os.environ.get("TIX_PHONE_NUMBER", "")
        self._password = os.environ.get("TIX_PASSWORD", "")

    def log(self, message: str) -> None:
        """Print timestamped log message.

        Args:
            message: Message to log
        """
        print(f"[{time.strftime('%H:%M:%S')}] {message}")

    async def _init_browser(
        self, headless: bool = True
    ) -> tuple[Playwright, Browser, BrowserContext, Page]:
        """Initialize Playwright browser with anti-detection settings.

        Args:
            headless: Run without visible window

        Returns:
            Tuple of (playwright, browser, context, page)

        Raises:
            PageLoadError: If browser fails to initialize
        """
        try:
            playwright = await async_playwright().start()
            browser = await playwright.chromium.launch(
                headless=headless,
                args=["--disable-blink-features=AutomationControlled", "--no-sandbox"],
            )

            context = await browser.new_context(
                viewport=VIEWPORT,
                user_agent=USER_AGENT,
                locale=LOCALE,
                timezone_id=TIMEZONE,
            )

            page = await context.new_page()

            # Anti-detection: hide webdriver flag
            await page.add_init_script(
                "Object.defineProperty(navigator, 'webdriver', { get: () => undefined });"
            )

            return playwright, browser, context, page

        except Exception as e:
            raise PageLoadError(f"Failed to initialize browser: {e}") from e

    async def _close_browser(
        self, playwright: Playwright, browser: Browser, context: BrowserContext, page: Page
    ) -> None:
        """Clean up browser resources.

        Args:
            playwright: Playwright instance
            browser: Browser instance
            context: Browser context
            page: Page instance
        """
        try:
            await page.close()
            await context.close()
            await browser.close()
            await playwright.stop()
        except Exception:
            pass  # Ignore cleanup errors

    async def _login(self, page: Page) -> bool:
        """Login to TIX.id and capture JWT token.

        Args:
            page: Playwright page

        Returns:
            True if login successful

        Raises:
            LoginFailedError: If login fails
        """
        if not self._phone or not self._password:
            raise LoginFailedError(
                "No credentials provided - set TIX_PHONE_NUMBER and TIX_PASSWORD"
            )

        self.log("🔐 Logging in to TIX.id...")

        try:
            await page.goto(f"{self.app_base}/login", wait_until="networkidle", timeout=60000)
            await asyncio.sleep(8)  # Flutter needs time to render

            # Strip 62 prefix from phone
            phone_clean = self._phone.lstrip("+").lstrip("62")

            # Try get_by_placeholder (Flutter friendly)
            phone_field = page.get_by_placeholder("Type your phone number")
            password_field = page.get_by_placeholder("Type Password")

            phone_count = await phone_field.count()
            pass_count = await password_field.count()
            self.log(f"   📋 Found phone={phone_count}, password={pass_count} fields")

            if phone_count == 0 or pass_count == 0:
                raise LoginFailedError("Login form not found - page may not have loaded")

            # Fill credentials
            await phone_field.click()
            await asyncio.sleep(0.5)
            await page.keyboard.type(phone_clean, delay=30)
            self.log(f"   📱 Typed phone: {phone_clean[:4]}***")

            await password_field.click()
            await asyncio.sleep(0.5)
            await page.keyboard.type(self._password, delay=30)
            self.log("   🔑 Typed password")

            # Click Login button
            # IMPORTANT: TIX.id has TWO Login buttons - header (fake) and form (real)
            # Must use .last to get the form button!
            await asyncio.sleep(0.5)
            login_button = page.get_by_role("button", name="Login").last

            if await login_button.count() > 0:
                await login_button.click()
                self.log("   📤 Clicked Login button")
            else:
                await page.keyboard.press("Enter")
                self.log("   📤 Pressed Enter to submit")

            # Wait for login to complete
            await asyncio.sleep(5)

            # Verify login by checking URL
            current_url = page.url
            self.log(f"   📍 Post-login URL: {current_url}")

            if "/login" not in current_url or "login-success" in current_url:
                # Try to capture JWT token
                await self._capture_token(page)
                self.log("✅ Login successful")
                return True
            else:
                raise LoginFailedError("Still on login page after submission")

        except LoginFailedError:
            raise
        except Exception as e:
            raise LoginFailedError(f"Login failed: {e}") from e

    async def _capture_token(self, page: Page) -> bool:
        """Capture JWT token from browser storage.

        Args:
            page: Playwright page

        Returns:
            True if token captured
        """
        try:
            # Try localStorage first
            for key in ["authentication_token", "token", "auth_token", "jwt", "access_token"]:
                token = await page.evaluate(f"localStorage.getItem('{key}')")
                if token:
                    self.auth_token = token
                    self.log(f"   ✅ Token captured from localStorage['{key}']")
                    return True

            # Try cookies
            context = page.context
            cookies = await context.cookies()
            for cookie in cookies:
                if "token" in cookie["name"].lower() or "auth" in cookie["name"].lower():
                    self.auth_token = cookie["value"]
                    self.log(f"   ✅ Token captured from cookie['{cookie['name']}']")
                    return True

            return False

        except Exception as e:
            self.log(f"   ⚠️ Could not capture token: {e}")
            return False

    def has_valid_token(self) -> bool:
        """Check if a token has been captured.

        Returns:
            True if auth_token is set
        """
        return bool(self.auth_token)
