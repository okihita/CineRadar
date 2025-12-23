"""
CineRadar Seat Scraper
Scrapes seat occupancy data from TIX.id for all showtimes.

Approach:
1. Load JWT token from Firestore (refreshed daily by token-refresh workflow)
2. Use direct API calls with aiohttp for seat layout data
3. This bypasses Flutter UI navigation issues
"""
import asyncio
import time
from datetime import datetime

import aiohttp

from backend.config import USER_AGENT
from backend.infrastructure._legacy.base_scraper import BaseScraper
from backend.infrastructure._legacy.token_storage import get_token


class SeatScraper(BaseScraper):
    """Seat occupancy scraper for TIX.id using direct API calls."""

    # Merchant to API path mapping
    MERCHANT_PATHS = {
        'CGV': 'cgv',
        'XXI': 'xxi',
        'Cinépolis': 'cinepolis',
        'CINEPOLIS': 'cinepolis',
    }

    def __init__(self):
        super().__init__()

    def load_token_from_storage(self) -> bool:
        """
        Load JWT token from Firestore storage.

        Returns:
            True if token loaded successfully
        """
        token = get_token()
        if token:
            # Strip quotes that may have been captured from localStorage
            self.auth_token = token.strip('"')
            self.log("✅ Loaded token from storage")
            return True
        self.log("⚠️ No valid token in storage")
        return False

    def _get_merchant_path(self, merchant: str) -> str:
        """Convert merchant name to API path."""
        return self.MERCHANT_PATHS.get(merchant, merchant.lower())

    def calculate_occupancy(self, layout_data: dict) -> dict:
        """
        Parse seat layout response and calculate occupancy.

        B2B API format:
        - seat_map[].seat_code: Row letter (A, B, C, ...)
        - seat_map[].seat_rows[].seat_row: Seat ID (A1, A2, ...)
        - seat_map[].seat_rows[].status:
            1 = sold
            5 = available
            6 = blocked/reserved

        Returns:
            Dict with total_seats, sold_seats, available_seats, occupancy_pct
        """
        total_seats = 0
        sold_seats = 0
        available_seats = 0
        blocked_seats = 0

        data = layout_data.get('data', {})
        seat_map = data.get('seat_map', [])

        for row in seat_map:
            for seat in row.get('seat_rows', []):
                status = seat.get('status', 0)

                if status == 1:  # Sold
                    sold_seats += 1
                    total_seats += 1
                elif status == 5:  # Available
                    available_seats += 1
                    total_seats += 1
                elif status == 6:  # Blocked/reserved
                    blocked_seats += 1
                    # Don't count blocked in total for occupancy calculation

        # Calculate occupancy based on sellable seats only
        sellable = sold_seats + available_seats
        occupancy_pct = (sold_seats / sellable * 100) if sellable > 0 else 0

        return {
            'total_seats': total_seats,
            'sold_seats': sold_seats,
            'available_seats': available_seats,
            'blocked_seats': blocked_seats,
            'occupancy_pct': round(occupancy_pct, 1),
        }

    async def _fetch_seat_layout_api(
        self,
        showtime_id: str,
        merchant: str
    ) -> dict | None:
        """
        Fetch seat layout via direct API call using JWT token.

        This is more reliable than browser navigation for Flutter apps.

        Args:
            showtime_id: The showtime ID
            merchant: Cinema chain (CGV, XXI, Cinépolis)

        Returns:
            Dict with layout data or None if failed
        """
        if not self.auth_token:
            self.log("⚠️ No auth token - cannot call layout API")
            return None

        merchant_path = self._get_merchant_path(merchant)
        # Use B2B API endpoint (not consumer API)
        url = f"https://api-b2b.tix.id/v1/movies/{merchant_path}/layout"

        headers = {
            'Authorization': f'Bearer {self.auth_token}',
            'Accept': 'application/json',
            'User-Agent': USER_AGENT,
        }

        params = {
            'show_time_id': showtime_id,
            'tz': '7'  # UTC+7 offset (not timezone name)
        }

        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(url, headers=headers, params=params) as response:
                    if response.status == 200:
                        data = await response.json()
                        if data.get('success'):
                            return data
                        else:
                            self.log(f"   ⚠️ API error: {data.get('error', {}).get('message', 'Unknown')}")
                    elif response.status == 401:
                        self.log("   ⚠️ Auth token expired - need to re-login")
                    else:
                        self.log(f"   ⚠️ API returned {response.status}")
        except Exception as e:
            self.log(f"   ⚠️ API call failed: {e}")

        return None

    async def scrape_showtime_occupancy(
        self,
        showtime_info: dict
    ) -> dict | None:
        """
        Scrape seat occupancy for a single showtime via direct API call.

        Args:
            showtime_info: Dict with showtime details (must include showtime_id, merchant)

        Returns:
            Dict with occupancy data or None
        """
        show_time_id = showtime_info.get('showtime_id')
        merchant = showtime_info.get('merchant')

        if not show_time_id or not merchant:
            return None

        layout_data = await self._fetch_seat_layout_api(show_time_id, merchant)

        if not layout_data:
            return None

        occupancy = self.calculate_occupancy(layout_data)

        return {
            'date': showtime_info.get('date', datetime.now().strftime('%Y-%m-%d')),
            'showtime_id': show_time_id,
            'movie_id': showtime_info.get('movie_id'),
            'movie_title': showtime_info.get('movie_title'),
            'theatre_id': showtime_info.get('theatre_id'),
            'theatre_name': showtime_info.get('theatre_name'),
            'city': showtime_info.get('city'),
            'merchant': merchant,
            'room_category': showtime_info.get('room_category'),
            'showtime': showtime_info.get('showtime'),
            'scraped_at': datetime.now().isoformat(),
            **occupancy
        }

    async def _init_browser_and_auth(
        self,
        headless: bool = True
    ) -> tuple:
        """
        Initialize browser and login to TIX.id using base class methods.

        Returns:
            Tuple of (playwright, browser, context, page)
        """
        playwright, browser, context, page = await self._init_browser(headless)
        await self._login(page)
        return playwright, browser, context, page

    async def scrape_all_showtimes(
        self,
        showtimes: list[dict],
        headless: bool = True,
        batch_size: int = 10,
        delay_between_requests: float = 0.5
    ) -> list[dict]:
        """
        Scrape seat occupancy for a list of showtimes.

        Args:
            showtimes: List of showtime info dicts
            headless: Run browser in headless mode
            batch_size: Number of requests before pausing
            delay_between_requests: Seconds to wait between requests

        Returns:
            List of occupancy data dicts
        """
        if not showtimes:
            self.log("No showtimes to scrape")
            return []

        self.log(f"🎬 Starting seat scrape for {len(showtimes)} showtimes...")

        playwright, browser, context, page = await self._init_browser_and_auth(headless)

        results = []
        start_time = time.time()

        try:
            for i, showtime_info in enumerate(showtimes, 1):
                result = await self.scrape_showtime_occupancy(showtime_info)

                if result:
                    results.append(result)
                    self.log(
                        f"   {i}/{len(showtimes)}: {showtime_info.get('theatre_name', 'Unknown')} "
                        f"{showtime_info.get('showtime', '')} - {result['occupancy_pct']}% sold"
                    )
                else:
                    self.log(
                        f"   {i}/{len(showtimes)}: {showtime_info.get('theatre_name', 'Unknown')} "
                        f"{showtime_info.get('showtime', '')} - ❌ Failed"
                    )

                # Rate limiting
                await asyncio.sleep(delay_between_requests)

                # Progress update every batch_size
                if i % batch_size == 0:
                    elapsed = time.time() - start_time
                    avg_time = elapsed / i
                    remaining = (len(showtimes) - i) * avg_time
                    self.log(f"   Progress: {i}/{len(showtimes)} | ETA: {remaining/60:.1f}m")

        finally:
            await self._close_browser(playwright, browser, context, page)

        self.log(f"🏁 Seat scrape complete: {len(results)}/{len(showtimes)} successful")
        return results

    async def scrape_all_showtimes_api_only(
        self,
        showtimes: list[dict],
        delay_between_requests: float = 0.3
    ) -> list[dict]:
        """
        Scrape seat occupancy using API calls only (no browser).

        Requires auth_token to be set beforehand via load_token_from_storage().

        Args:
            showtimes: List of showtime info dicts
            delay_between_requests: Rate limiting delay

        Returns:
            List of occupancy data dicts
        """
        if not self.auth_token:
            self.log("⚠️ No auth token - call load_token_from_storage() first")
            return []

        if not showtimes:
            self.log("No showtimes to scrape")
            return []

        self.log(f"⚡ Starting API-only seat scrape for {len(showtimes)} showtimes...")

        results = []
        start_time = time.time()

        for i, showtime_info in enumerate(showtimes, 1):
            result = await self.scrape_showtime_occupancy(showtime_info)

            if result:
                results.append(result)
                self.log(
                    f"   {i}/{len(showtimes)}: {showtime_info.get('theatre_name', 'Unknown')[:20]} "
                    f"{showtime_info.get('showtime', '')} - {result['occupancy_pct']}% sold"
                )
            else:
                self.log(
                    f"   {i}/{len(showtimes)}: {showtime_info.get('theatre_name', 'Unknown')[:20]} "
                    f"{showtime_info.get('showtime', '')} - ❌ Failed"
                )

            await asyncio.sleep(delay_between_requests)

        elapsed = time.time() - start_time
        self.log(f"🏁 API scrape complete: {len(results)}/{len(showtimes)} in {elapsed:.1f}s")
        return results
