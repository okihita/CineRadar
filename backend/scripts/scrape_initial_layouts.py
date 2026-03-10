#!/usr/bin/env python3
"""Initial Layout Scraper - Scrape seat layouts for all showtimes (Concurrent).

This captures the "baseline" unavailable seats (blocked/broken) before
any sales happen, allowing accurate audience calculation later.

Usage:
    PYTHONPATH=. uv run python backend/scripts/scrape_initial_layouts.py
    PYTHONPATH=. uv run python backend/scripts/scrape_initial_layouts.py --date 2026-03-02
    PYTHONPATH=. uv run python backend/scripts/scrape_initial_layouts.py --limit 10
"""

import argparse
import asyncio
import gzip
import json
import logging
import os
import sys
import time
from datetime import UTC, datetime
from typing import Any

sys.path.insert(0, ".")

import httpx
from aiolimiter import AsyncLimiter
from google.cloud.firestore import AsyncClient
from google.oauth2 import service_account

from backend.domain.time import JAKARTA_TZ
from backend.infrastructure.firestore_collections import (
    MOVIE_PERFORMANCE,
    MOVIE_PERFORMANCE_V2,
    MOVIES,
    SCHEDULES,
    SCHEDULES_V2,
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger(__name__)

# Constants
RATE_LIMIT = 5  # requests per second (conservative to avoid rate limiting)
MAX_CONCURRENT = 20  # max concurrent tasks
TOKEN_REFRESH_THRESHOLD = 25 * 60  # 25 minutes in seconds
MERCHANT_PATHS = {
    "CGV": "cgv",
    "XXI": "xxi",
    "Cinépolis": "cinepolis",
    "CINEPOLIS": "cinepolis",
}


def get_merchant_path(merchant: str) -> str:
    """Convert merchant name to API path."""
    return MERCHANT_PATHS.get(merchant, merchant.lower())


async def get_firestore_async_client() -> AsyncClient:
    """Initialize async Firestore client from service account."""
    sa_json = os.environ.get("FIREBASE_SERVICE_ACCOUNT")
    if sa_json:
        sa_info = json.loads(sa_json)
        credentials = service_account.Credentials.from_service_account_info(sa_info)  # type: ignore[no-untyped-call]
        return AsyncClient(credentials=credentials, project=sa_info["project_id"])
    return AsyncClient()


class TokenManager:
    """Manages TIX API token with lock-protected refresh."""

    def __init__(self) -> None:
        self.token: str | None = None
        self.token_acquired_at: float = 0
        self.lock = asyncio.Lock()
        self._db: AsyncClient | None = None

    async def initialize(self, db: AsyncClient) -> str | None:
        """Initialize token with forced refresh.

        Always refreshes the token at startup since the stored token is likely
        expired (access tokens expire in ~30 min, but daily scrapes run 24h apart).
        This avoids the race condition where the first API calls fail with 401.
        """
        self._db = db
        # Force refresh - don't trust stored token's age
        new_token = await self._refresh_token_via_api()
        if new_token:
            self.token = new_token
            self.token_acquired_at = time.time()
            logger.info("✅ Token refreshed at startup")
        else:
            # Fallback: try to use stored token (may be expired)
            logger.warning("⚠️ Token refresh failed, trying stored token...")
            self.token = await self._fetch_token_from_firestore()
            self.token_acquired_at = time.time()
        return self.token

    async def _fetch_token_from_firestore(self) -> str | None:
        """Get current token from Firestore."""
        if self._db is None:
            return None
        doc = await self._db.collection("auth_tokens").document("tix_jwt").get()
        if not doc.exists:
            return None

        data = doc.to_dict()
        token = data.get("token") or data.get("access_token")
        return str(token) if token else None

    async def _refresh_token_via_api(self) -> str | None:
        """Refresh access token via API."""
        if self._db is None:
            return None
        doc = await self._db.collection("auth_tokens").document("tix_jwt").get()
        if not doc.exists:
            return None

        refresh_token = doc.to_dict().get("refresh_token")
        if not refresh_token:
            return None

        url = "https://api-b2b.tix.id/v1/users/refresh"
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    url,
                    headers={
                        "Authorization": f"Bearer {refresh_token}",
                        "Content-Type": "application/json",
                        "platform": "web",
                    },
                    timeout=30,
                )

                if response.status_code == 200:
                    data = response.json()
                    new_token = data.get("data", {}).get("token")
                    if new_token:
                        # Update Firestore
                        await self._db.collection("auth_tokens").document("tix_jwt").set(
                            {
                                "access_token": new_token,
                                "refresh_token": refresh_token,
                                "updated_at": datetime.now(UTC).isoformat(),
                            },
                            merge=True,
                        )
                        logger.info("✅ Token refreshed successfully")
                        return str(new_token)
        except Exception as e:
            logger.error(f"Token refresh failed: {e}")

        return None

    async def get_valid_token(self) -> str | None:
        """Get a valid token, refreshing if necessary (thread-safe)."""
        async with self.lock:
            elapsed = time.time() - self.token_acquired_at

            if elapsed > TOKEN_REFRESH_THRESHOLD or self.token is None:
                logger.info(f"🔄 Token age {elapsed / 60:.1f}min, refreshing...")
                new_token = await self._refresh_token_via_api()
                if new_token:
                    self.token = new_token
                    self.token_acquired_at = time.time()
                else:
                    logger.critical("🚨 REFRESH TOKEN IS DEAD! 🚨")
                    logger.critical("Manual intervention required!")
                    return None

            return self.token

    async def force_refresh(self) -> str | None:
        """Force token refresh (called on 401 errors)."""
        async with self.lock:
            self.token = None
            new_token = await self._refresh_token_via_api()
            if new_token:
                self.token = new_token
                self.token_acquired_at = time.time()
            return new_token


async def fetch_seat_layout_async(
    client: httpx.AsyncClient,
    showtime_id: str,
    merchant: str,
    token: str,
) -> dict[str, Any] | None:
    """Fetch seat layout from TIX API (async)."""
    merchant_path = get_merchant_path(merchant)
    url = f"https://api-b2b.tix.id/v1/movies/{merchant_path}/layout"

    headers = {
        "Authorization": f"Bearer {token}",
        "Accept": "application/json",
        "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15",
    }
    params = {
        "show_time_id": showtime_id,
        "tz": "7",
    }
    try:
        response = await client.get(url, headers=headers, params=params, timeout=15)
        if response.status_code == 200:
            data: dict[str, Any] = response.json()
            if data.get("success"):
                return data
            else:
                error_msg = data.get("error", {}).get("message", "Unknown error")
                logger.warning(f"API error for {showtime_id}: {error_msg}")
        elif response.status_code == 401:
            logger.warning(f"Auth token expired (401) for {showtime_id}")
            # Special return to indicate an auth failure specifically
            return {"__auth_failure": True}
        else:
            logger.warning(f"HTTP {response.status_code} for {showtime_id}")
    except httpx.RequestError as e:
        logger.warning(f"Request failed for {showtime_id}: {e}")
    return None


def calculate_occupancy(seat_map: list[dict[str, Any]]) -> tuple[int, int, list[Any]]:
    """Calculate occupancy from seat map.

    Returns:
        Tuple of (total_seats, unavailable_seats, layout_grid)
    """
    total_seats = 0
    unavailable = 0
    layout_grid = []

    for item in seat_map:
        if "seat_rows" in item:
            # Nested structure (XXI/CGV)
            row_name = item.get("row_name", "")
            row_statuses = []
            for seat in item.get("seat_rows", []):
                status = seat.get("status", 0)
                if status == 1:  # Available
                    total_seats += 1
                    row_statuses.append(1)
                elif status in (5, 6):  # Unavailable
                    total_seats += 1
                    unavailable += 1
                    row_statuses.append(0)
            if row_statuses:
                layout_grid.append([row_name, row_statuses])
        else:
            # Flat structure (Cinépolis/CGV B2B)
            row_name = item.get("row_name", "ALL")
            status = item.get("seat_status", item.get("status", 0))
            seat_yn = item.get("seat_yn", "1")

            if seat_yn == "0":  # Aisle, skip
                continue

            seat_status_val = -1
            if seat_yn == "1" and status == 0:  # Sold
                total_seats += 1
                seat_status_val = 0
            elif status == 1:  # Available
                total_seats += 1
                seat_status_val = 1
            elif status in (5, 6):  # Unavailable
                total_seats += 1
                unavailable += 1
                seat_status_val = 0

            if seat_status_val != -1:
                if not layout_grid or layout_grid[-1][0] != row_name:
                    layout_grid.append([row_name, []])
                layout_grid[-1][1].append(seat_status_val)

    return total_seats, unavailable, layout_grid


async def load_showtimes_from_schedule(db: AsyncClient, date: str) -> list[dict[str, Any]]:
    """Load all showtimes from schedules_v2 or schedules (V1 fallback).

    Handles the nested structure:
    cities.{city}.theatres[].rooms[].all_showtimes[]

    Returns showtimes with both movie_id (schedule_id) and metadata_id for V2 compatibility.
    """
    # V2 Migration: Try schedules_v2 first, fallback to schedules (V1)
    movies_ref_v2 = db.collection(SCHEDULES_V2).document(date).collection(MOVIES)
    movies_ref_v1 = db.collection(SCHEDULES).document(date).collection(MOVIES)

    movie_docs = [doc async for doc in movies_ref_v2.stream()]
    use_v2_schema = True

    if not movie_docs:
        logger.info(f"📥 No data in {SCHEDULES_V2}/{date}/{MOVIES}, falling back to {SCHEDULES}")
        movie_docs = [doc async for doc in movies_ref_v1.stream()]
        use_v2_schema = False

    logger.info(f"📥 Loading showtimes from {SCHEDULES_V2 if use_v2_schema else SCHEDULES}/{date}/{MOVIES}/...")

    showtimes = []

    for movie_doc in movie_docs:
        movie = movie_doc.to_dict()
        movie_title = movie.get("title", "Unknown")
        cities = movie.get("cities", {})

        if use_v2_schema:
            # V2 schema: document ID is metadata_id, schedule_ids is an array
            metadata_id = movie_doc.id
            schedule_ids = movie.get("schedule_ids", [])
            movie_id = schedule_ids[0] if schedule_ids else metadata_id
        else:
            # V1 schema: movie_id is schedule_id, metadata_id may be in tix_metadata_id
            movie_id = movie.get("movie_id", movie_doc.id)
            metadata_id = movie.get("tix_metadata_id") or movie.get("metadata_id")

        for city_name, theatres in cities.items():
            for theatre in theatres:
                theatre_id = theatre.get("theatre_id")
                theatre_name = theatre.get("theatre_name")
                merchant = theatre.get("merchant")

                # New structure: showtimes are in rooms[].all_showtimes[]
                for room in theatre.get("rooms", []):
                    room_category = room.get("category", "")

                    for showtime_info in room.get("all_showtimes", []):
                        showtime_id = showtime_info.get("showtime_id")
                        showtime_time = showtime_info.get("time")

                        if showtime_id:
                            showtimes.append(
                                {
                                    "showtime_id": showtime_id,
                                    "showtime": showtime_time,
                                    "movie_id": movie_id,  # schedule_id for V1 compatibility
                                    "metadata_id": metadata_id,  # NEW: immutable movie entity ID for V2
                                    "movie_title": movie_title,
                                    "theatre_id": theatre_id,
                                    "theatre_name": theatre_name,
                                    "merchant": merchant,
                                    "city": city_name,
                                    "date": date,
                                    "room_category": room_category,
                                }
                            )

    logger.info(f"   Found {len(showtimes)} showtimes (schema: {'v2' if use_v2_schema else 'v1'})")
    return showtimes


async def check_checkpoint_async(
    db: AsyncClient,
    metadata_id: str | None,
    movie_id: str,
    date: str,
    showtime_id: str,
) -> bool:
    """Check if showtime already has baseline data (async)."""
    # Try V2 first if metadata_id available
    if metadata_id:
        doc_ref_v2 = (
            db.collection(MOVIE_PERFORMANCE_V2)
            .document(metadata_id)
            .collection("days")
            .document(date)
            .collection("showtimes")
            .document(showtime_id)
        )
        doc_v2 = await doc_ref_v2.get()
        if doc_v2.exists and "initial_unavailable" in doc_v2.to_dict():
            return True

    # Fallback to V1
    doc_ref_v1 = (
        db.collection(MOVIE_PERFORMANCE)
        .document(movie_id)
        .collection("days")
        .document(date)
        .collection("showtimes")
        .document(showtime_id)
    )
    doc_v1 = await doc_ref_v1.get()
    return doc_v1.exists and "initial_unavailable" in doc_v1.to_dict()


async def save_initial_layout_async(
    db: AsyncClient,
    showtime: dict[str, Any],
    total_seats: int,
    unavailable: int,
    layout_grid: list[Any],
) -> bool:
    """Save initial layout to Firestore (dual-write to v1 and V2) - async."""
    movie_id = showtime["movie_id"]
    metadata_id = showtime.get("metadata_id")  # V2: immutable movie entity ID
    date = showtime["date"]
    showtime_id = showtime["showtime_id"]

    # Compress layout
    layout_json = json.dumps(layout_grid)
    layout_compressed = gzip.compress(layout_json.encode("utf-8"))

    # Build document data
    doc_data = {
        "showtime_id": showtime_id,
        "movie_id": movie_id,
        "movie_title": showtime.get("movie_title", ""),
        "theatre_id": showtime.get("theatre_id"),
        "theatre_name": showtime.get("theatre_name"),
        "showtime": showtime.get("showtime"),
        "date": date,
        "city": showtime.get("city"),
        "merchant": showtime.get("merchant"),
        "room_category": showtime.get("room_category"),
        "total_seats": total_seats,
        # Initial state (morning scrape)
        "initial_layout_compressed": layout_compressed,
        "initial_unavailable": unavailable,
        "initial_available": total_seats - unavailable,
        "initial_scraped_at": datetime.now(JAKARTA_TZ).isoformat(),
        # Placeholder values for dashboard compatibility (will be updated by JIT scraper)
        "sold_seats": 0,
        "occupancy_pct": 0.0,
    }

    try:
        # V1 write (existing - keep for backward compatibility)
        doc_ref_v1 = (
            db.collection(MOVIE_PERFORMANCE)
            .document(movie_id)
            .collection("days")
            .document(date)
            .collection("showtimes")
            .document(showtime_id)
        )
        await doc_ref_v1.set(doc_data, merge=True)

        # V2 write (new - only if metadata_id available)
        if metadata_id:
            doc_ref_v2 = (
                db.collection(MOVIE_PERFORMANCE_V2)
                .document(metadata_id)
                .collection("days")
                .document(date)
                .collection("showtimes")
                .document(showtime_id)
            )
            # Include schedule_id for V2 reference
            v2_doc_data = {**doc_data, "schedule_id": movie_id}
            await doc_ref_v2.set(v2_doc_data, merge=True)

        return True
    except Exception as e:
        logger.error(f"Failed to save {showtime_id}: {e}")
        return False


class ScraperContext:
    """Shared context for concurrent scraping."""

    def __init__(
        self,
        db: AsyncClient,
        rate_limit: int = RATE_LIMIT,
        max_concurrent: int = MAX_CONCURRENT,
    ) -> None:
        self._db = db
        self.rate_limiter = AsyncLimiter(rate_limit, 1)
        self.semaphore = asyncio.Semaphore(max_concurrent)
        self.token_manager = TokenManager()
        self.stats = {"total": 0, "success": 0, "failed": 0, "no_layout": 0, "skipped": 0}
        self.stats_lock = asyncio.Lock()
        self.http_client = httpx.AsyncClient(
            timeout=httpx.Timeout(15.0, connect=5.0),
            limits=httpx.Limits(max_keepalive_connections=10, max_connections=20),
        )

    async def increment_stat(self, key: str) -> None:
        async with self.stats_lock:
            self.stats[key] += 1

    async def process_showtime(self, showtime: dict[str, Any]) -> None:
        """Process a single showtime with rate limiting and concurrency control."""
        showtime_id = showtime["showtime_id"]
        metadata_id = showtime.get("metadata_id")
        movie_id = showtime["movie_id"]
        date = showtime["date"]

        # 1. Async checkpoint check
        if await check_checkpoint_async(self._db, metadata_id, movie_id, date, showtime_id):
            await self.increment_stat("skipped")
            return

        # 2. Get valid token (with lock-protected refresh)
        token = await self.token_manager.get_valid_token()
        if not token:
            await self.increment_stat("failed")
            return

        # 3. Rate-limited async HTTP fetch
        async with self.rate_limiter:
            layout_data = await fetch_seat_layout_async(
                self.http_client, showtime_id, showtime["merchant"], token
            )

            # 4. Handle auth failure with retry
            if layout_data and layout_data.get("__auth_failure"):
                token = await self.token_manager.force_refresh()
                if token:
                    async with self.rate_limiter:
                        layout_data = await fetch_seat_layout_async(
                            self.http_client, showtime_id, showtime["merchant"], token
                        )

            if not layout_data or layout_data.get("__auth_failure"):
                await self.increment_stat("failed")
                return

            # 5. Calculate occupancy
            seat_map = layout_data.get("data", {}).get("seat_map", [])
            total_seats, unavailable, layout_grid = calculate_occupancy(seat_map)

            if total_seats == 0:
                await self.increment_stat("no_layout")
                return

            # 6. Async Firestore save (V1 + V2)
            if await save_initial_layout_async(self._db, showtime, total_seats, unavailable, layout_grid):
                await self.increment_stat("success")
            else:
                await self.increment_stat("failed")

    async def report_progress(self) -> None:
        """Report progress periodically."""
        while True:
            await asyncio.sleep(30)
            done = self.stats["success"] + self.stats["skipped"] + self.stats["failed"] + self.stats["no_layout"]
            logger.info(
                f"Progress: {done}/{self.stats['total']} "
                f"({self.stats['success']} ok, {self.stats['skipped']} skip, {self.stats['failed']} fail, {self.stats['no_layout']} empty)"
            )


async def scrape_showtimes_concurrent(
    db: AsyncClient,
    showtimes: list[dict[str, Any]],
    rate_limit: int = RATE_LIMIT,
    max_concurrent: int = MAX_CONCURRENT,
) -> dict[str, int]:
    """Scrape all showtimes with rate limiting, token refresh, and checkpointing."""
    ctx = ScraperContext(db, rate_limit, max_concurrent)
    ctx.stats["total"] = len(showtimes)

    # Progress reporter (runs in background)
    progress_task = asyncio.create_task(ctx.report_progress())

    try:
        # Initialize token
        await ctx.token_manager.initialize(db)
        if not ctx.token_manager.token:
            logger.error("❌ No valid token - aborting")
            return ctx.stats

        logger.info("🔑 Token acquired, starting concurrent scrape...")

        # Spawn all tasks - semaphore and rate_limiter control concurrency
        async with asyncio.TaskGroup() as tg:
            for showtime in showtimes:
                tg.create_task(ctx.process_showtime(showtime))
    finally:
        progress_task.cancel()
        await ctx.http_client.aclose()

    return ctx.stats


async def async_main() -> None:
    """Async main entry point."""
    parser = argparse.ArgumentParser(description="Scrape initial seat layouts (concurrent)")
    parser.add_argument("--date", type=str, help="Date in YYYY-MM-DD format (default: today)")
    parser.add_argument("--limit", type=int, help="Limit number of showtimes to scrape")
    parser.add_argument("--rate-limit", type=int, default=RATE_LIMIT, help="Requests per second")
    parser.add_argument("--max-concurrent", type=int, default=MAX_CONCURRENT, help="Max concurrent tasks")
    args = parser.parse_args()

    logger.info("=" * 60)
    logger.info("Initial Layout Scraper (Concurrent)")
    logger.info("=" * 60)

    # Determine date
    date = args.date or datetime.now(JAKARTA_TZ).strftime("%Y-%m-%d")

    logger.info(f"📅 Date: {date}")
    logger.info(f"⏱️ Rate limit: {args.rate_limit} req/sec")
    logger.info(f"🔄 Max concurrent: {args.max_concurrent} tasks")

    # Initialize async Firestore
    db = await get_firestore_async_client()

    # Load showtimes
    showtimes = await load_showtimes_from_schedule(db, date)

    if not showtimes:
        logger.warning("⚠️ No showtimes found - exiting")
        return

    # Apply limit if specified
    if args.limit:
        showtimes = showtimes[: args.limit]
        logger.info(f"🔢 Limited to {args.limit} showtimes")

    # Estimate time
    estimated_time = len(showtimes) / args.rate_limit / 60
    logger.info(f"⏱️ Estimated time: {estimated_time:.1f} minutes")

    # Run scraper
    start = time.time()
    stats = await scrape_showtimes_concurrent(db, showtimes, args.rate_limit, args.max_concurrent)
    elapsed = time.time() - start

    logger.info("=" * 60)
    logger.info(f"  Total: {stats['total']}")
    logger.info(f"  Success: {stats['success']}")
    logger.info(f"  Skipped: {stats['skipped']}")
    logger.info(f"  Failed: {stats['failed']}")
    logger.info(f"  No layout: {stats['no_layout']}")
    logger.info(f"  Elapsed: {elapsed / 60:.1f} minutes")
    if stats["success"] > 0:
        logger.info(f"  Rate: {stats['success'] / elapsed:.1f} showtimes/sec")
    logger.info("=" * 60)


def main() -> None:
    """Main entry point."""
    asyncio.run(async_main())


if __name__ == "__main__":
    main()
