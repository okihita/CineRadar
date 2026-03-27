#!/usr/bin/env python3
"""V2 Recovery Script — Targeted Ground Truth Migration.

Scans the Master Layout database for studios still on V2 (Guessed).
For each missing studio, it directly queries today's schedule to find
any movie playing there, then extracts the initial_raw_layout.

This avoids the "Movie Collection Timeout" by querying from the Theatre perspective.
"""

import asyncio
import logging
import sys
from collections import defaultdict
from datetime import datetime

sys.path.insert(0, ".")


import contextlib

from google.cloud.firestore import AsyncClient

from backend.domain.time import JAKARTA_TZ
from backend.infrastructure.firestore_collections import (
    MOVIE_PERFORMANCE_V2,
    SCHEDULES_V2,
    THEATRES,
)
from backend.infrastructure.repositories.firestore_utils import get_firestore_async_client
from backend.scripts.bootstrap_studio_layouts import merge_consensus, parse_to_master_layout

logging.basicConfig(level=logging.INFO, format="%(asctime)s | %(levelname)s | %(message)s")
logger = logging.getLogger(__name__)


async def find_v2_studios(db: AsyncClient) -> dict[str, list[str]]:
    """Find all theatres that have at least one V2 studio.

    Returns: { theatre_id: [studio_id_1, studio_id_2] }
    """
    logger.info("🔍 Scanning Master Database for V2 Studios...")
    theatres = await db.collection(THEATRES).get()

    v2_map = defaultdict(list)
    total_v2 = 0

    for t_doc in theatres:
        studios = await t_doc.reference.collection("studios").get()
        for s_doc in studios:
            data = s_doc.to_dict()
            if data.get("version", 0) < 3 and not data.get("is_locked"):
                v2_map[t_doc.id].append(s_doc.id)
                total_v2 += 1

    logger.info(f"📋 Found {total_v2} studios across {len(v2_map)} theatres still on V2/Legacy.")
    return v2_map


async def recover_v2_studios(db: AsyncClient, v2_map: dict[str, list[str]], date: str) -> None:
    """Attempt to recover V2 studios by finding their showtimes in today's schedule."""

    logger.info("🗓️ Loading today's schedule map...")
    movie_docs = await db.collection(SCHEDULES_V2).document(date).collection("movies").get()

    # Pre-build a reverse lookup: (theatre_id, studio_id) -> list of (movie_id, showtime_id)
    # This avoids querying entire subcollections by allowing direct document reads.
    studio_to_showtimes = defaultdict(list)
    for m in movie_docs:
        meta_id = m.id
        cities = m.to_dict().get("cities", {})
        for _city, theatres in cities.items():
            for t in theatres:
                tid = t.get("theatre_id")
                if tid in v2_map:
                    for room in t.get("rooms", []):
                        sid = str(room.get("studio_id") or "")

                        # Gather all showtime IDs for this room
                        for st in room.get("all_showtimes", []):
                            st_id = st.get("showtime_id")
                            if not st_id:
                                continue

                            # Use showtime-level studio ID if available, else room-level
                            current_sid = str(st.get("studio_id") or sid)

                            if current_sid in v2_map[tid]:
                                studio_to_showtimes[f"{tid}:{current_sid}"].append((meta_id, st_id))

    recovered_count = 0

    # Now fetch the exact showtime documents
    for key, st_pairs in studio_to_showtimes.items():
        if not st_pairs:
            continue

        tid, sid = key.split(":")
        logger.info(f"🔄 Recovering Theatre {tid} Studio {sid} (Found {len(st_pairs)} showtimes)")

        samples = []
        merchant = None

        # Take up to 5 unique movies for consensus
        sampled_movies = set()
        selected_pairs = []
        for meta_id, st_id in st_pairs:
            if meta_id not in sampled_movies:
                sampled_movies.add(meta_id)
                selected_pairs.append((meta_id, st_id))
            if len(selected_pairs) >= 5:
                break

        for meta_id, st_id in selected_pairs:
            try:
                # Direct document lookup - O(1) operation, no timeouts!
                doc_ref = (
                    db.collection(MOVIE_PERFORMANCE_V2)
                    .document(meta_id)
                    .collection("days")
                    .document(date)
                    .collection("showtimes")
                    .document(st_id)
                )
                doc = await doc_ref.get()

                if doc.exists:
                    data = doc.to_dict()
                    raw = data.get("initial_raw_layout")
                    if raw:
                        merchant = data.get("merchant")
                        raw["__metadata"] = {
                            "merchant": merchant,
                            "theatre_id": tid,
                            "studio_id": sid,
                        }
                        samples.append(raw)
            except Exception as e:
                logger.error(f"   ⚠️ Error fetching exact showtime {st_id}: {e}")

        if samples and merchant:
            # Reconstruct V3 using exact same logic as main bootstrap
            parsed_layouts = [parse_to_master_layout(s, merchant) for s in samples]
            final_layout = merge_consensus(parsed_layouts)

            if final_layout:
                total_seats = sum(
                    1 for r in final_layout for s in r.get("seats", []) if s.get("type") == "seat"
                )
                update_data = {
                    "layout": final_layout,
                    "total_seats": total_seats,
                    "last_updated": datetime.now(JAKARTA_TZ).isoformat(),
                    "version": 3,
                    "audit": {
                        "source": "raw_initial_layout",
                        "method": "multi_movie_consensus_recovery",
                        "sample_count": len(samples),
                        "is_confirmed": False,
                        "version": 3,
                    },
                }

                await (
                    db.collection(THEATRES)
                    .document(tid)
                    .collection("studios")
                    .document(sid)
                    .set(update_data, merge=True)
                )
                logger.info(f"   ✅ Recovered V3! {total_seats} seats from {len(samples)} samples.")
                recovered_count += 1
        else:
            logger.warning("   ⚠️ No raw layout data found in performance logs.")

    logger.info(f"🎉 Recovery complete. Upgraded {recovered_count} studios to V3 Ground Truth.")


async def main() -> None:
    date = datetime.now(JAKARTA_TZ).strftime("%Y-%m-%d")
    db = await get_firestore_async_client()
    try:
        v2_map = await find_v2_studios(db)
        if v2_map:
            await recover_v2_studios(db, v2_map, date)
    finally:
        with contextlib.suppress(BaseException):
            db.close()


if __name__ == "__main__":
    asyncio.run(main())
