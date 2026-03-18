#!/usr/bin/env python3
"""Bootstrap Studio Layouts — One-Time/Periodic Studio Discovery Script.

Discovers all physical cinema studios from today's active showtimes,
live-scrapes their seat layouts, and stores permanent master baselines
in Firestore at theatres/{theatre_id}/studios/{studio_id}.

Key behaviours:
  - Treats all seat statuses (1/5/6) as valid physical seats (existence, not availability).
  - Performs Logical OR merge across multiple showtimes for the same studio,
    progressively learning the full physical capacity.
  - Respects is_locked: never overwrites admin-verified layouts.

Usage:
    PYTHONPATH=. uv run python backend/scripts/bootstrap_studio_layouts.py
    PYTHONPATH=. uv run python backend/scripts/bootstrap_studio_layouts.py --date 2026-03-25
    PYTHONPATH=. uv run python backend/scripts/bootstrap_studio_layouts.py --dry-run
    PYTHONPATH=. uv run python backend/scripts/bootstrap_studio_layouts.py --limit 20
"""

import argparse
import asyncio
import json
import logging
import os
import sys
import time
from datetime import datetime
from typing import Any

sys.path.insert(0, ".")

import httpx
from google.cloud.firestore import AsyncClient
from google.oauth2 import service_account

from backend.domain.models.theatre import StudioLayout
from backend.domain.studio_layout_parser import merge_layouts_logical_or, parse_to_master_layout
from backend.domain.time import JAKARTA_TZ
from backend.infrastructure.firestore_collections import MOVIES, SCHEDULES_V2, THEATRES

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger(__name__)

# Constants
STUDIOS_SUBCOLLECTION = "studios"
RATE_LIMIT_DELAY = 0.5  # seconds between API calls (conservative)
MAX_RETRIES = 2

MERCHANT_PATHS: dict[str, str] = {
    "CGV": "cgv",
    "XXI": "xxi",
    "Cinépolis": "cinepolis",
    "CINEPOLIS": "cinepolis",
}


# ---------------------------------------------------------------------------
# Firestore client
# ---------------------------------------------------------------------------

async def get_firestore_client() -> AsyncClient:
    """Initialize async Firestore client from env or ADC."""
    sa_json = os.environ.get("FIREBASE_SERVICE_ACCOUNT")
    if sa_json:
        sa_info = json.loads(sa_json)
        credentials = service_account.Credentials.from_service_account_info(sa_info)  # type: ignore[no-untyped-call]
        return AsyncClient(credentials=credentials, project=sa_info["project_id"])
    return AsyncClient()


# ---------------------------------------------------------------------------
# Token management (reuses same pattern as scrape_initial_layouts.py)
# ---------------------------------------------------------------------------

async def get_token_from_firestore(db: AsyncClient) -> str | None:
    """Load JWT token from Firestore auth_tokens/tix_jwt."""
    doc = await db.collection("auth_tokens").document("tix_jwt").get()
    if not doc.exists:
        logger.error("No token found at auth_tokens/tix_jwt")
        return None
    data = doc.to_dict() or {}
    token = data.get("token") or data.get("access_token")
    return str(token) if token else None


async def refresh_token(db: AsyncClient) -> str | None:
    """Attempt to refresh the access token via TIX API."""
    doc = await db.collection("auth_tokens").document("tix_jwt").get()
    if not doc.exists:
        return None
    refresh = (doc.to_dict() or {}).get("refresh_token")
    if not refresh:
        return None
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://api-b2b.tix.id/v1/users/refresh",
                headers={
                    "Authorization": f"Bearer {refresh}",
                    "Content-Type": "application/json",
                    "platform": "web",
                },
                timeout=30,
            )
            if response.status_code == 200:
                new_token = response.json().get("data", {}).get("token")
                if new_token:
                    from datetime import UTC
                    await db.collection("auth_tokens").document("tix_jwt").set(
                        {
                            "access_token": new_token,
                            "refresh_token": refresh,
                            "updated_at": datetime.now(UTC).isoformat(),
                        },
                        merge=True,
                    )
                    return str(new_token)
    except Exception as e:
        logger.error(f"Token refresh failed: {e}")
    return None


# ---------------------------------------------------------------------------
# API fetch
# ---------------------------------------------------------------------------

async def fetch_seat_layout(
    client: httpx.AsyncClient,
    showtime_id: str,
    merchant: str,
    token: str,
    retries: int = MAX_RETRIES,
) -> dict[str, Any] | None:
    """Fetch raw seat layout from TIX API for a given showtime.

    Returns the full API response dict on success, None on failure.
    Returns {"__auth_failure": True} specifically on 401 so callers can retry.
    """
    merchant_path = MERCHANT_PATHS.get(merchant, merchant.lower())
    url = f"https://api-b2b.tix.id/v1/movies/{merchant_path}/layout"
    headers = {
        "Authorization": f"Bearer {token}",
        "Accept": "application/json",
        "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15",
    }
    params = {"show_time_id": showtime_id, "tz": "7"}

    for attempt in range(retries + 1):
        try:
            response = await client.get(url, headers=headers, params=params, timeout=15)
            if response.status_code == 200:
                data: dict[str, Any] = response.json()
                if data.get("success"):
                    return data
                logger.warning(f"  API error for {showtime_id}: {data.get('error', {}).get('message', '?')}")
                return None
            elif response.status_code == 401:
                return {"__auth_failure": True}
            else:
                logger.warning(f"  HTTP {response.status_code} for {showtime_id}")
                if attempt < retries:
                    await asyncio.sleep(2 ** attempt)
        except httpx.RequestError as e:
            logger.warning(f"  Request error for {showtime_id} (attempt {attempt + 1}): {e}")
            if attempt < retries:
                await asyncio.sleep(2 ** attempt)

    return None


# ---------------------------------------------------------------------------
# Studio discovery
# ---------------------------------------------------------------------------

async def discover_studios(
    db: AsyncClient, date: str
) -> dict[tuple[str, str], dict[str, str]]:
    """Walk today's schedules_v2 to extract all unique (theatre_id, studio_id) pairs.

    Returns:
        {(theatre_id, studio_id): {"showtime_ids": [...], "merchant": ..., "theatre_name": ...}}
    """
    logger.info(f"Discovering studios from schedules_v2/{date}/movies/...")

    movies_ref = db.collection(SCHEDULES_V2).document(date).collection(MOVIES)
    movie_docs = [doc async for doc in movies_ref.stream()]

    if not movie_docs:
        logger.warning(f"No documents found in schedules_v2/{date}/movies/")
        return {}

    # studio_key → {merchant, theatre_name, showtime_ids: []}
    studios: dict[tuple[str, str], dict[str, Any]] = {}

    for movie_doc in movie_docs:
        data = movie_doc.to_dict() or {}

        for _city, theatres in data.get("cities", {}).items():
            for theatre in theatres:
                theatre_id: str = theatre.get("theatre_id", "")
                merchant: str = theatre.get("merchant", "")
                theatre_name: str = theatre.get("theatre_name", "")

                if not theatre_id or not merchant:
                    continue

                for room in theatre.get("rooms", []):
                    for st in room.get("all_showtimes", []):
                        studio_id: str | None = st.get("studio_id")
                        showtime_id: str | None = st.get("showtime_id")

                        if not studio_id or not showtime_id:
                            continue

                        key = (theatre_id, studio_id)
                        if key not in studios:
                            studios[key] = {
                                "merchant": merchant,
                                "theatre_name": theatre_name,
                                "showtime_ids": [],
                            }
                        # Collect ALL showtime IDs for this studio for OR-merge
                        if showtime_id not in studios[key]["showtime_ids"]:
                            studios[key]["showtime_ids"].append(showtime_id)

    logger.info(f"Discovered {len(studios)} unique (theatre_id, studio_id) pairs.")
    return studios


# ---------------------------------------------------------------------------
# Main bootstrap logic
# ---------------------------------------------------------------------------

async def bootstrap_studio(
    db: AsyncClient,
    client: httpx.AsyncClient,
    theatre_id: str,
    studio_id: str,
    info: dict[str, Any],
    token_holder: dict[str, str | None],
    dry_run: bool,
) -> str:
    """Bootstrap a single studio. Returns one of: 'saved', 'locked', 'failed', 'empty'."""
    theatre_name = info["theatre_name"]
    merchant = info["merchant"]
    showtime_ids: list[str] = info["showtime_ids"]

    studio_ref = (
        db.collection(THEATRES)
        .document(theatre_id)
        .collection(STUDIOS_SUBCOLLECTION)
        .document(studio_id)
    )

    # Check lock status before doing any API work
    existing_snap = await studio_ref.get()
    if existing_snap.exists:
        existing_data = existing_snap.to_dict() or {}
        if existing_data.get("is_locked", False):
            logger.info(f"  [{theatre_name}] Studio {studio_id} → locked, skipping.")
            return "locked"

    # Build OR-merged layout from all available showtimes for this studio
    all_layouts: list[list[dict[str, Any]]] = []
    token = token_holder.get("token")

    for showtime_id in showtime_ids:
        if not token:
            logger.error("No valid token — aborting.")
            return "failed"

        await asyncio.sleep(RATE_LIMIT_DELAY)
        layout_data = await fetch_seat_layout(client, showtime_id, merchant, token)

        if layout_data and layout_data.get("__auth_failure"):
            logger.info("  401 detected — attempting token refresh...")
            token = await refresh_token(db)
            token_holder["token"] = token
            if not token:
                logger.error("  Token refresh failed — aborting studio.")
                return "failed"
            layout_data = await fetch_seat_layout(client, showtime_id, merchant, token)

        if not layout_data:
            logger.warning(f"  [{theatre_name}] Studio {studio_id} / showtime {showtime_id} → fetch failed, skipping showtime.")
            continue

        seat_map = layout_data.get("data", {}).get("seat_map", [])
        if not seat_map:
            logger.warning(f"  [{theatre_name}] Studio {studio_id} / showtime {showtime_id} → empty seat_map.")
            continue

        total, layout = parse_to_master_layout(seat_map)
        if total == 0:
            logger.warning(f"  [{theatre_name}] Studio {studio_id} / showtime {showtime_id} → 0 seats parsed.")
            continue

        logger.info(f"  [{theatre_name}] Studio {studio_id} / showtime {showtime_id} → {total} seats.")
        all_layouts.append(layout)

    if not all_layouts:
        logger.warning(f"  [{theatre_name}] Studio {studio_id} → no valid layouts collected.")
        return "empty"

    # OR-merge across all showtime layouts
    merged_layout = merge_layouts_logical_or(all_layouts)

    # Build the StudioLayout model
    # Preserve existing version + name if already exists (non-locked update)
    existing_version = 1
    existing_name = f"Studio {studio_id}"
    if existing_snap.exists:
        existing_data = existing_snap.to_dict() or {}
        existing_version = existing_data.get("version", 1) + 1
        existing_name = existing_data.get("name", existing_name)

    studio = StudioLayout(
        studio_id=studio_id,
        name=existing_name,
        is_locked=False,
        version=existing_version,
        layout=merged_layout,
        total_seats=sum(
            1
            for row in merged_layout
            for seat in row.get("seats", [])
            if seat.get("type") == "seat"
        )
    )

    # Validate before writing
    if not studio.validate_seat_count():
        logger.error(f"  [{theatre_name}] Studio {studio_id} → seat count validation FAILED, skipping write.")
        return "failed"

    if dry_run:
        logger.info(f"  [DRY RUN] [{theatre_name}] Studio {studio_id} → {studio.total_seats} seats (would write).")
        return "saved"

    await studio_ref.set(studio.to_dict(), merge=True)
    logger.info(f"  [{theatre_name}] Studio {studio_id} → saved ({studio.total_seats} seats, v{studio.version}).")
    return "saved"


async def async_main() -> None:
    parser = argparse.ArgumentParser(description="Bootstrap studio layouts from today's schedules.")
    parser.add_argument("--date", type=str, help="Date YYYY-MM-DD (default: today)")
    parser.add_argument("--dry-run", action="store_true", help="Discover and parse but do not write to Firestore.")
    parser.add_argument("--limit", type=int, help="Process only the first N studios (for testing).")
    args = parser.parse_args()

    date = args.date or datetime.now(JAKARTA_TZ).strftime("%Y-%m-%d")

    logger.info("=" * 60)
    logger.info("Studio Layout Bootstrap")
    logger.info("=" * 60)
    logger.info(f"Date:    {date}")
    logger.info(f"Dry run: {args.dry_run}")

    db = await get_firestore_client()

    # Load token
    token = await refresh_token(db)
    if not token:
        token = await get_token_from_firestore(db)
    if not token:
        logger.error("No valid auth token found. Aborting.")
        return

    token_holder: dict[str, str | None] = {"token": token}
    logger.info("Token loaded.")

    # Discover studios
    studios = await discover_studios(db, date)
    if not studios:
        logger.warning("No studios discovered — exiting.")
        return

    studio_items = list(studios.items())
    if args.limit:
        studio_items = studio_items[: args.limit]
        logger.info(f"Limited to {args.limit} studios.")

    logger.info(f"Processing {len(studio_items)} studios...")

    stats: dict[str, int] = {"saved": 0, "locked": 0, "failed": 0, "empty": 0}
    start = time.time()

    async with httpx.AsyncClient(
        timeout=httpx.Timeout(15.0, connect=5.0),
        limits=httpx.Limits(max_keepalive_connections=5, max_connections=10),
    ) as client:
        for (theatre_id, studio_id), info in studio_items:
            result = await bootstrap_studio(
                db, client, theatre_id, studio_id, info, token_holder, dry_run=args.dry_run
            )
            stats[result] = stats.get(result, 0) + 1

    elapsed = time.time() - start

    logger.info("=" * 60)
    logger.info(f"Done in {elapsed:.1f}s")
    logger.info(f"  Saved:  {stats['saved']}")
    logger.info(f"  Locked: {stats['locked']}")
    logger.info(f"  Failed: {stats['failed']}")
    logger.info(f"  Empty:  {stats['empty']}")
    logger.info("=" * 60)


def main() -> None:
    asyncio.run(async_main())


if __name__ == "__main__":
    main()
