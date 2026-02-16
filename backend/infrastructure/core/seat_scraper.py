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
from types import MappingProxyType
from typing import Any, ClassVar, cast

import httpx

from backend.infrastructure.core.config import USER_AGENT
from backend.infrastructure.repositories import FirestoreTokenRepository
from backend.infrastructure.scrapers.base import BaseScraper


class SeatScraper(BaseScraper):
    """Seat occupancy scraper for TIX.id using direct API calls."""

    # Merchant to API path mapping (immutable)
    MERCHANT_PATHS: ClassVar[MappingProxyType[str, str]] = MappingProxyType(
        {
            "CGV": "cgv",
            "XXI": "xxi",
            "Cinépolis": "cinepolis",
            "CINEPOLIS": "cinepolis",
        }
    )

    def __init__(self) -> None:
        super().__init__()

    def load_token_from_storage(self) -> bool:
        """
        Load JWT token from Firestore storage.

        Returns:
            True if token loaded successfully
        """
        try:
            repo = FirestoreTokenRepository()
            token = repo.get_current()
            if token and token.token:
                # Strip quotes that may have been captured from localStorage
                self.auth_token = token.token.strip('"')
                self.log("✅ Loaded token from storage")
                return True
        except Exception as e:
            self.log(f"⚠️ Failed to load token: {e}")
        self.log("⚠️ No valid token in storage")
        return False

    def _get_merchant_path(self, merchant: str) -> str:
        """Convert merchant name to API path."""
        return self.MERCHANT_PATHS.get(merchant, merchant.lower())

    def _count_seat(self, status: int, counters: dict[str, int]) -> int:
        """
        Helper to increment counters based on status.

        Status codes (verified Dec 23, 2025):
        - 1: Available (can purchase)
        - 5: Unavailable (sold or blocked - cannot distinguish)
        - 6: Unavailable (sold or blocked - cannot distinguish)

        Returns:
            1 if available, 0 if unavailable, -1 if other
        """
        if status == 1:  # Available
            counters["available"] += 1
            counters["total"] += 1
            return 1
        elif status in (5, 6):  # Unavailable (sold or blocked)
            counters["unavailable"] += 1
            counters["total"] += 1
            return 0
        # Other statuses (aisles, etc) are ignored in counts
        return -1

    def calculate_occupancy(self, layout_data: dict[str, Any]) -> dict[str, Any]:
        """
        Parse seat layout response and calculate occupancy.
        Handles both nested (XXI/CGV) and flat (Cinépolis) structures.

        Note: API cannot distinguish "sold" from "blocked/maintenance".
        Occupancy is an upper-bound estimate.
        """
        counters = {"total": 0, "unavailable": 0, "available": 0}
        layout_grid = []

        data = layout_data.get("data", {})
        seat_map = data.get("seat_map", [])

        for item in seat_map:
            # Check if this is a row container (XXI/CGV) or a direct seat (Cinépolis)
            if "seat_rows" in item:
                # Nested structure (XXI/CGV)
                row_name = item.get("row_name", "")
                row_statuses = []
                for seat in item.get("seat_rows", []):
                    status_code = self._count_seat(seat.get("status", 0), counters)
                    if status_code != -1:
                        row_statuses.append(status_code)
                if row_statuses:
                    layout_grid.append([row_name, row_statuses])
            else:
                # Flat structure (Cinépolis/CGV B2B)
                row_name = item.get("row_name", "ALL")
                status = item.get("seat_status", item.get("status", 0))
                seat_yn = item.get("seat_yn", "1")  # Default to "1" if missing (assume is seat)

                # Logic for CGV B2B format which uses seat_yn="0" for aisles
                if seat_yn == "0":
                    # This is an aisle/gap, ignore or track as space?
                    # For occupancy calcs, we ignore.
                    continue

                # Custom status mapping for this format
                # If seat_yn="1" and status=0 -> Sold
                if seat_yn == "1" and status == 0:
                    counters["unavailable"] += 1
                    counters["total"] += 1
                    status_code = 0
                else:
                    # Use standard counter for other cases (1, 5, 6)
                    status_code = self._count_seat(status, counters)

                if status_code != -1:
                    # Find or create row in layout_grid
                    # layout_grid is list of [row_name, [statuses]]
                    # We need to preserve order if possible, or just append.
                    # Since data usually comes sorted by row, we can check last element.

                    if not layout_grid or layout_grid[-1][0] != row_name:
                        layout_grid.append([row_name, []])

                    layout_grid[-1][1].append(status_code)

        total_seats = counters["total"]
        occupancy_pct = (counters["unavailable"] / total_seats * 100) if total_seats > 0 else 0

        return {
            "total_seats": total_seats,
            "unavailable_seats": counters["unavailable"],
            "available_seats": counters["available"],
            "occupancy_pct": round(occupancy_pct, 1),
            "layout": layout_grid,
        }

    async def _fetch_seat_layout_api(
        self, showtime_id: str, merchant: str
    ) -> dict[str, Any] | None:
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
            "Authorization": f"Bearer {self.auth_token}",
            "Accept": "application/json",
            "User-Agent": USER_AGENT,
        }

        params = {
            "show_time_id": showtime_id,
            "tz": "7",  # UTC+7 offset (not timezone name)
        }

        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(url, headers=headers, params=params)
                if response.status_code == 200:
                    data = response.json()
                    if data.get("success"):
                        return cast("dict[str, Any]", data)
                    else:
                        self.log(
                            f"   ⚠️ API error: {data.get('error', {}).get('message', 'Unknown')}"
                        )
                elif response.status_code == 401:
                    self.log("   ⚠️ Auth token expired - need to re-login")
                else:
                    body = response.text
                    self.log(f"   ⚠️ API returned {response.status_code}: {body[:200]}")
        except httpx.RequestError as e:
            self.log(f"   ⚠️ HTTP request failed: {e}")
        except Exception as e:
            self.log(f"   ⚠️ Unexpected error during API call: {e}")

        return None

    async def scrape_showtime_occupancy(
        self, showtime_info: dict[str, Any]
    ) -> dict[str, Any] | None:
        """
        Scrape seat occupancy for a single showtime via direct API call.

        Args:
            showtime_info: Dict with showtime details (must include showtime_id, merchant)

        Returns:
            Dict with occupancy data or None
        """
        show_time_id = showtime_info.get("showtime_id")
        merchant = showtime_info.get("merchant")

        if not show_time_id or not merchant:
            return None

        layout_data = await self._fetch_seat_layout_api(show_time_id, merchant)

        if not layout_data:
            return None

        occupancy = self.calculate_occupancy(layout_data)

        return {
            "date": showtime_info.get("date", datetime.now().strftime("%Y-%m-%d")),
            "showtime_id": show_time_id,
            "movie_id": showtime_info.get("movie_id"),
            "movie_title": showtime_info.get("movie_title"),
            "theatre_id": showtime_info.get("theatre_id"),
            "theatre_name": showtime_info.get("theatre_name"),
            "city": showtime_info.get("city"),
            "merchant": merchant,
            "room_category": showtime_info.get("room_category"),
            "showtime": showtime_info.get("showtime"),
            "scraped_at": datetime.now().isoformat(),
            "raw_api_response": layout_data,
            **occupancy,
        }

    async def scrape_all_showtimes_api_only(
        self, showtimes: list[dict[str, Any]], delay_between_requests: float = 1.0
    ) -> list[dict[str, Any]]:
        """
        Scrape seat occupancy using API calls only (no browser).

        Requires auth_token to be set beforehand via load_token_from_storage().

        Args:
            showtimes: List of showtime info dicts
            delay_between_requests: Base rate limiting delay (with jitter applied)

        Returns:
            List of occupancy data dicts
        """
        import random

        if not self.auth_token:
            self.log("⚠️ No auth token - call load_token_from_storage() first")
            return []

        if not showtimes:
            self.log("No showtimes to scrape")
            return []

        self.log(f"⚡ Starting API-only seat scrape for {len(showtimes)} showtimes...")
        self.log(f"   Rate limit: {delay_between_requests}s (±20% jitter)")

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

            # Anti-DDoS: rate limiting with jitter (±20%)
            jitter = delay_between_requests * random.uniform(0.8, 1.2)
            await asyncio.sleep(jitter)

        elapsed = time.time() - start_time
        self.log(f"🏁 API scrape complete: {len(results)}/{len(showtimes)} in {elapsed:.1f}s")
        return results
