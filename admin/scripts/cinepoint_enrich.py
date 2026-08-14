# /// script
# requires-python = ">=3.11"
# dependencies = [
#   "google-cloud-firestore>=2.16",
#   "requests>=2.31",
#   "python-dotenv>=1.0",
# ]
# ///

"""
CinePoint Movie Details Enrichment.

Fetches rich movie details (casts, description, language, trailer, ratings)
from /movies/detail?id= and merges into existing cinepoint_movies Firestore docs.

Usage:
    uv run scripts/cinepoint_enrich.py --all
    uv run scripts/cinepoint_enrich.py --all --stale-days 999   # re-enrich everything
    uv run scripts/cinepoint_enrich.py --movie-id 3965
    uv run scripts/cinepoint_enrich.py --movie-ids 3965,3952,3894
    uv run scripts/cinepoint_enrich.py --all --limit 10
    uv run scripts/cinepoint_enrich.py --all --dry-run

Env vars (from admin/.env.local):
    FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY
    CINEPOINT_REFRESH_TOKEN

Firestore collection updated:
    cinepoint_movies/{movieId}  — enriched with detail fields + details_fetched_at
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import sys
import time
from datetime import UTC, datetime
from pathlib import Path

import requests
from dotenv import load_dotenv
from google.cloud import firestore

# ─── Config ─────────────────────────────────────────────────

API_BASE = "https://cinepoint.com/bff/v1"
COLLECTION = "cinepoint_movies"
BATCH_LOG_INTERVAL = 25  # newline checkpoint every N movies
RATE_LIMIT_COOLDOWN = 5  # seconds to sleep on 429

ENRICH_FIELDS = [
    "casts", "description", "language", "trailer_url", "rating_category",
    "user_ratings", "playing_at", "similar_movies", "movie_rating",
    "production_status", "comparison", "duration", "movie_genre", "score",
    "admission", "total_admission", "change", "showtimes", "image_title",
    "title", "release_date", "type", "id",
]


# ─── Helpers ────────────────────────────────────────────────

def refresh_access_token(refresh_token: str) -> str:
    resp = requests.post(
        f"{API_BASE}/authorization/refresh-token",
        headers={
            "accept": "application/json",
            "content-type": "application/json",
            "x-app-request": "true",
            "authorization": f"Bearer {refresh_token}",
            "referer": "https://cinepoint.com/",
        },
        json={},
        timeout=15,
    )
    resp.raise_for_status()
    return resp.json()["response_output"]["detail"]["access_token"]


def fetch_movie_detail(movie_id: int, access_token: str) -> tuple[dict | None, int]:
    """Returns (detail_dict_or_None, http_status_code)."""
    try:
        resp = requests.get(
            f"{API_BASE}/movies/detail",
            params={"id": movie_id},
            headers={
                "accept": "application/json",
                "content-type": "application/json",
                "x-app-request": "true",
                "authorization": f"Bearer {access_token}",
                "referer": "https://cinepoint.com/",
            },
            timeout=15,
        )
        if resp.status_code == 429:
            return None, 429
        if resp.status_code in (400, 404):
            return None, resp.status_code
        resp.raise_for_status()
        data = resp.json()
        if data.get("response_schema", {}).get("response_message") == "SUCCESS":
            return data["response_output"]["detail"], 200
        return None, resp.status_code
    except requests.exceptions.RequestException:
        return None, 0


def compute_hash(detail: dict) -> str:
    payload = {k: detail.get(k) for k in sorted(ENRICH_FIELDS)}
    return hashlib.sha256(json.dumps(payload, sort_keys=True, default=str).encode()).hexdigest()[:16]


def progress_line(i: int, total: int, title: str, status: str, enriched: int, skipped: int, failed: int, elapsed_s: float):
    pct = i / total * 100
    rate = i / (elapsed_s or 1)
    eta_s = (total - i) / (rate or 1)
    eta_m = int(eta_s // 60)
    eta_sec = int(eta_s % 60)
    title_short = (title[:38] + "…") if len(title) > 38 else title
    line = f"  [{i}/{total} {pct:5.1f}%] {status:12s} | {title_short:<41s} | ✅{enriched} ⏭️{skipped} ❌{failed} | ETA {eta_m}m{eta_sec:02d}s"
    sys.stdout.write(f"\r\033[K{line}")
    sys.stdout.flush()


# ─── Main ───────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="CinePoint movie details enrichment")
    parser.add_argument("--movie-id", type=int, help="Enrich a single movie")
    parser.add_argument("--movie-ids", type=str, help="Comma-separated movie IDs")
    parser.add_argument("--all", action="store_true", help="Enrich all movies missing details")
    parser.add_argument("--stale-days", type=int, default=0,
                        help="Re-enrich if details older than N days (use 999 to re-enrich all)")
    parser.add_argument("--dry-run", action="store_true", help="Preview only, no writes")
    parser.add_argument("--limit", type=int, default=0, help="Max movies to process (0=all)")
    args = parser.parse_args()

    if not any([args.movie_id, args.movie_ids, args.all]):
        parser.error("Specify --movie-id, --movie-ids, or --all")

    # ── Load env ──
    env_path = Path(__file__).resolve().parent.parent / ".env.local"
    if not env_path.exists():
        env_path = Path(__file__).resolve().parent.parent / "admin" / ".env.local"
    load_dotenv(env_path)

    refresh_token = os.environ.get("CINEPOINT_REFRESH_TOKEN")
    if not refresh_token:
        print("❌ CINEPOINT_REFRESH_TOKEN not set in environment")
        print("   Add it to admin/.env.local:")
        print('   CINEPOINT_REFRESH_TOKEN="eyJhbGci..."')
        sys.exit(1)

    # ── Init Firestore ──
    db = firestore.Client()

    # ── Determine target movies ──
    movie_ids: list[int] = []

    if args.movie_id:
        movie_ids = [args.movie_id]
    elif args.movie_ids:
        movie_ids = [int(x.strip()) for x in args.movie_ids.split(",")]
    elif args.all:
        print("📋 Scanning cinepoint_movies...")
        query = db.collection(COLLECTION).stream()
        now = datetime.now(UTC)
        for doc in query:
            d = doc.to_dict()
            doc_id = int(doc.id)

            fetched_at = d.get("details_fetched_at")
            if fetched_at and args.stale_days > 0:
                fetched_dt = datetime.fromisoformat(fetched_at.replace("Z", "+00:00"))
                if (now - fetched_dt).days < args.stale_days:
                    continue
            elif fetched_at and args.stale_days == 0:
                continue

            movie_ids.append(doc_id)
        print(f"  {len(movie_ids)} movies to enrich\n")

    if args.limit > 0:
        movie_ids = movie_ids[:args.limit]

    if not movie_ids:
        print("No movies to enrich. Everything up to date!")
        return

    # ── Auth ──
    print("🔑 Refreshing access token...")
    access_token = refresh_access_token(refresh_token)
    print("  Token valid for 24h\n")

    total = len(movie_ids)
    print(f"🎬 Enriching {total} movies (no delay, sleeps only on 429)")
    if args.dry_run:
        print("   (DRY RUN — no writes)\n")
    else:
        print()

    enriched = 0
    skipped = 0
    failed = 0
    rate_limits = 0
    t0 = time.monotonic()

    for i, mid in enumerate(movie_ids, 1):
        detail, status_code = fetch_movie_detail(mid, access_token)

        # Rate limited — sleep and retry once
        if status_code == 429:
            rate_limits += 1
            print(f"\n  ⏳ Rate limited (429) at movie {mid} — sleeping {RATE_LIMIT_COOLDOWN}s (rate_limits={rate_limits})")
            time.sleep(RATE_LIMIT_COOLDOWN)
            detail, status_code = fetch_movie_detail(mid, access_token)
            if status_code == 429:
                print(f"  ⏳ Still rate limited after cooldown — sleeping {RATE_LIMIT_COOLDOWN * 2}s")
                time.sleep(RATE_LIMIT_COOLDOWN * 2)
                detail, status_code = fetch_movie_detail(mid, access_token)

        if detail is None:
            failed += 1
            label = f"id={mid}"
            progress_line(i, total, label, f"FAILED({status_code})", enriched, skipped, failed, time.monotonic() - t0)
            if i % BATCH_LOG_INTERVAL == 0:
                print()
            continue

        title = detail.get("title", f"id={mid}")

        if not args.dry_run:
            content_hash = compute_hash(detail)
            doc_ref = db.collection(COLLECTION).document(str(mid))

            existing = doc_ref.get()
            if existing.exists and existing.to_dict().get("_detail_hash") == content_hash:
                skipped += 1
                progress_line(i, total, title, "UNCHANGED", enriched, skipped, failed, time.monotonic() - t0)
                if i % BATCH_LOG_INTERVAL == 0:
                    print()
                continue

            update = {k: detail[k] for k in ENRICH_FIELDS if k in detail}
            update["details_fetched_at"] = datetime.now(UTC).isoformat()
            update["_detail_hash"] = content_hash
            doc_ref.set(update, merge=True)
            enriched += 1
            progress_line(i, total, title, "ENRICHED", enriched, skipped, failed, time.monotonic() - t0)
        else:
            enriched += 1
            progress_line(i, total, title, "DRY-RUN", enriched, skipped, failed, time.monotonic() - t0)

        if i % BATCH_LOG_INTERVAL == 0:
            print()

    # ── Summary ──
    elapsed = time.monotonic() - t0
    mins = int(elapsed // 60)
    secs = int(elapsed % 60)
    print(f"\n\n{'='*60}")
    print(f"  Done in {mins}m {secs}s")
    print(f"  ✅ Enriched: {enriched}  ⏭️ Skipped: {skipped}  ❌ Failed: {failed}  ⏳ Rate limits: {rate_limits}")
    print(f"{'='*60}")


if __name__ == "__main__":
    main()
