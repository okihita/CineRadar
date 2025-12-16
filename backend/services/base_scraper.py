"""
CineRadar Base Scraper
Common functionality for all TIX.id scrapers.
"""
import asyncio
import os
import time
from typing import Dict, Optional

from playwright.async_api import async_playwright, Page, BrowserContext

from backend.config import API_BASE, APP_BASE, USER_AGENT, VIEWPORT, LOCALE, TIMEZONE


class BaseScraper:
    """Base class for TIX.id scrapers with common browser and auth functionality."""
    
    def __init__(self):
        self.api_base = API_BASE
        self.app_base = APP_BASE
        self.auth_token: Optional[str] = None
        self._phone = os.environ.get('TIX_PHONE_NUMBER', '')
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
            await asyncio.sleep(3)
            
            # Strip 62 prefix from phone
            phone_clean = self._phone.lstrip('+').lstrip('62')
            
            # Check for input fields
            inputs = page.locator('input')
            input_count = await inputs.count()
            self.log(f"   📋 Found {input_count} input fields")
            
            if input_count >= 2:
                # Fill phone (first input)
                await inputs.nth(0).click()
                await asyncio.sleep(0.5)
                await page.keyboard.type(phone_clean, delay=50)
                self.log(f"   📱 Typed phone: {phone_clean[:4]}***")
                await asyncio.sleep(0.5)
                
                # Fill password (second input)
                await inputs.nth(1).click()
                await asyncio.sleep(0.5)
                await page.keyboard.type(self._password, delay=50)
                self.log("   🔑 Typed password")
                await asyncio.sleep(0.5)
            
            # Click Login button
            login_button = page.get_by_text('Login', exact=True).first
            if await login_button.count() > 0:
                await login_button.click()
                self.log("   📤 Clicked Login button")
            else:
                await page.keyboard.press('Tab')
                await page.keyboard.press('Enter')
                self.log("   📤 Pressed Tab+Enter to submit")
            
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
                except:
                    pass
                self.log("✅ Logged in successfully")
                return True
            else:
                self.log("⚠️ Login may have failed - still on login page")
                return False
                
        except Exception as e:
            self.log(f"⚠️ Login failed: {e}")
            return False
