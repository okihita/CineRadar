#!/usr/bin/env python3
"""Migration script: Migrate custom TikTok hashtags to dedicated collection.

Reads tracked hashtags from monolithic `tiktok_sources/config` document,
migrates them to dedicated `tiktok_tracked_hashtags/{tag}` documents,
and removes the deprecated `tracked_hashtags` array from `tiktok_sources/config`
and local mirror file `studio/src/data/tiktok_sources.json`.
"""

from __future__ import annotations

import json
import logging
import os
import sys
from pathlib import Path
from typing import Any

from google.cloud import firestore

logging.basicConfig(level=logging.INFO, format="[%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

PROJECT_ID = os.environ.get("GOOGLE_CLOUD_PROJECT", "cineradar-481014")
TARGET_COLLECTION = "tiktok_tracked_hashtags"


def migrate_hashtags() -> None:
    logger.info("Connecting to Firestore project: %s", PROJECT_ID)
    db = firestore.Client(project=PROJECT_ID)

    sources_ref = db.collection("tiktok_sources").document("config")
    sources_doc = sources_ref.get()

    if not sources_doc.exists:
        logger.warning("tiktok_sources/config document does not exist.")
        return

    data = sources_doc.to_dict() or {}
    legacy_tags = data.get("tracked_hashtags", [])

    logger.info("Found %d legacy tracked hashtags in tiktok_sources/config", len(legacy_tags))

    migrated_count = 0
    for tag_entry in legacy_tags:
        if not isinstance(tag_entry, dict) or not tag_entry.get("tag"):
            continue

        raw_tag = str(tag_entry["tag"]).lower().strip().lstrip("#")
        doc_ref = db.collection(TARGET_COLLECTION).document(raw_tag)

        raw_cadence = tag_entry.get("cadence")
        cadence_val = int(raw_cadence) if raw_cadence is not None else 1
        raw_start_hour = tag_entry.get("start_hour")
        start_hour_val = int(raw_start_hour) if raw_start_hour is not None else 18
        raw_posts = tag_entry.get("target_posts")
        target_posts_val = int(raw_posts) if raw_posts is not None else 40

        # Standardize document schema
        clean_entry: dict[str, Any] = {
            "id": raw_tag,
            "tag": raw_tag,
            "label": tag_entry.get("label") or raw_tag,
            "category": tag_entry.get("category") or "general",
            "cadence": cadence_val,
            "start_hour": start_hour_val,
            "target_posts": target_posts_val,
            "include_comments": tag_entry.get("include_comments", True) is not False,
            "active": tag_entry.get("active", True) is not False,
            "created_at": tag_entry.get("created_at") or firestore.SERVER_TIMESTAMP,
            "updated_at": tag_entry.get("updated_at") or firestore.SERVER_TIMESTAMP,
        }

        doc_ref.set(clean_entry, merge=True)
        logger.info("Migrated #%s -> %s/%s", raw_tag, TARGET_COLLECTION, raw_tag)
        migrated_count += 1

    # Remove legacy field from Firestore tiktok_sources/config
    sources_ref.update({"tracked_hashtags": firestore.DELETE_FIELD})
    logger.info("Removed legacy 'tracked_hashtags' field from tiktok_sources/config")

    # Clean local JSON backup file if present
    repo_root = Path(__file__).resolve().parent.parent.parent
    local_json_path = repo_root / "studio" / "src" / "data" / "tiktok_sources.json"
    if local_json_path.exists():
        try:
            with open(local_json_path, encoding="utf-8") as f:
                local_data = json.load(f)
            if "tracked_hashtags" in local_data:
                del local_data["tracked_hashtags"]
                with open(local_json_path, "w", encoding="utf-8") as f:
                    json.dump(local_data, f, indent=2)
                logger.info("Cleaned legacy 'tracked_hashtags' from local %s", local_json_path)
        except Exception as e:
            logger.warning("Could not update local json: %s", e)

    logger.info("Successfully migrated %d hashtags to %s", migrated_count, TARGET_COLLECTION)


if __name__ == "__main__":
    try:
        migrate_hashtags()
    except Exception as exc:
        logger.error("Migration failed: %s", exc, exc_info=True)
        sys.exit(1)
