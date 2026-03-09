#!/usr/bin/env python3
"""Initial Layout Scraper - Scrape seat layouts for all showtimes.

This captures the "baseline" unavailable seats (blocked/broken) before
any sales happen, allowing accurate audience calculation later.

Usage:
    PYTHONPATH=. uv run python backend/scripts/scrape_initial_layouts.py
    PYTHONPATH=. uv run python backend/scripts/scrape_initial_layouts.py --limit 10
    PYTHONPATH=. uv run python backend/scripts/scrape_initial_layouts.py --date 2026-03-02
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
from google.cloud import firestore
from google.oauth2 import service_account

from backend.domain.time import JAKARTA_TZ
from backend.infrastructure.firestore_collections import (
    MOVIES,
    SCHEDULES,
    SCHEDULES_V2,
    MOVIE_PERFORMANCE,
    MOVIE_PERFORMANCE_V2,
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


def get_firestore_client() -> firestore.Client:
    """Initialize Firestore client from service account."""
    sa_json = os.environ.get("FIREBASE_SERVICE_ACCOUNT")
    if sa_json:
        sa_info = json.loads(sa_json)
        credentials = service_account.Credentials.from_service_account_info(sa_info)  # type: ignore[no-untyped-call]
        return firestore.Client(credentials=credentials, project=sa_info["project_id"])
    return firestore.Client()


def get_token_from_firestore(db: firestore.Client) -> tuple[str | None, float]:
    """Get current token from Firestore.

    Returns:
        Tuple of (token, age_in_minutes)

    """
    doc = db.collection("auth_tokens").document("tix_jwt").get()
    if not doc.exists:
        return None, 999

    data = doc.to_dict()
    # Handle both field name variants
    token = data.get("token") or data.get("access_token")
    stored_at = data.get("stored_at")
    expires_at = data.get("expires_at")

    if not token:
        return None, 999

    # Calculate age from stored_at
    if stored_at:
        try:
            stored_dt = datetime.fromisoformat(stored_at.replace("Z", "+00:00"))
            age = (datetime.now(UTC) - stored_dt).total_seconds() / 60
        except Exception:
            age = 0
    elif expires_at:
        try:
            exp_dt = datetime.fromisoformat(expires_at.replace("Z", "+00:00"))
            age = (datetime.now(UTC) - exp_dt).total_seconds() / 60
            # Negative age means token not yet expired
            age = max(0, -age)
        except Exception:
            age = 0
    else:
        age = 0

    return token, age


def refresh_token_via_api(db: firestore.Client, refresh_token: str) -> str | None:
    """Refresh access token via API."""
    url = "https://api-b2b.tix.id/v1/users/refresh"
    try:
        response = httpx.post(
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
                db.collection("auth_tokens").document("tix_jwt").set(
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


def get_valid_token(db: firestore.Client) -> str | None:
    """Get a valid token, refreshing if necessary."""
    token, age = get_token_from_firestore(db)

    if not token:
        logger.error("❌ No token found in Firestore")
        return None

    # Check if refresh needed
    if age > TOKEN_REFRESH_THRESHOLD / 60:
        logger.info(f"🔄 Token age {age:.1f}min, refreshing...")
        # Get refresh token
        doc = db.collection("auth_tokens").document("tix_jwt").get()
        if doc.exists:
            refresh_token = doc.to_dict().get("refresh_token")
            if refresh_token:
                new_token = refresh_token_via_api(db, refresh_token)
                if new_token:
                    return new_token

                logger.critical("🚨 REFRESH TOKEN IS DEAD! 🚨")
                logger.critical("The token refresh API returned an error.")
                logger.critical(
                    "Manual intervention required: Run `uv run python -m backend.cli token set --jwt '...' --refresh '...'`"
                )
                logger.critical("Then re-run this GitHub workflow.")
                sys.exit(1)

    logger.info(f"🔑 Using token (age: {age:.1f}min)")
    return token


def fetch_seat_layout_sync(showtime_id: str, merchant: str, token: str) -> dict[str, Any] | None:
    """Fetch seat layout from TIX API (synchronous)."""
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
        response = httpx.get(url, headers=headers, params=params, timeout=15)

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
                unavailable += 1
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


def load_showtimes_from_schedule(db: firestore.Client, date: str) -> list[dict[str, Any]]:
    """Load all showtimes from schedules_v2 or schedules (V1 fallback).

    Handles the nested structure:
    cities.{city}.theatres[].rooms[].all_showtimes[]

    Returns showtimes with both movie_id (schedule_id) and metadata_id for V2 compatibility.
    """
    # V2 Migration: Try schedules_v2 first, fallback to schedules (V1)
    movies_ref_v2 = db.collection(SCHEDULES_V2).document(date).collection(MOVIES)
    movies_ref_v1 = db.collection(SCHEDULES).document(date).collection(MOVIES)

    movie_docs = list(movies_ref_v2.stream())
    use_v2_schema = True

    if not movie_docs:
        logger.info(f"📥 No data in {SCHEDULES_V2}/{date}/{MOVIES}, falling back to {SCHEDULES}")
        movie_docs = list(movies_ref_v1.stream())
        use_v2_schema = False
    else:
        logger.info(f"📥 Loading showtimes from {SCHEDULES_V2}/{date}/{MOVIES}/...")

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


def save_initial_layout(
    db: firestore.Client,
    showtime: dict[str, Any],
    total_seats: int,
    unavailable: int,
    layout_grid: list[Any],
) -> bool:
    """Save initial layout to Firestore (dual-write to V1 and V2).

    V1 path: movie_performance/{movie_id}/days/{date}/showtimes/{showtime_id}
    V2 path: movie_performance_v2/{metadata_id}/days/{date}/showtimes/{showtime_id}
    """
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
        doc_ref_v1.set(doc_data, merge=True)

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
            doc_ref_v2.set(v2_doc_data, merge=True)

        return True
    except Exception as e:
        logger.error(f"Failed to save {showtime_id}: {e}")
        return False


async def scrape_showtimes(
    db: firestore.Client,
    showtimes: list[dict[str, Any]],
    rate_limit: int = RATE_LIMIT,
) -> dict[str, int]:
    """Scrape all showtimes with rate limiting, token refresh, and checkpointing."""
    stats = {"total": len(showtimes), "success": 0, "failed": 0, "no_layout": 0, "skipped": 0}

    # Get initial token
    token = get_valid_token(db)
    if not token:
        logger.error("❌ No valid token - aborting")
        return stats

    token_acquired_at = time.time()
    rate_limiter = AsyncLimiter(rate_limit, 1)

    for i, showtime in enumerate(showtimes):
        # 1. Native Checkpointing (V2 first, then V1 fallback)
        # Check if the baseline already exists
        metadata_id = showtime.get("metadata_id")
        movie_id = showtime["movie_id"]
        date = showtime["date"]
        showtime_id = showtime["showtime_id"]

        already_scraped = False

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
            doc_v2 = doc_ref_v2.get()
            if doc_v2.exists and "initial_unavailable" in doc_v2.to_dict():
                already_scraped = True

        # Fallback to V1 check
        if not already_scraped:
            doc_ref_v1 = (
                db.collection(MOVIE_PERFORMANCE)
                .document(movie_id)
                .collection("days")
                .document(date)
                .collection("showtimes")
                .document(showtime_id)
            )
            doc_v1 = doc_ref_v1.get()
            if doc_v1.exists and "initial_unavailable" in doc_v1.to_dict():
                already_scraped = True

        if already_scraped:
            stats["skipped"] += 1
            if (i + 1) % 50 == 0:
                logger.info(
                    f"📊 Progress: {i + 1}/{len(showtimes)} "
                    f"({stats['success']} ok, {stats['skipped']} skipped, {stats['failed']} fail, {stats['no_layout']} empty)"
                )
            continue

        # 2. Token Maintenance
        elapsed = time.time() - token_acquired_at
        if elapsed > TOKEN_REFRESH_THRESHOLD:
            logger.info(f"🔄 Refreshing token (age: {elapsed / 60:.1f}min)...")
            new_token = get_valid_token(db)
            if new_token:
                token = new_token
                token_acquired_at = time.time()
            else:
                # get_valid_token sys.exits(1) if refresh is completely dead, so we only hit this if purely unaccounted error
                logger.critical("⚠️ Token refresh completely failed. Exiting.")
                sys.exit(1)

        # 3. Rate limiting and Layout Fetch
        async with rate_limiter:
            layout_data = fetch_seat_layout_sync(
                showtime["showtime_id"],
                showtime["merchant"],
                token,
            )

            # Handle reactive 401s (token died before our 25-minute timer)
            if layout_data and layout_data.get("__auth_failure"):
                logger.warning("Reactive 401 caught. Forcing early token refresh strategy.")
                new_token = get_valid_token(db)
                if new_token:
                    token = new_token
                    token_acquired_at = time.time()
                    # Retry the scrape precisely once
                    layout_data = fetch_seat_layout_sync(
                        showtime["showtime_id"],
                        showtime["merchant"],
                        token,
                    )
                else:
                    sys.exit(1)

            if not layout_data or layout_data.get("__auth_failure"):
                stats["failed"] += 1
                continue

            # Calculate occupancy
            seat_map = layout_data.get("data", {}).get("seat_map", [])
            total_seats, unavailable, layout_grid = calculate_occupancy(seat_map)

            if total_seats == 0:
                stats["no_layout"] += 1
                continue

            # Save to Firestore
            if save_initial_layout(db, showtime, total_seats, unavailable, layout_grid):
                stats["success"] += 1
            else:
                stats["failed"] += 1

        # Progress logging
        if (i + 1) % 50 == 0:
            logger.info(
                f"📊 Progress: {i + 1}/{len(showtimes)} "
                f"({stats['success']} ok, {stats['skipped']} skipped, {stats['failed']} fail, {stats['no_layout']} empty)"
            )

    return stats


def main() -> None:
    """Main entry point."""
    parser = argparse.ArgumentParser(description="Scrape initial seat layouts")
    parser.add_argument("--date", type=str, help="Date in YYYY-MM-DD format (default: today)")
    parser.add_argument("--limit", type=int, help="Limit number of showtimes to scrape")
    parser.add_argument("--rate-limit", type=int, default=RATE_LIMIT, help="Requests per second")
    args = parser.parse_args()

    logger.info("=" * 60)
    logger.info("Initial Layout Scraper")
    logger.info("=" * 60)

    # Determine date
    date = args.date or datetime.now(JAKARTA_TZ).strftime("%Y-%m-%d")

    logger.info(f"📅 Date: {date}")
    logger.info(f"⏱️ Rate limit: {args.rate_limit} req/sec")

    # Initialize Firestore
    db = get_firestore_client()

    # Load showtimes
    showtimes = load_showtimes_from_schedule(db, date)

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
    stats = asyncio.run(scrape_showtimes(db, showtimes, args.rate_limit))
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


if __name__ == "__main__":
    main()
