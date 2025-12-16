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
            # Navigate to login
            await page.goto(f'{self.app_base}/login', wait_until='networkidle')
            await asyncio.sleep(5)
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
            
            # Click Login
            login_button = page.get_by_role('button', name='Login').first
            if await login_button.count() > 0:
                await login_button.click()
                self.log("   📤 Clicked Login button")
            else:
                await page.keyboard.press('Enter')
                self.log("   📤 Pressed Enter")
            
            await asyncio.sleep(5)
            await self._save_screenshot(page, "04_after_login_attempt")
            
            # Check result
            current_url = page.url
            self.log(f"   📍 Post-login URL: {current_url}")
            
            # Handle about:blank redirect - go back to app to get localStorage
            if current_url == 'about:blank' or '/login' not in current_url:
                self.log("   🔄 Navigating to home to capture token...")
                await page.goto(f'{self.app_base}/home', wait_until='networkidle')
                await asyncio.sleep(3)
                await self._save_screenshot(page, "05_after_redirect_to_home")
                current_url = page.url
                self.log(f"   📍 Now at: {current_url}")
            
            # Try to capture JWT from localStorage
            try:
                token = await page.evaluate("localStorage.getItem('authentication_token')")
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
                    self.log("⚠️ No token in localStorage")
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
