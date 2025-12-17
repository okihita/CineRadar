#!/usr/bin/env python3
"""
CineRadar Token Refresh Script
Logs into TIX.id and stores the JWT token in Firestore.

Usage:
    python -m backend.scrapers.refresh_token [--visible] [--debug-screenshots]
"""
import argparse
import asyncio
import os
import sys
from pathlib import Path

from backend.services.base_scraper import BaseScraper
from backend.services.token_storage import store_token, get_storage


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
            
            # Click Login - listen for popup/new page
            login_button = page.get_by_role('button', name='Login').first
            if await login_button.count() > 0:
                # Try to catch any new page/popup that opens
                try:
                    async with context.expect_page(timeout=10000) as new_page_info:
                        await login_button.click()
                        self.log("   📤 Clicked Login, waiting for new page...")
                    
                    new_page = await new_page_info.value
                    self.log(f"   📍 New page opened: {new_page.url}")
                    await new_page.wait_for_load_state('networkidle')
                    await asyncio.sleep(3)
                    
                    # Try to get token from new page
                    new_page_url = new_page.url
                    self.log(f"   📍 New page final URL: {new_page_url}")
                    await new_page.screenshot(path=str(self.screenshot_dir / "04a_new_page.png"))
                    
                    # Try localStorage on new page
                    all_keys = await new_page.evaluate("Object.keys(localStorage)")
                    self.log(f"   🔑 New page localStorage: {all_keys}")
                    
                    page = new_page  # Switch to new page
                    
                except Exception as popup_error:
                    self.log(f"   ⚠️ No popup detected: {popup_error}")
                    # Fall back to waiting for navigation on same page
                    await asyncio.sleep(5)
            else:
                await page.keyboard.press('Enter')
                self.log("   📤 Pressed Enter")
                await asyncio.sleep(5)
            
            await self._save_screenshot(page, "04_after_login_attempt")
            
            # Check result
            current_url = page.url
            self.log(f"   📍 Post-login URL: {current_url}")
            
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
    parser.add_argument('--debug-screenshots', action='store_true', help='Save screenshots at each step')
    args = parser.parse_args()
    
    if args.check:
        storage = get_storage()
        info = storage.get_token_info()
        if info:
            print(f"📋 Token Info:")
            print(f"   Stored at: {info.get('stored_at')}")
            print(f"   Expires at: {info.get('expires_at')}")
            print(f"   Phone: {info.get('phone')}")
            print(f"   Valid: {storage.is_token_valid()}")
        else:
            print("❌ No token found")
        return
    
    async def _run():
        refresher = TokenRefresher(debug_screenshots=args.debug_screenshots)
        return await refresher.refresh_token(headless=not args.visible)
    
    success = asyncio.run(_run())
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()
