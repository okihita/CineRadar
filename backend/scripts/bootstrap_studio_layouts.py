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
from typing import Any

sys.path.insert(0, ".")


from google.cloud import firestore
from google.cloud.firestore import AsyncClient

from backend.domain.time import JAKARTA_TZ
from backend.infrastructure.firestore_collections import (
    MOVIE_PERFORMANCE_V2,
    SCHEDULES_V2,
    THEATRES,
)
from backend.infrastructure.repositories.firestore_utils import get_firestore_async_client

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger(__name__)


def parse_to_master_layout(raw_data: dict[str, Any], merchant: str) -> list[dict[str, Any]]:
    """Convert raw API data into CineRadar Unified Grid format."""
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
                if seat_id and status != 0:
                    row_data["seats"].append({"id": seat_id, "type": "seat", "_raw_status": status})
                else:
                    row_data["seats"].append({"id": "", "type": "aisle"})
            unified_layout.append(row_data)

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
        # Flat Structure (Cinépolis / FLIX)
        rows_dict = defaultdict(list)
        for item in seat_map:
            row_name = item.get("row_name", "ALL")
            seat_no = item.get("seat_no")
            seat_yn = str(item.get("seat_yn", "1"))
            status = item.get("status", 1)

            if seat_yn == "1":
                if seat_no:
                    rows_dict[row_name].append({"id": f"{row_name}{seat_no}", "type": "seat", "_raw_status": status})
                else:
                    rows_dict[row_name].append({"id": "", "type": "aisle"})
            else:
                rows_dict[row_name].append({"id": "", "type": "aisle"})

        for row_name, seats in rows_dict.items():
            unified_layout.append({"row_name": row_name, "seats": seats})

    return unified_layout


def merge_consensus(layouts: list[list[dict[str, Any]]]) -> list[dict[str, Any]]:
    """Merge multiple layouts using ID-aware consensus."""
    if not layouts:
        return []
    if len(layouts) == 1:
        base = layouts[0]
        for row in base:
            for s in row["seats"]:
                if s.get("type") == "seat" and s.get("_raw_status") in (5, 6):
                    s["type"] = "aisle"
                    s["id"] = ""
                s.pop("_raw_status", None)
                s.pop("_is_rule_aisle", None)
        return base

    base_layout = layouts[0]
    seat_status_history = defaultdict(list)
    for layout in layouts:
        for row in layout:
            for s in row["seats"]:
                if s.get("id"):
                    seat_status_history[s["id"]].append(s.get("_raw_status"))

    for row in base_layout:
        new_seats = []
        for s in row["seats"]:
            sid = s.get("id")
            if not sid:
                s.pop("_raw_status", None)
                s.pop("_is_rule_aisle", None)
                new_seats.append(s)
                continue
            statuses = seat_status_history.get(sid, [])
            is_real_seat = any(st in (1, 2) for st in statuses)
            if is_real_seat:
                new_seats.append({"id": sid, "type": "seat"})
            else:
                new_seats.append({"id": "", "type": "aisle"})
        row["seats"] = new_seats
    return base_layout


async def extract_studio_id_map(db: AsyncClient, date: str) -> dict[str, str]:
    """Map showtime_id -> studio_id from schedules."""
    mapping = {}
    docs = await db.collection(SCHEDULES_V2).document(date).collection("movies").get()
    for m in docs:
        d = m.to_dict()
        for _city, theatres in d.get("cities", {}).items():
            for t in theatres:
                for room in t.get("rooms", []):
                    for st in room.get("all_showtimes", []):
                        if st.get("showtime_id") and st.get("studio_id"):
                            mapping[st["showtime_id"]] = str(st["studio_id"])
    return mapping


async def discover_studios_from_performance(
    db: AsyncClient, date: str, theatre_ids: list[str] | None = None, force: bool = False
) -> dict[str, list[dict[str, Any]]]:
    """Find unique studios and their sampled raw layouts."""
    st_to_studio_map = await extract_studio_id_map(db, date)
    logger.info(f"🔍 Discovering studios from performance for {date}...")
    movie_docs = await db.collection(SCHEDULES_V2).document(date).collection("movies").get()

    studio_samples: dict[str, list[dict[str, Any]]] = defaultdict(list)
    processed_count = 0
    semaphore = asyncio.Semaphore(10)

    async def process_movie(m: Any) -> None:
        nonlocal processed_count
        async with semaphore:
            st_ref = db.collection(MOVIE_PERFORMANCE_V2).document(m.id).collection("days").document(date).collection("showtimes")
            async for doc in st_ref.stream():
                d = doc.to_dict()
                raw = d.get("raw_api_response") or d.get("initial_raw_layout")
                tid, sid, merchant = d.get("theatre_id"), d.get("studio_id"), d.get("merchant")
                if not sid and doc.id in st_to_studio_map:
                    sid = st_to_studio_map[doc.id]

                if raw and tid and sid and (not theatre_ids or tid in theatre_ids):
                    if "data" not in raw:
                        raw = {"data": raw, "success": True}
                    key = f"{tid}:{sid}"
                    if len(studio_samples[key]) < 5:
                        raw["__metadata"] = {"merchant": merchant, "theatre_id": tid, "studio_id": sid}
                        studio_samples[key].append(raw)
        processed_count += 1

    await asyncio.gather(*(process_movie(m) for m in movie_docs))
    return studio_samples


async def bootstrap_theatre_layouts(
    db: AsyncClient, studio_samples: dict[str, list[dict[str, Any]]], force: bool = False
) -> None:
    """Save finalized layouts to Registry."""
    total = len(studio_samples)
    for i, (key, samples) in enumerate(studio_samples.items(), 1):
        theatre_id, studio_id = key.split(":")
        merchant = samples[0]["__metadata"]["merchant"]

        studio_ref = db.collection(THEATRES).document(theatre_id).collection("studios").document(studio_id)
        existing = await studio_ref.get()

        if existing.exists and not force:
            data = existing.to_dict()
            if data.get("is_locked") or data.get("version") == 3:
                continue

        logger.info(f"[{i}/{total}] Bootstrapping {merchant} | {theatre_id} | Studio {studio_id}")

        parsed_layouts = [parse_to_master_layout(s, merchant) for s in samples]
        final_layout = merge_consensus(parsed_layouts)

        if final_layout:
            total_seats = sum(1 for r in final_layout for s in r.get("seats", []) if s.get("type") == "seat")
            raw_payload = samples[0].get("data") or samples[0]
            if isinstance(raw_payload, dict):
                raw_payload.pop("__metadata", None)

            # Extract Room Category from Price Group if available
            discovered_category = None
            if isinstance(raw_payload, dict) and "price_group" in raw_payload:
                pgs = raw_payload.get("price_group", [])
                if pgs and isinstance(pgs, list):
                    discovered_category = pgs[0].get("seat_grd_nm")

            # Core Update Data
            update_data = {
                "studio_id": studio_id,
                "layout": final_layout,
                "raw_initial_layout": raw_payload,
                "total_seats": total_seats,
                "last_updated": datetime.now(JAKARTA_TZ).isoformat(),
                "version": 3,
                "is_locked": True,
                "name": firestore.DELETE_FIELD,
            }

            if discovered_category:
                update_data["room_category"] = discovered_category

            # Preserve metadata if needed
            if existing.exists:
                old_data = existing.to_dict()
                if old_data.get("room_category") and not discovered_category:
                    update_data["room_category"] = old_data["room_category"]

            await studio_ref.set(update_data, merge=True)
            logger.info(f"   ✅ Saved: {total_seats} seats ({update_data.get('room_category')})")


async def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--theatre-ids", type=str)
    parser.add_argument("--all", action="store_true")
    parser.add_argument("--date", type=str)
    parser.add_argument("--force", action="store_true")
    args = parser.parse_args()

    t_ids = [tid.strip() for tid in args.theatre_ids.split(",")] if args.theatre_ids else None
    date = args.date or datetime.now(JAKARTA_TZ).strftime("%Y-%m-%d")

    db = await get_firestore_async_client()
    try:
        samples = await discover_studios_from_performance(db, date, t_ids, args.force)
        if samples:
            await bootstrap_theatre_layouts(db, samples, args.force)
    finally:
        db.close()

if __name__ == "__main__":
    asyncio.run(main())
