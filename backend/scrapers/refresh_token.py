#!/usr/bin/env python3
"""
CineRadar Token Refresh Script
Logs into TIX.id and stores the JWT token in Firestore.

Usage:
    python -m backend.scrapers.refresh_token [--visible]
"""
import argparse
import asyncio
import sys

from backend.services.base_scraper import BaseScraper
from backend.services.token_storage import store_token, get_storage


class TokenRefresher(BaseScraper):
    """Dedicated scraper for token refresh only."""
    
    async def refresh_token(self, headless: bool = True) -> bool:
        """
        Login to TIX.id and store the JWT token.
        
        Returns:
            True if token was refreshed successfully
        """
        self.log("🔐 Starting token refresh...")
        
        playwright, browser, context, page = await self._init_browser(headless)
        
        try:
            # Login and capture token
            success = await self._login(page)
            
            if success and self.auth_token:
                # Store token in Firestore
                stored = store_token(self.auth_token, self._phone)
                
                if stored:
                    self.log("✅ Token refresh complete!")
                    return True
                else:
                    self.log("⚠️ Login succeeded but token storage failed")
                    return False
            else:
                self.log("❌ Login failed - no token captured")
                return False
                
        finally:
            await self._close_browser(playwright, browser, context, page)


def main():
    parser = argparse.ArgumentParser(description='Refresh TIX.id JWT Token')
    parser.add_argument('--visible', action='store_true', help='Show browser window')
    parser.add_argument('--check', action='store_true', help='Check current token status')
    args = parser.parse_args()
    
    if args.check:
        # Just check token status
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
    
    # Refresh token
    async def _run():
        refresher = TokenRefresher()
        return await refresher.refresh_token(headless=not args.visible)
    
    success = asyncio.run(_run())
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()
