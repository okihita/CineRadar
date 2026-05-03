#!/usr/bin/env python3
"""Discover Studios — Tier 1 Visual MVP Baseline.

Scans recent schedules and populates theatres/{theatre_id}/studios/{studio_id}
with basic metadata (IDs, default names), temporarily ignoring exact seat counts
or layouts. This enables the Admin UI to show a baseline registry of all physical studios.

Usage:
    PYTHONPATH=. uv run python backend/scripts/discover_studios.py
    PYTHONPATH=. uv run python backend/scripts/discover_studios.py --date 2026-03-18
"""

import argparse
import asyncio
import json
import logging
import os
import sys
from datetime import datetime

sys.path.insert(0, ".")

from google.cloud.firestore import AsyncClient
from google.oauth2 import service_account

from backend.domain.models.theatre import StudioLayout
from backend.domain.time import JAKARTA_TZ
from backend.infrastructure.core.resend_notification_service import ResendNotificationService
from backend.infrastructure.firestore_collections import MOVIES, SCHEDULES_V2, THEATRES

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger(__name__)


async def get_firestore_client() -> AsyncClient:
    """Initialize async Firestore client from env or ADC."""
    sa_json = os.environ.get("FIREBASE_SERVICE_ACCOUNT")
    if sa_json:
        sa_info = json.loads(sa_json)
        credentials = service_account.Credentials.from_service_account_info(sa_info)
        return AsyncClient(credentials=credentials, project=sa_info["project_id"])
    return AsyncClient()


async def discover_studios(db: AsyncClient, date: str) -> dict[tuple[str, str], str]:
    """Walk schedules_v2 to extract all unique (theatre_id, studio_id) pairs.

    Returns:
        {(theatre_id, studio_id): room_category}
    """
    logger.info(f"Discovering studios from schedules_v2/{date}/movies/...")

    movies_ref = db.collection(SCHEDULES_V2).document(date).collection(MOVIES)
    movie_docs = [doc async for doc in movies_ref.stream()]

    if not movie_docs:
        logger.warning(f"No documents found in schedules_v2/{date}/movies/")
        return {}

    studios: dict[tuple[str, str], str] = {}

    for movie_doc in movie_docs:
        data = movie_doc.to_dict() or {}

        for _city, theatres in data.get("cities", {}).items():
            for theatre in theatres:
                theatre_id: str = theatre.get("theatre_id", "")
                if not theatre_id:
                    continue

                for room in theatre.get("rooms", []):
                    room_category = room.get("category", "")
                    for st in room.get("all_showtimes", []):
                        studio_id: str | None = st.get("studio_id")
                        if not studio_id:
                            continue

                        key = (theatre_id, studio_id)
                        if key not in studios:
                            studios[key] = room_category

    logger.info(f"Discovered {len(studios)} unique (theatre_id, studio_id) pairs.")
    return studios


def generate_default_name(studio_id: str, category: str) -> str:
    """Generate a reasonable default name for the studio."""
    # Sometimes ID is like "11" or "100101". Just returning "Studio {id}" is safe,
    # but we can try to guess from category if available.
    base_name = f"Studio {studio_id}"
    if category and category.upper() not in ["REGULAR", "2D"]:
        return f"{base_name} ({category})"
    return base_name


async def populate_studios(
    db: AsyncClient, studios_map: dict[tuple[str, str], str], dry_run: bool
) -> None:
    """Write basic metadata to Firestore if document does not exist using bulk operations."""
    studio_items = list(studios_map.items())  # [((t_id, s_id), category), ...]
    studio_refs = [
        db.collection(THEATRES).document(t_id).collection("studios").document(s_id)
        for (t_id, s_id), _ in studio_items
    ]

    logger.info(f"Checking existence of {len(studio_items)} studios...")
    existing_studios = set()
    # Firestore get_all has a limit of 1000 per call
    for i in range(0, len(studio_refs), 1000):
        chunk = studio_refs[i : i + 1000]
        async for doc in db.get_all(chunk, field_paths=["studio_id"]):
            if doc.exists:
                # doc.reference.parent is the collection 'studios'
                # doc.reference.parent.parent is the document 'theatres/{theatre_id}'
                t_id = doc.reference.parent.parent.id
                existing_studios.add((t_id, doc.id))

    # Identify new studios
    new_studio_requests = [
        ((t_id, s_id), category)
        for (t_id, s_id), category in studio_items
        if (t_id, s_id) not in existing_studios
    ]

    existing_count = len(studio_items) - len(new_studio_requests)
    new_count = len(new_studio_requests)

    if not new_studio_requests:
        logger.info(f"Summary: 0 newly created, {existing_count} already existed.")
        return

    logger.info(f"Found {new_count} new studios. Fetching theatre names...")

    # Fetch theatre names for NEW studios only to reduce notification noise
    new_theatre_ids = {t_id for (t_id, s_id), _ in new_studio_requests}
    theatre_refs = [db.collection(THEATRES).document(t_id) for t_id in new_theatre_ids]
    theatre_names = {}

    for i in range(0, len(theatre_refs), 1000):
        chunk = theatre_refs[i : i + 1000]
        async for doc in db.get_all(chunk, field_paths=["name"]):
            t_dict = doc.to_dict()
            theatre_names[doc.id] = (
                t_dict.get("name", doc.id) if doc.exists and t_dict else doc.id
            )

    # Batch create new studios
    new_entries = []
    if not dry_run:
        batch = db.batch()
        batch_count = 0

        for (t_id, s_id), category in new_studio_requests:
            name = generate_default_name(s_id, category)
            layout = StudioLayout(studio_id=s_id, name=name)
            theatre_name = theatre_names.get(t_id, t_id)
            new_entries.append(f"{theatre_name}: {name} ({category})")

            doc_ref = (
                db.collection(THEATRES)
                .document(t_id)
                .collection("studios")
                .document(s_id)
            )
            batch.set(doc_ref, layout.to_dict())
            batch_count += 1

            if batch_count >= 500:
                await batch.commit()
                batch = db.batch()
                batch_count = 0

        if batch_count > 0:
            await batch.commit()

        # Send notifications for new discoveries
        notification_service = ResendNotificationService()
        subject = f"[CineRadar] {new_count} New Studios Discovered"
        body = "The following new studios were discovered during the daily scan:\n\n"
        body += "\n".join([f"- {entry}" for entry in new_entries])
        body += "\n\nPlease review and bootstrap layouts if needed."
        await notification_service.send_alert(subject, body)
    else:
        for (t_id, s_id), category in new_studio_requests:
            name = generate_default_name(s_id, category)
            theatre_name = theatre_names.get(t_id, t_id)
            logger.info(
                f"[DRY RUN] Would create [Theatre: {t_id}] Studio: {s_id} '{name}'"
            )

    logger.info(f"Summary: {new_count} newly created, {existing_count} already existed.")


async def main() -> None:
    parser = argparse.ArgumentParser(description="Discover and populate basic studio metadata.")
    parser.add_argument(
        "--date",
        type=str,
        default=datetime.now(JAKARTA_TZ).strftime("%Y-%m-%d"),
        help="Date to scan schedules from (YYYY-MM-DD)",
    )
    parser.add_argument("--dry-run", action="store_true", help="Do not write to Firestore")
    args = parser.parse_args()

    db = await get_firestore_client()
    try:
        studios = await discover_studios(db, args.date)
        if studios:
            await populate_studios(db, studios, args.dry_run)
    finally:
        await db.close()


if __name__ == "__main__":
    asyncio.run(main())
