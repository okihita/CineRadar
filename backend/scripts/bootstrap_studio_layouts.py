#!/usr/bin/env python3
"""Bootstrap Studio Layouts — Ground Truth Migration.

Migrates Master Layouts from "guessed snapshots" to "raw ground truth" derived from
TIX.id API responses. Handles XXI vertical lanes and uses multi-movie consensus.

Logic:
    - Anchors seats by their ID (e.g., 'A1', 'D15').
    - Anchors aisles by the API's 'before_seat_column' rules.
    - Resolves 'Ghost Seats' (status 5/6) by checking if they are ever status 1/2.
"""

import argparse
import asyncio
import logging
import re
import sys
from collections import defaultdict
from datetime import datetime
from typing import TYPE_CHECKING, Any

sys.path.insert(0, ".")


import contextlib

from backend.domain.time import JAKARTA_TZ
from backend.infrastructure.firestore_collections import (
    MOVIE_PERFORMANCE_V2,
    SCHEDULES_V2,
    THEATRES,
)
from backend.infrastructure.repositories.firestore_utils import get_firestore_async_client

if TYPE_CHECKING:
    from google.cloud.firestore import AsyncClient

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger(__name__)


def parse_to_master_layout(
    raw_data: dict[str, Any], merchant: str
) -> list[dict[str, Any]]:
    """Convert raw API data into CineRadar Unified Grid format.

    This version is 'Aisle-Aware' and respects XXI vertical lane rules.
    Returns a unified layout grid.
    """
    data_payload = raw_data.get("data", {})
    seat_map = data_payload.get("seat_map", [])

    if not seat_map:
        return []

    is_nested = any("seat_rows" in item for item in seat_map)
    unified_layout: list[dict[str, Any]] = []

    if is_nested:
        # XXI / CGV (Nested)
        for item in seat_map:
            row_name = item.get("seat_code", "")
            row_data: dict[str, Any] = {"row_name": row_name, "seats": []}

            for seat in item.get("seat_rows", []):
                seat_id = seat.get("seat_row", "")
                status = seat.get("status", 0)

                # Initially, everything that isn't status 0 is a candidate
                if seat_id and status != 0:
                    # We store the status temporarily to help the consensus logic later
                    row_data["seats"].append({"id": seat_id, "type": "seat", "_raw_status": status})
                else:
                    row_data["seats"].append({"id": "", "type": "aisle"})
            unified_layout.append(row_data)

        # Handle XXI Vertical Lanes
        if merchant == "XXI":
            vertical_lanes = (data_payload.get("seat_rules", {}) or {}).get("vertical_lane") or []
            for lane in vertical_lanes:
                start_row, end_row, before_col = lane.get("start"), lane.get("end"), lane.get("before_seat_column")
                if not before_col:
                    continue

                in_range = False
                for row in unified_layout:
                    if row["row_name"] == start_row:
                        in_range = True
                    if in_range:
                        # Find the seat where the numeric column matches before_col
                        target_idx = -1
                        for idx, s in enumerate(row["seats"]):
                            match = re.search(r"(\d+)$", s.get("id", ""))
                            if match and int(match.group(1)) == before_col:
                                target_idx = idx
                                break
                        if target_idx != -1:
                            row["seats"].insert(target_idx, {"id": "", "type": "aisle", "_is_rule_aisle": True})
                    if row["row_name"] == end_row:
                        in_range = False
    else:
        # Cinépolis / Flat
        rows_dict: defaultdict[str, list[dict[str, Any]]] = defaultdict(list)
        for item in seat_map:
            row_name = item.get("row_name", "ALL")
            seat_id = item.get("seat_no", "")
            seat_yn = str(item.get("seat_yn", "1"))
            status = item.get("status", 1)

            if seat_id and seat_yn == "1":
                rows_dict[row_name].append({"id": seat_id, "type": "seat", "_raw_status": status})
            else:
                rows_dict[row_name].append({"id": "", "type": "aisle"})

        for row_name, seats in rows_dict.items():
            unified_layout.append({"row_name": row_name, "seats": seats})

    return unified_layout


def merge_consensus(layouts: list[list[dict[str, Any]]]) -> list[dict[str, Any]]:
    """Merge multiple layouts using ID-aware consensus.

    If a seat ID is ever status 1 or 2 across ANY layout, it is a real seat.
    If it is always 5 or 6, it is a permanent block (aisle).
    """
    if not layouts:
        return []
    if len(layouts) == 1:
        # Even with one layout, we must clean the temporary _raw_status
        base = layouts[0]
        for row in base:
            for s in row["seats"]:
                if s.get("type") == "seat" and s.get("_raw_status") in (5, 6):
                    s["type"] = "aisle"
                    s["id"] = ""
                s.pop("_raw_status", None)
                s.pop("_is_rule_aisle", None)
        return base

    # 1. Map all possible seats found across all layouts
    # We use the first layout as the template for structure
    base_layout = layouts[0]

    # 2. Track global status for every seat ID discovered
    seat_status_history = defaultdict(list)
    for layout in layouts:
        for row in layout:
            for s in row["seats"]:
                if s.get("id"):
                    seat_status_history[s["id"]].append(s.get("_raw_status"))

    # 3. Apply consensus to the template
    for row in base_layout:
        new_seats = []
        for s in row["seats"]:
            sid = s.get("id")
            if not sid:
                # Keep aisles as aisles
                s.pop("_raw_status", None)
                s.pop("_is_rule_aisle", None)
                new_seats.append(s)
                continue

            statuses = seat_status_history.get(sid, [])
            # Consensus Rule:
            # If it's ever 1 (Available) or 2 (Sold) -> It's a REAL seat.
            # Otherwise -> It's a PHYSICAL aisle/permanent block.
            is_real_seat = any(st in (1, 2) for st in statuses)

            if is_real_seat:
                new_seats.append({"id": sid, "type": "seat"})
            else:
                new_seats.append({"id": "", "type": "aisle"})

        row["seats"] = new_seats

    return base_layout


async def discover_studios_from_performance(
    db: AsyncClient, date: str, theatre_ids: list[str] | None = None, force: bool = False
) -> dict[str, list[dict[str, Any]]]:
    """Find unique studios and their sampled raw layouts from Firestore."""
    logger.info(f"🔍 Discovering studios with raw layouts for {date}...")
    movie_docs = await db.collection(SCHEDULES_V2).document(date).collection("movies").get()

    studio_samples: dict[str, list[dict[str, Any]]] = defaultdict(list)
    processed_movies = 0
    # Very conservative concurrency to prevent Firestore timeouts
    semaphore = asyncio.Semaphore(5)
    import random

    async def process_movie(m: Any) -> None:
        nonlocal processed_movies
        async with semaphore:
            # Small jittered sleep to stagger the bursts
            await asyncio.sleep(random.random() * 2.0)

            st_ref = db.collection(MOVIE_PERFORMANCE_V2).document(m.id).collection("days").document(date).collection("showtimes")
            try:
                # Use stream() instead of get() for better stability
                async for doc in st_ref.stream():
                    data = doc.to_dict()
                    raw = data.get("initial_raw_layout")
                    tid, sid, merchant = data.get("theatre_id"), data.get("studio_id"), data.get("merchant")

                    if raw and tid and sid and (not theatre_ids or tid in theatre_ids):
                        key = f"{tid}:{sid}"
                        if len(studio_samples[key]) < 5:
                            raw["__metadata"] = {"merchant": merchant, "theatre_id": tid, "studio_id": sid}
                            studio_samples[key].append(raw)
            except Exception as e:
                logger.error(f"   ⚠️ Error movie {m.id}: {e}")

        processed_movies += 1
        if processed_movies % 2 == 0:
            logger.info(f"   Processed {processed_movies}/{len(movie_docs)} movies...")

    await asyncio.gather(*(process_movie(m) for m in movie_docs))
    logger.info(f"✅ Discovered {len(studio_samples)} unique studios with data.")
    return studio_samples


async def bootstrap_theatre_layouts(db: AsyncClient, studio_samples: dict[str, list[dict[str, Any]]], force: bool = False) -> None:
    """Migrate layouts to version 3 (Ground Truth)."""
    total_studios = len(studio_samples)
    current = 0

    for key, samples in studio_samples.items():
        current += 1
        theatre_id, studio_id = key.split(":")
        merchant = samples[0]["__metadata"]["merchant"]

        # Skip if already migrated to V3
        studio_ref = db.collection(THEATRES).document(theatre_id).collection("studios").document(studio_id)
        existing = await studio_ref.get()
        if existing.exists:
            data = existing.to_dict()
            if data.get("is_locked"):
                continue
            if not force and data.get("version") == 3:
                continue

        logger.info(f"[{current}/{total_studios}] Ground Truth Mapping: {merchant} | {theatre_id} | Studio {studio_id}")

        # 1. Parse all samples to Unified format (preserving status)
        parsed_layouts = [parse_to_master_layout(s, merchant) for s in samples]

        # 2. Merge via consensus
        final_layout = merge_consensus(parsed_layouts)

        if final_layout:
            total_seats = sum(1 for r in final_layout for s in r.get("seats", []) if s.get("type") == "seat")

            # Preserve existing audit data (especially manual confirmation)
            audit_data = {
                "source": "raw_initial_layout",
                "method": "multi_movie_consensus",
                "sample_count": len(samples),
                "is_confirmed": False,
                "confirmed_at": None,
                "version": 3
            }

            if existing.exists:
                old_data = existing.to_dict()
                old_audit = old_data.get("audit", {})
                if old_audit.get("is_confirmed"):
                    audit_data["is_confirmed"] = True
                    audit_data["confirmed_at"] = old_audit.get("confirmed_at")
                    audit_data["confirmed_by"] = old_audit.get("confirmed_by")

            update_data = {
                "studio_id": studio_id,
                "layout": final_layout,
                "total_seats": total_seats,
                "last_updated": datetime.now(JAKARTA_TZ).isoformat(),
                "version": 3,
                "audit": audit_data,
                "is_locked": audit_data["is_confirmed"], # Lock if confirmed
                "name": f"Studio {studio_id}"
            }
            await studio_ref.set(update_data, merge=True)
            logger.info(f"   ✅ Saved V3 with Audit: {total_seats} seats (Consensus from {len(samples)} showtimes)")


async def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--theatre-ids", type=str, help="Comma-separated theatre IDs")
    parser.add_argument("--all", action="store_true", help="Process all")
    parser.add_argument("--date", type=str, help="Date (YYYY-MM-DD)")
    parser.add_argument("--force", action="store_true", help="Force re-migration")
    args = parser.parse_args()

    if not args.theatre_ids and not args.all:
        logger.error("Usage: --all or --theatre-ids ID1,ID2")
        return

    t_ids = [tid.strip() for tid in args.theatre_ids.split(",")] if args.theatre_ids else None
    date = args.date or datetime.now(JAKARTA_TZ).strftime("%Y-%m-%d")

    db = await get_firestore_async_client()
    try:
        studio_samples = await discover_studios_from_performance(db, date, t_ids, args.force)
        if studio_samples:
            await bootstrap_theatre_layouts(db, studio_samples, args.force)
    finally:
        with contextlib.suppress(BaseException):
            db.close()

if __name__ == "__main__":
    asyncio.run(main())
