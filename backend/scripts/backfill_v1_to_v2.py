#!/usr/bin/env python3
"""
V1 → V2 Backfill Script
⚠️ MIGRATION ONLY — delete after V1 sunset

Backfills movie_performance V1 docs that are missing from V2.

Usage:
    # Step 1: Analyze gap (read-only)
    PYTHONPATH=. uv run python backend/scripts/backfill_v1_to_v2.py --analyze

    # Step 2: Build ID mapping (read-only)
    PYTHONPATH=. uv run python backend/scripts/backfill_v1_to_v2.py --build-mapping

    # Step 3: Dry-run backfill (read-only, shows what would be written)
    PYTHONPATH=. uv run python backend/scripts/backfill_v1_to_v2.py --dry-run

    # Step 4: Execute backfill (writes to V2)
    PYTHONPATH=. uv run python backend/scripts/backfill_v1_to_v2.py --execute

    # Resume from checkpoint after interruption
    PYTHONPATH=. uv run python backend/scripts/backfill_v1_to_v2.py --execute --resume
"""

from __future__ import annotations

import argparse
import json
import logging
import sys
import time
from datetime import datetime
from pathlib import Path
from typing import TYPE_CHECKING, cast

if TYPE_CHECKING:
    from google.cloud.firestore_v1.base_document import DocumentSnapshot

from google.cloud import firestore
from google.oauth2 import service_account
from infrastructure.firestore_collections import (
    MOVIE_PERFORMANCE,
    MOVIE_PERFORMANCE_V2,
    SCHEDULES_V2,
)

# ─── Config ──────────────────────────────────────────────────────────

CHECKPOINT_DIR = Path("migration_checkpoint")
CHECKPOINT_DIR.mkdir(exist_ok=True)

MAPPING_FILE = CHECKPOINT_DIR / "id_mapping.json"
GAP_FILE = CHECKPOINT_DIR / "gap_analysis.json"
PROGRESS_FILE = CHECKPOINT_DIR / "progress.json"

BATCH_SIZE = 10  # dates per batch when building mapping
DELAY_BETWEEN_BATCHES = 1.0  # seconds, to avoid Firestore throttling
DELAY_BETWEEN_DOCS = 0.2  # seconds between individual backfill writes

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-5s | %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger(__name__)


# ─── Env / Client ────────────────────────────────────────────────────

def load_env(env_file: str = "admin/.env.local") -> None:
    """Load environment variables from a .env file."""
    env_path = Path(env_file)
    if not env_path.exists():
        return
    import os
    with open(env_path) as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            if "=" not in line:
                continue
            key, _, value = line.partition("=")
            key = key.strip()
            value = value.strip().strip('"').strip("'")
            if key and key not in os.environ:
                os.environ[key] = value


load_env()
load_env(".env")
load_env(".env.local")


def get_firestore_client() -> firestore.Client:
    """Initialize Firestore client from environment."""
    import os


    project_id = os.environ.get("FIREBASE_PROJECT_ID", "cineradar-481014")

    sa_json = os.environ.get("FIREBASE_SERVICE_ACCOUNT")
    if sa_json:
        sa_info = json.loads(sa_json)
        creds = service_account.Credentials.from_service_account_info(sa_info)
        return firestore.Client(credentials=creds, project=sa_info.get("project_id", project_id))

    client_email = os.environ.get("FIREBASE_CLIENT_EMAIL")
    private_key = os.environ.get("FIREBASE_PRIVATE_KEY")
    if client_email and private_key:
        private_key = private_key.replace("\\n", "\n")
        sa_info = {
            "type": "service_account",
            "project_id": project_id,
            "private_key_id": "local",
            "private_key": private_key,
            "client_email": client_email,
            "client_id": "0",
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": "https://oauth2.googleapis.com/token",
            "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
        }
        creds = service_account.Credentials.from_service_account_info(sa_info)
        return firestore.Client(credentials=creds, project=project_id)

    return firestore.Client(project=project_id)


# ─── Step 1: Analyze Gap ────────────────────────────────────────────

def cmd_analyze(db: firestore.Client) -> None:
    """List V1 and V2 performance root docs, compute the gap."""
    logger.info("=" * 60)
    logger.info("STEP 1: Analyzing V1 vs V2 performance gap")
    logger.info("=" * 60)

    logger.info("Listing V1 movie_performance root docs...")
    v1_ids = sorted(doc.id for doc in db.collection(MOVIE_PERFORMANCE).list_documents())
    logger.info(f"  V1: {len(v1_ids)} root docs")

    logger.info("Listing V2 movie_performance_v2 root docs...")
    v2_ids = sorted(doc.id for doc in db.collection(MOVIE_PERFORMANCE_V2).list_documents())
    logger.info(f"  V2: {len(v2_ids)} root docs")

    overlap = set(v1_ids) & set(v2_ids)
    v1_only = sorted(set(v1_ids) - set(v2_ids))
    v2_only = sorted(set(v2_ids) - set(v1_ids))

    logger.info(f"  Overlap: {len(overlap)}")
    logger.info(f"  V1 only (need backfill): {len(v1_only)}")
    logger.info(f"  V2 only: {len(v2_only)}")

    # Count subcollections for each V1-only doc
    logger.info("")
    logger.info("Sizing V1-only docs...")
    gap_data = []
    for i, sid in enumerate(v1_only):
        days_ref = db.collection(MOVIE_PERFORMANCE).document(sid).collection("days")
        days = list(days_ref.list_documents())
        showtime_count = 0
        for day_ref in days:
            sts = list(day_ref.collection("showtimes").list_documents())
            showtime_count += len(sts)
        gap_data.append({
            "schedule_id": sid,
            "day_count": len(days),
            "showtime_count": showtime_count,
        })
        logger.info(f"  [{i+1}/{len(v1_only)}] {sid}: {len(days)} days, {showtime_count} showtimes")
        time.sleep(0.1)

    total_days = sum(g["day_count"] for g in gap_data)
    total_sts = sum(g["showtime_count"] for g in gap_data)

    logger.info("")
    logger.info("TOTAL BACKFILL SCOPE:")
    logger.info(f"  Docs:  {len(v1_only)}")
    logger.info(f"  Days:  {total_days}")
    logger.info(f"  Showtimes: {total_sts}")
    logger.info(f"  Est. Firestore writes: ~{len(v1_only) + total_days + total_sts}")

    # Save
    result = {
        "generated_at": datetime.utcnow().isoformat(),
        "v1_count": len(v1_ids),
        "v2_count": len(v2_ids),
        "overlap_count": len(overlap),
        "v1_only_count": len(v1_only),
        "v2_only_count": len(v2_only),
        "gap_docs": gap_data,
        "total_days": total_days,
        "total_showtimes": total_sts,
    }
    GAP_FILE.write_text(json.dumps(result, indent=2))
    logger.info(f"\n💾 Saved gap analysis to {GAP_FILE}")


# ─── Step 2: Build ID Mapping ───────────────────────────────────────

def cmd_build_mapping(db: firestore.Client) -> None:
    """Build schedule_id → metadata_id mapping from V2 schedules."""
    logger.info("=" * 60)
    logger.info("STEP 2: Building schedule_id → metadata_id mapping")
    logger.info("=" * 60)

    mapping: dict[str, str] = {}
    dates = sorted(
        doc.id for doc in db.collection(SCHEDULES_V2).list_documents()
        if doc.id != "latest"
    )
    logger.info(f"Found {len(dates)} V2 dates to scan")

    # Check for existing checkpoint
    start_idx = 0
    if MAPPING_FILE.exists():
        existing = json.loads(MAPPING_FILE.read_text())
        mapping = existing.get("mapping", {})
        start_idx = existing.get("last_scanned_idx", 0) + 1
        logger.info(f"Resuming from date index {start_idx} ({len(mapping)} mappings already built)")

    for i in range(start_idx, len(dates), BATCH_SIZE):
        batch = dates[i : i + BATCH_SIZE]
        for date in batch:
            docs = list(db.collection(SCHEDULES_V2).document(date).collection("movies").stream())
            for doc in docs:
                metadata_id = doc.id
                sids = doc.to_dict().get("schedule_ids", [])
                for sid in sids:
                    mapping[sid] = metadata_id
            time.sleep(0.2)

        logger.info(f"  [{min(i + BATCH_SIZE, len(dates))}/{len(dates)}] mapping size: {len(mapping)}")

        # Checkpoint
        MAPPING_FILE.write_text(json.dumps({
            "mapping": mapping,
            "last_scanned_idx": min(i + BATCH_SIZE, len(dates)) - 1,
            "total_dates": len(dates),
        }, indent=2))

        time.sleep(DELAY_BETWEEN_BATCHES)

    unique_metadata_ids = len(set(mapping.values()))
    logger.info(f"\n✅ Mapping complete: {len(mapping)} schedule_ids → {unique_metadata_ids} metadata_ids")
    logger.info(f"💾 Saved to {MAPPING_FILE}")


# ─── Step 3: Dry Run ────────────────────────────────────────────────

def cmd_dry_run() -> None:
    """Show what would be backfilled without writing anything."""
    logger.info("=" * 60)
    logger.info("STEP 3: Dry-run backfill (no writes)")
    logger.info("=" * 60)

    if not GAP_FILE.exists():
        logger.error("❌ Run --analyze first to generate gap analysis")
        sys.exit(1)
    if not MAPPING_FILE.exists():
        logger.error("❌ Run --build-mapping first to generate ID mapping")
        sys.exit(1)

    gap = json.loads(GAP_FILE.read_text())
    mapping_data = json.loads(MAPPING_FILE.read_text())
    mapping = mapping_data["mapping"]

    mapped = 0
    unmapped = 0
    for doc in gap["gap_docs"]:
        sid = doc["schedule_id"]
        mid = mapping.get(sid)
        if mid:
            mapped += 1
            logger.info(f"  ✅ {sid} → {mid} ({doc['day_count']} days, {doc['showtime_count']} showtimes)")
        else:
            unmapped += 1
            logger.info(f"  ⚠️  {sid} → NO MAPPING (orphan, cannot backfill)")

    logger.info("")
    logger.info(f"SUMMARY: {mapped} mappable, {unmapped} orphans (unmappable)")
    logger.info(f"  Total writes that would happen: ~{gap['v1_only_count'] + gap['total_days'] + gap['total_showtimes']}")


# ─── Step 4: Execute Backfill ────────────────────────────────────────

def cmd_execute(db: firestore.Client, resume: bool = False) -> None:
    """Execute the actual backfill."""
    logger.info("=" * 60)
    logger.info("STEP 4: Executing backfill")
    logger.info("=" * 60)

    if not GAP_FILE.exists() or not MAPPING_FILE.exists():
        logger.error("❌ Run --analyze and --build-mapping first")
        sys.exit(1)

    gap = json.loads(GAP_FILE.read_text())
    mapping_data = json.loads(MAPPING_FILE.read_text())
    mapping = mapping_data["mapping"]

    # Load progress for resume
    completed_sids: set[str] = set()
    if resume and PROGRESS_FILE.exists():
        progress = json.loads(PROGRESS_FILE.read_text())
        completed_sids = set(progress.get("completed", []))
        logger.info(f"Resuming: {len(completed_sids)} docs already backfilled")

    todo = [doc for doc in gap["gap_docs"] if doc["schedule_id"] not in completed_sids]

    if not todo:
        logger.info("✅ Nothing to backfill — all done!")
        return

    logger.info(f"Docs to backfill: {len(todo)}")
    logger.info("")

    for i, doc in enumerate(todo):
        sid = doc["schedule_id"]
        mid = mapping.get(sid)

        if not mid:
            logger.warning(f"  [{i+1}/{len(todo)}] SKIP {sid} — no metadata_id mapping")
            continue

        logger.info(f"  [{i+1}/{len(todo)}] {sid} → {mid}")

        # 4a. Copy root doc
        v1_root = cast("DocumentSnapshot", db.collection(MOVIE_PERFORMANCE).document(sid).get())
        if v1_root.exists:
            v1_data = v1_root.to_dict()
            # Remove schedule-specific fields, keep metadata
            if v1_data:
                v2_root_data = {k: v for k, v in v1_data.items() if k != "movie_id"}
                db.collection(MOVIE_PERFORMANCE_V2).document(mid).set(v2_root_data, merge=True)
                logger.info("    Root doc: ✅")
            else:
                logger.warning("    Root doc: ⚠️ Empty V1 doc")
        else:
            logger.warning("    Root doc: ⚠️ V1 doc doesn't exist")

        # 4b. Copy days subcollections
        days = list(db.collection(MOVIE_PERFORMANCE).document(sid).collection("days").list_documents())
        for day_ref in days:
            date_id = day_ref.id
            day_doc = cast("DocumentSnapshot", day_ref.get())
            if day_doc.exists:
                day_data = day_doc.to_dict()
                if day_data:
                    db.collection(MOVIE_PERFORMANCE_V2).document(mid).collection("days").document(date_id).set(
                        day_data, merge=True
                    )
                    logger.info(f"    Day {date_id}: ✅")
                # 4c. Copy showtimes
                showtimes = list(day_ref.collection("showtimes").list_documents())
                for st_ref in showtimes:
                    st_doc = cast("DocumentSnapshot", st_ref.get())
                    if st_doc.exists:
                        st_data = st_doc.to_dict()
                        if st_data:
                            db.collection(MOVIE_PERFORMANCE_V2).document(mid).collection("days").document(
                                date_id
                            ).collection("showtimes").document(st_ref.id).set(st_data, merge=True)
                logger.info(f"    Day {date_id}: {len(showtimes)} showtimes ✅")
            time.sleep(DELAY_BETWEEN_DOCS)

        # Save progress
        completed_sids.add(sid)
        PROGRESS_FILE.write_text(json.dumps({
            "completed": sorted(completed_sids),
            "total": len(gap["gap_docs"]),
            "last_updated": datetime.utcnow().isoformat(),
        }, indent=2))

    logger.info("")
    logger.info("=" * 60)
    logger.info(f"✅ BACKFILL COMPLETE: {len(completed_sids)} docs processed")
    logger.info("=" * 60)


# ─── Main ────────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(description="V1 → V2 Backfill")
    parser.add_argument("--analyze", action="store_true", help="Step 1: Analyze gap (read-only)")
    parser.add_argument("--build-mapping", action="store_true", help="Step 2: Build ID mapping (read-only)")
    parser.add_argument("--dry-run", action="store_true", help="Step 3: Show what would be written (read-only)")
    parser.add_argument("--execute", action="store_true", help="Step 4: Execute backfill (writes to V2)")
    parser.add_argument("--resume", action="store_true", help="Resume from checkpoint")
    args = parser.parse_args()

    count = sum([args.analyze, args.build_mapping, args.dry_run, args.execute])
    if count != 1:
        parser.print_help()
        sys.exit(1)

    if args.analyze:
        db = get_firestore_client()
        cmd_analyze(db)
    elif args.build_mapping:
        db = get_firestore_client()
        cmd_build_mapping(db)
    elif args.dry_run:
        cmd_dry_run()
    elif args.execute:
        db = get_firestore_client()
        cmd_execute(db, resume=args.resume)


if __name__ == "__main__":
    main()
