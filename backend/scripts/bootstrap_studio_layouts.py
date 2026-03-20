#!/usr/bin/env python3
"""Bootstrap Studio Layouts — Tier 2 Capacity Learning.

Fetches layout data for showtimes, parses to unified grid, and merges using "Logical OR"
to progressively learn the true physical layout over time.

Usage:
    PYTHONPATH=. uv run python backend/scripts/bootstrap_studio_layouts.py --theatre-ids ID1,ID2
"""

import argparse
import asyncio
import json
import logging
import os
import sys
from collections import defaultdict
from datetime import datetime, timedelta
from typing import Any

sys.path.insert(0, ".")

from google.cloud.firestore import AsyncClient
from google.oauth2 import service_account

from backend.domain.time import JAKARTA_TZ
from backend.infrastructure.core.seat_scraper import SeatScraper
from backend.infrastructure.firestore_collections import MOVIES, SCHEDULES_V2, THEATRES
from backend.infrastructure.repositories import FirestoreTokenRepository

logging.basicConfig(level=logging.INFO, format="%(asctime)s | %(levelname)s | %(message)s")
logger = logging.getLogger(__name__)


def parse_to_master_layout(seat_map: list[dict[str, Any]]) -> tuple[int, list[dict[str, Any]]]:
    """Convert any chain's seat_map into CineRadar Unified Grid format."""
    total_seats = 0
    unified_layout: list[dict[str, Any]] = []

    # Check format
    if not seat_map:
        return 0, []

    is_nested = any("seat_rows" in item for item in seat_map)

    if is_nested:
        # XXI / CGV (Nested)
        for item in seat_map:
            row_name = item.get("row_name", item.get("seat_code", ""))
            row_data: dict[str, Any] = {"row_name": row_name, "seats": []}

            for seat in item.get("seat_rows", []):
                seat_id = seat.get("seat_row", "")
                if not seat_id:
                    # Treat as gap/aisle if no seat_id
                    row_data["seats"].append({"id": "", "type": "aisle"})
                else:
                    row_data["seats"].append({"id": seat_id, "type": "seat"})
                    total_seats += 1
            unified_layout.append(row_data)
    else:
        # Cinépolis / CGV B2B (Flat)
        # Group by row
        rows_dict: defaultdict[str, list[dict[str, Any]]] = defaultdict(list)
        for item in seat_map:
            row_name = item.get("row_name", "ALL")
            seat_id = item.get("seat_no", "")
            seat_yn = str(item.get("seat_yn", "1"))

            if seat_yn == "0" or not seat_id:
                rows_dict[row_name].append({"id": "", "type": "aisle"})
            else:
                rows_dict[row_name].append({"id": seat_id, "type": "seat"})
                total_seats += 1

        for row_name, seats in rows_dict.items():
            unified_layout.append({"row_name": row_name, "seats": seats})

    return total_seats, unified_layout


def merge_layouts_logical_or(
    existing_layout: list[dict[str, Any]], new_layout: list[dict[str, Any]]
) -> tuple[int, list[dict[str, Any]]]:
    """Merge two unified layouts using Logical OR. If a seat exists in either, it exists in merged."""
    if not existing_layout:
        total = sum(1 for r in new_layout for s in r.get("seats", []) if s.get("type") == "seat")
        return total, new_layout

    merged_rows: dict[str, list[dict[str, Any]]] = {}

    for row in existing_layout + new_layout:
        row_name = str(row.get("row_name", ""))
        if row_name not in merged_rows:
            merged_rows[row_name] = []

        # Merge seats based on max length
        current_seats = merged_rows[row_name]
        incoming_seats: list[dict[str, Any]] = row.get("seats", [])

        merged_seats: list[dict[str, Any]] = []
        max_len = max(len(current_seats), len(incoming_seats))
        for i in range(max_len):
            curr = current_seats[i] if i < len(current_seats) else {"id": "", "type": "aisle"}
            inc = incoming_seats[i] if i < len(incoming_seats) else {"id": "", "type": "aisle"}

            # Logical OR: If either is a seat, it's a seat
            if curr.get("type") == "seat" or inc.get("type") == "seat":
                seat_id = curr.get("id") or inc.get("id")
                merged_seats.append({"id": seat_id, "type": "seat"})
            else:
                merged_seats.append({"id": "", "type": "aisle"})

        merged_rows[row_name] = merged_seats

    # Sort roughly by row name if needed, but dict maintains insertion order (which might be okay)
    # usually it's better to trust the existing_layout's order. We'll reconstruct in order:
    ordered_layout: list[dict[str, Any]] = []
    seen = set()
    for row in existing_layout:
        rn = str(row.get("row_name", ""))
        if rn not in seen:
            ordered_layout.append({"row_name": rn, "seats": merged_rows[rn]})
            seen.add(rn)
    for row in new_layout:
        rn = str(row.get("row_name", ""))
        if rn not in seen:
            ordered_layout.append({"row_name": rn, "seats": merged_rows[rn]})
            seen.add(rn)

    total = sum(
        1
        for r in ordered_layout
        for s in (r.get("seats", []) or [])
        if isinstance(s, dict) and s.get("type") == "seat"
    )
    return total, ordered_layout


async def get_firestore_client() -> AsyncClient:
    """Initialize async Firestore client from env or ADC."""
    sa_json = os.environ.get("FIREBASE_SERVICE_ACCOUNT")
    if sa_json:
        sa_info = json.loads(sa_json)
        credentials = service_account.Credentials.from_service_account_info(sa_info)  # type: ignore[no-untyped-call]
        return AsyncClient(credentials=credentials, project=sa_info["project_id"])
    return AsyncClient()


async def find_showtimes_for_theatres(
    db: AsyncClient, theatre_ids: list[str] | None
) -> dict[str, dict[str, list[dict[str, Any]]]]:
    """Find showtimes for the given theatres (or all if None) to use for layout scraping.
    Returns: {theatre_id: {studio_id: [{"showtime_id": x, "merchant": y}, ...]}}
    """
    targets: dict[str, dict[str, list[dict[str, Any]]]] = {}
    if theatre_ids is not None:
        targets = {tid: defaultdict(list) for tid in theatre_ids}
    now_jkt = datetime.now(JAKARTA_TZ)

    # Check next 7 days
    for i in range(7):
        target_date = now_jkt + timedelta(days=i)
        date_str = target_date.strftime("%Y-%m-%d")
        is_today = i == 0

        movies_ref = db.collection(SCHEDULES_V2).document(date_str).collection(MOVIES)

        movie_docs = [doc async for doc in movies_ref.stream()]
        for doc in movie_docs:
            data = doc.to_dict() or {}
            for _city, theatres in data.get("cities", {}).items():
                for theatre in theatres:
                    tid = theatre.get("theatre_id", "")
                    if not tid:
                        continue
                    if theatre_ids is not None and tid not in targets:
                        continue
                    if tid not in targets:
                        targets[tid] = defaultdict(list)

                    merchant = theatre.get("merchant", "")
                    for room in theatre.get("rooms", []):
                        for st in room.get("all_showtimes", []):
                            studio_id = st.get("studio_id")
                            st_id = st.get("showtime_id")
                            showtime_str = st.get("time") or st.get("showtime")

                            if studio_id and st_id and showtime_str:
                                # If today, ensure showtime is safely in the future (> 1 hour)
                                if is_today:
                                    try:
                                        st_hour, st_minute = map(int, showtime_str.split(":"))
                                        st_time = target_date.replace(
                                            hour=st_hour, minute=st_minute, second=0, microsecond=0
                                        )

                                        # Skip if the showtime has already passed
                                        if st_time <= now_jkt:
                                            continue
                                    except ValueError:
                                        # If we can't parse the time, be safe and skip if it's today
                                        continue

                                # Keep up to 3 showtimes per studio to merge
                                if len(targets[tid][studio_id]) < 3:
                                    targets[tid][studio_id].append(
                                        {"showtime_id": st_id, "merchant": merchant}
                                    )

    return targets


async def bootstrap_theatre_layouts(
    db: AsyncClient, scraper: SeatScraper, theatre_ids: list[str] | None
) -> None:
    targets = await find_showtimes_for_theatres(db, theatre_ids)

    for theatre_id, studios in targets.items():
        if not studios:
            logger.warning(f"No showtimes found for theatre {theatre_id}")
            continue

        logger.info(f"Processing theatre {theatre_id} with {len(studios)} studios")
        for studio_id, showtimes in studios.items():
            studio_ref = (
                db.collection(THEATRES)
                .document(theatre_id)
                .collection("studios")
                .document(studio_id)
            )
            doc = await studio_ref.get()

            existing_data = doc.to_dict() if doc.exists else {}
            if existing_data.get("is_locked"):
                logger.info(f"  Skipping Studio {studio_id} - Locked")
                continue

            if existing_data.get("total_seats", 0) > 0 and existing_data.get("layout"):
                logger.info(
                    f"  Skipping Studio {studio_id} - Already mapped ({existing_data['total_seats']} seats)"
                )
                continue

            merged_layout = existing_data.get("layout", [])

            for st in showtimes:
                logger.info(
                    f"  Fetching layout for Studio {studio_id} via showtime {st['showtime_id']}"
                )
                raw_data = await scraper._fetch_seat_layout_api(st["showtime_id"], st["merchant"])

                # Enforce rate limit (max 5 RPS) immediately after the call to prevent runaway loops
                await asyncio.sleep(0.2)

                if not raw_data:
                    logger.warning(f"   Failed to fetch layout for showtime {st['showtime_id']}")
                    continue

                seat_map = raw_data.get("data", {}).get("seat_map", [])
                _, unified = parse_to_master_layout(seat_map)
                _, merged_layout = merge_layouts_logical_or(merged_layout, unified)

            if merged_layout:
                total_seats = sum(
                    1 for r in merged_layout for s in r.get("seats", []) if s.get("type") == "seat"
                )

                update_data = {
                    "layout": merged_layout,
                    "total_seats": total_seats,
                    "last_updated": datetime.now(JAKARTA_TZ).isoformat(),
                }

                if doc.exists:
                    await studio_ref.update(update_data)
                else:
                    # Should exist if discover_studios ran, but just in case
                    update_data["studio_id"] = studio_id
                    update_data["name"] = f"Studio {studio_id}"
                    update_data["is_locked"] = False
                    update_data["version"] = 1
                    await studio_ref.set(update_data)

                logger.info(f"  Saved Studio {studio_id}: {total_seats} seats")


async def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--theatre-ids", type=str, required=False, help="Comma-separated theatre IDs"
    )
    parser.add_argument(
        "--all", action="store_true", help="Process all theatres found in schedules"
    )
    args = parser.parse_args()

    if not args.theatre_ids and not args.all:
        logger.error("Must provide either --theatre-ids or --all")
        return

    t_ids = None
    if args.theatre_ids:
        t_ids = [tid.strip() for tid in args.theatre_ids.split(",") if tid.strip()]

    # Setup scraper
    repo = FirestoreTokenRepository()
    token = repo.get_current()
    if not token or token.is_expired:
        logger.error("No valid token found in Firestore. Please run login script.")
        return

    scraper = SeatScraper()
    scraper.auth_token = token.token.strip('"')

    db = await get_firestore_client()
    try:
        await bootstrap_theatre_layouts(db, scraper, t_ids)
    finally:
        db.close()


if __name__ == "__main__":
    asyncio.run(main())
