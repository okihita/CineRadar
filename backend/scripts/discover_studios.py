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
        credentials = service_account.Credentials.from_service_account_info(sa_info)  # type: ignore[no-untyped-call]
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
    db: AsyncClient, studios: dict[tuple[str, str], str], dry_run: bool
) -> None:
    """Write basic metadata to Firestore if document does not exist."""
    new_count = 0
    existing_count = 0
    new_entries = []

    notification_service = ResendNotificationService()

    for (theatre_id, studio_id), category in studios.items():
        # Check if theatre doc exists to get name for notification
        theatre_doc = await db.collection(THEATRES).document(theatre_id).get(["name"])
        theatre_name = theatre_doc.to_dict().get("name", theatre_id) if theatre_doc.exists else theatre_id

        doc_ref = (
            db.collection(THEATRES).document(theatre_id).collection("studios").document(studio_id)
        )

        doc = await doc_ref.get(["studio_id"])
        if doc.exists:
            existing_count += 1
            continue

        new_count += 1
        name = generate_default_name(studio_id, category)
        layout = StudioLayout(studio_id=studio_id, name=name)
        new_entries.append(f"{theatre_name}: {name} ({category})")

        if not dry_run:
            await doc_ref.set(layout.to_dict())
            logger.info(f"Created [Theatre: {theatre_id}] Studio: {studio_id} '{name}'")
        else:
            logger.info(
                f"[DRY RUN] Would create [Theatre: {theatre_id}] Studio: {studio_id} '{name}'"
            )

    if new_count > 0 and not dry_run:
        subject = f"[CineRadar] {new_count} New Studios Discovered"
        body = "The following new studios were discovered during the daily scan:\n\n"
        body += "\n".join([f"- {entry}" for entry in new_entries])
        body += "\n\nPlease review and bootstrap layouts if needed."

        await notification_service.send_alert(subject, body)

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
        db.close()


if __name__ == "__main__":
    asyncio.run(main())
