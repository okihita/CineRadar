# /// script
# requires-python = ">=3.11"
# dependencies = [
#   "google-cloud-firestore>=2.16",
#   "requests>=2.31",
#   "python-dotenv>=1.0",
# ]
# ///

"""
CinePoint Box Office Backfill — 10/10 edition.

Scrapes daily box office data from CinePoint's top-box-office/daily/detail API
and writes to Firestore with structural validation, content hashing, gap detection,
and rich progress observability.

Scrapes BACKWARD (newest → oldest) so the most relevant data is captured first.

Usage (via uv — zero setup):
    uv run scripts/cinepoint_backfill.py --from 2024-01-01
    uv run scripts/cinepoint_backfill.py --from 2024-01-01 --to 2026-05-06
    uv run scripts/cinepoint_backfill.py --dry-run --from 2026-05-01
    uv run scripts/cinepoint_backfill.py --resume

Resume algorithm:
    Dates are scraped backward: today → --from.
    After each date, 'last_scraped_date' is saved as checkpoint.
    On --resume: re-scrapes last_scraped_date (for partial-day safety),
    then continues backward to date_start.

Env vars (from studio/.env.local):
    FIREBASE_PROJECT_ID
    FIREBASE_CLIENT_EMAIL
    FIREBASE_PRIVATE_KEY

Firestore collections written:
    cinepoint_box_office   — {date}_{movieId}  (raw daily per-movie data)
    cinepoint_bo_sync_meta — current           (checkpoint, 1 doc)
    cinepoint_movies       — {movieId}         (catalog, updated as side effect)
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import sys
import time
import uuid
from dataclasses import asdict, dataclass
from datetime import UTC, date, datetime, timedelta
from pathlib import Path
from typing import Any

import requests
from google.cloud import firestore_v1 as firestore
from google.oauth2 import service_account

# ─── Constants ──────────────────────────────────────────────

CINEPOINT_URL = (
    "https://cinepoint.com/bff/v1/movies/top-box-office/daily/detail"
    "?date_start={date}&date_end={date}"
    "&type=all&limit=100&order=desc&sort=admission&page={page}"
)

COLLECTION_BOX_OFFICE = "cinepoint_box_office"
COLLECTION_SYNC_META = "cinepoint_bo_sync_meta"
COLLECTION_CATALOG = "cinepoint_movies"

DELAY_SECONDS = 5
RETRY_DELAY_SECONDS = 10
RATE_LIMIT_BACKOFF_SECONDS = 30
MAX_RETRIES = 3
REQUEST_TIMEOUT_SECONDS = 15
BATCH_MAX_WRITES = 500  # Firestore limit per commit

PROGRESS_INTERVAL = 10  # print summary every N dates (lower for verbosity)

REQUIRED_FIELDS = {"id", "title", "admission", "total_admission", "rank"}

ENV_FILE = Path(__file__).resolve().parent.parent / ".env.local"


# ─── Data classes ───────────────────────────────────────────


@dataclass
class ScrapeResult:
    """One day's worth of scrape output."""

    date: str
    movies: list[dict[str, Any]]
    scraped_at: str
    elapsed_ms: float = 0
    http_status: int = 0
    error: str | None = None


@dataclass
class SyncMeta:
    """Checkpoint stored in Firestore for resume capability."""

    status: str = "idle"
    direction: str = "backward"  # always backward now
    date_start: str = ""         # oldest date (--from)
    date_end: str = ""           # newest date (--to, default today)
    last_scraped_date: str | None = None  # checkpoint
    dates_scraped: int = 0
    dates_skipped: int = 0
    docs_written: int = 0
    docs_skipped_hash: int = 0
    docs_rejected: int = 0
    started_at: str | None = None
    completed_at: str | None = None
    error_message: str | None = None
    batch_id: str = ""

    @classmethod
    def from_firestore(cls, data: dict[str, Any]) -> SyncMeta:
        return cls(
            status=data.get("status", "idle"),
            direction=data.get("direction", "backward"),
            date_start=data.get("date_start", ""),
            date_end=data.get("date_end", ""),
            last_scraped_date=data.get("last_scraped_date"),
            dates_scraped=data.get("dates_scraped", 0),
            dates_skipped=data.get("dates_skipped", 0),
            docs_written=data.get("docs_written", 0),
            docs_skipped_hash=data.get("docs_skipped_hash", 0),
            docs_rejected=data.get("docs_rejected", 0),
            started_at=data.get("started_at"),
            completed_at=data.get("completed_at"),
            error_message=data.get("error_message"),
            batch_id=data.get("batch_id", ""),
        )


# ─── Helpers ────────────────────────────────────────────────


def load_env(dotenv_path: Path) -> None:
    """Load .env.local into os.environ (minimal parser, no external dep needed)."""
    if not dotenv_path.exists():
        return
    with open(dotenv_path) as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            if "=" not in line:
                continue
            key, _, value = line.partition("=")
            key = key.strip()
            value = value.strip()
            if value and value[0] in {'"', "'"} and value[-1] == value[0]:
                value = value[1:-1]
            os.environ.setdefault(key, value)


def firestore_client() -> firestore.Client:
    """Create a Firestore client from environment variables."""
    project_id = os.environ.get("FIREBASE_PROJECT_ID", "").strip()
    client_email = os.environ.get("FIREBASE_CLIENT_EMAIL", "").strip()
    private_key = os.environ.get("FIREBASE_PRIVATE_KEY", "").strip().replace("\\n", "\n")

    if not all([project_id, client_email, private_key]):
        print("❌ Missing Firebase credentials. Need FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY")
        sys.exit(1)

    creds = service_account.Credentials.from_service_account_info(
        {
            "type": "service_account",
            "project_id": project_id,
            "private_key_id": "backfill-script",
            "private_key": private_key,
            "client_email": client_email,
            "client_id": "0",
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": "https://oauth2.googleapis.com/token",
        },
        scopes=["https://www.googleapis.com/auth/datastore"],
    )
    return firestore.Client(project=project_id, credentials=creds)


def content_hash(movie: dict[str, Any], date_str: str) -> str:
    """Deterministic hash of the payload fields for idempotent skip."""
    payload = {
        "date": date_str,
        "movie_id": movie["id"],
        "title": movie.get("title", ""),
        "admission": movie.get("admission"),
        "total_admission": movie.get("total_admission"),
        "change": movie.get("change"),
        "showtimes": movie.get("showtimes"),
        "score": movie.get("score"),
        "current_rank": movie.get("rank", {}).get("current_rank"),
        "last_rank": movie.get("rank", {}).get("last_rank"),
    }
    raw = json.dumps(payload, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(raw.encode()).hexdigest()[:16]


def validate_movie(movie: dict[str, Any]) -> list[str]:
    """Return list of validation errors (empty = valid)."""
    errors: list[str] = []
    for f in REQUIRED_FIELDS:
        if f == "rank":
            rank = movie.get("rank")
            if not isinstance(rank, dict) or "current_rank" not in rank:
                errors.append("missing/invalid rank")
        elif f not in movie or movie[f] is None:
            errors.append(f"missing {f}")
    for num_field in ("admission", "total_admission", "showtimes", "score"):
        val = movie.get(num_field)
        if val is not None and not isinstance(val, (int, float)):
            errors.append(f"{num_field} is not numeric: {type(val).__name__}")
    return errors


def build_doc(date_str: str, movie: dict[str, Any], scraped_at: str, batch_id: str, hash_val: str) -> dict[str, Any]:
    """Build a Firestore document from raw API movie data."""
    rank = movie.get("rank", {})
    return {
        "date": date_str,
        "movie_id": movie["id"],
        "title": movie.get("title", ""),
        "image_title": movie.get("image_title"),
        "movie_genre": movie.get("movie_genre", []),
        "duration": movie.get("duration", 0),
        "release_date": movie.get("release_date", ""),
        "type": movie.get("type", "international"),
        "admission": movie.get("admission", 0),
        "total_admission": movie.get("total_admission", 0),
        "change": movie.get("change", 0),
        "showtimes": movie.get("showtimes", 0),
        "score": movie.get("score", 0),
        "current_rank": rank.get("current_rank", 0),
        "last_rank": rank.get("last_rank", None),
        "scraped_at": scraped_at,
        "batch_id": batch_id,
        "_hash": hash_val,
    }


def fetch_day(date_str: str) -> ScrapeResult:
    """Fetch one day of box office data from CinePoint."""
    all_movies: list[dict[str, Any]] = []
    page = 0
    retries = 0
    last_status = 0
    t0 = time.time()

    while retries < MAX_RETRIES:
        url = CINEPOINT_URL.format(date=date_str, page=page)
        try:
            print(f"    → GET {date_str} (page {page})...", end=" ", flush=True)
            resp = requests.get(
                url,
                headers={
                    "accept": "application/json",
                    "content-type": "application/json",
                    "x-app-request": "true",
                    "referer": "https://cinepoint.com/",
                    "user-agent": "CineRadar-Backfill/1.0",
                },
                timeout=REQUEST_TIMEOUT_SECONDS,
            )
            last_status = resp.status_code

            if resp.status_code == 429:
                print("HTTP 429 ⏳")
                print(f"    ⏳ Rate limited! Backing off {RATE_LIMIT_BACKOFF_SECONDS}s...")
                time.sleep(RATE_LIMIT_BACKOFF_SECONDS)
                retries += 1
                continue

            resp.raise_for_status()
            data = resp.json()

            movies = data.get("response_output", {}).get("list", {}).get("content", [])
            pagination = data.get("response_output", {}).get("list", {}).get("pagination", {})
            total = pagination.get("total", 0)

            all_movies.extend(movies)
            elapsed_ms = (time.time() - t0) * 1000
            print(f"HTTP {resp.status_code} — {len(movies)} movies ({elapsed_ms:.0f}ms)")

            # Pagination: if we got all movies, stop
            if len(all_movies) >= total:
                break
            page += 1

        except requests.RequestException as e:
            elapsed_ms = (time.time() - t0) * 1000
            print(f"FAILED ({elapsed_ms:.0f}ms)")
            retries += 1
            print(f"    ❌ Error: {e} (retry {retries}/{MAX_RETRIES})")
            if retries < MAX_RETRIES:
                time.sleep(RETRY_DELAY_SECONDS)
            else:
                return ScrapeResult(
                    date=date_str,
                    movies=[],
                    scraped_at=datetime.now(UTC).isoformat(),
                    elapsed_ms=elapsed_ms,
                    http_status=last_status,
                    error=str(e),
                )

    elapsed_ms = (time.time() - t0) * 1000
    return ScrapeResult(
        date=date_str,
        movies=all_movies,
        scraped_at=datetime.now(UTC).isoformat(),
        elapsed_ms=elapsed_ms,
        http_status=last_status,
    )


def write_batch(
    db: firestore.Client,
    date_str: str,
    movies: list[dict[str, Any]],
    scraped_at: str,
    batch_id: str,
    skip_unchanged: bool = True,
) -> tuple[int, int, int]:
    """Write movies to Firestore using batch commits.

    Returns (written, skipped_hash, rejected).
    """
    col = db.collection(COLLECTION_BOX_OFFICE)
    written = 0
    skipped_hash = 0
    rejected = 0

    write_ops: list[tuple[Any, dict[str, Any]]] = []

    for movie in movies:
        errors = validate_movie(movie)
        if errors:
            print(f"    ⚠️ Rejected movie {movie.get('id', '?')} {movie.get('title', '?')}: {', '.join(errors)}")
            rejected += 1
            continue

        hash_val = content_hash(movie, date_str)
        doc_id = f"{date_str}_{movie['id']}"
        doc_ref = col.document(doc_id)

        if skip_unchanged:
            try:
                existing = doc_ref.get(["_hash"])
                if existing.exists and existing.to_dict().get("_hash") == hash_val:
                    skipped_hash += 1
                    continue
            except Exception:
                pass

        doc_data = build_doc(date_str, movie, scraped_at, batch_id, hash_val)
        write_ops.append((doc_ref, doc_data))

    # Commit in batches of BATCH_MAX_WRITES
    for i in range(0, len(write_ops), BATCH_MAX_WRITES):
        chunk = write_ops[i : i + BATCH_MAX_WRITES]
        batch = db.batch()
        for doc_ref, doc_data in chunk:
            batch.set(doc_ref, doc_data, merge=True)
        t0 = time.time()
        batch.commit()
        commit_ms = (time.time() - t0) * 1000
        print(f"    ✓ Firestore commit: {len(chunk)} docs ({commit_ms:.0f}ms)")
        written += len(chunk)

    return written, skipped_hash, rejected


def update_catalog(
    db: firestore.Client,
    movies: list[dict[str, Any]],
    date_str: str,
    scraped_at: str,
) -> int:
    """Upsert movie stubs into cinepoint_movies catalog. Returns count updated."""
    col = db.collection(COLLECTION_CATALOG)
    updated = 0
    batch = db.batch()

    for i, movie in enumerate(movies):
        doc_ref = col.document(str(movie["id"]))
        cache_data = {
            "id": movie["id"],
            "title": movie.get("title", ""),
            "image_title": movie.get("image_title"),
            "movie_genre": movie.get("movie_genre", []),
            "duration": movie.get("duration", 0),
            "release_date": movie.get("release_date", ""),
            "type": movie.get("type", "international"),
            "latest_admission": movie.get("admission", 0),
            "latest_total_admission": movie.get("total_admission", 0),
            "latest_showtimes": movie.get("showtimes", 0),
            "latest_score": movie.get("score", 0),
            "latest_rank": movie.get("rank", {}).get("current_rank"),
            "latest_boxoffice_date": date_str,
            "scraped_at": scraped_at,
        }
        batch.set(doc_ref, cache_data, merge=True)

        if (i + 1) % BATCH_MAX_WRITES == 0:
            batch.commit()
            updated += BATCH_MAX_WRITES
            batch = db.batch()

    remaining = len(movies) % BATCH_MAX_WRITES
    if remaining:
        batch.commit()
        updated += remaining

    return updated


def save_sync_meta(db: firestore.Client, meta: SyncMeta) -> None:
    """Persist sync checkpoint to Firestore."""
    doc_ref = db.collection(COLLECTION_SYNC_META).document("current")
    doc_ref.set(asdict(meta))


def load_sync_meta(db: firestore.Client) -> SyncMeta:
    """Load sync checkpoint from Firestore."""
    doc_ref = db.collection(COLLECTION_SYNC_META).document("current")
    snap = doc_ref.get()
    if snap.exists:
        return SyncMeta.from_firestore(snap.to_dict())
    return SyncMeta()


def generate_dates_backward(from_date: date, to_date: date) -> list[date]:
    """Generate date list from to_date BACKWARD to from_date (newest first)."""
    dates = []
    current = to_date
    while current >= from_date:
        dates.append(current)
        current -= timedelta(days=1)
    return dates


def detect_gaps(scraped_dates: set[str], all_dates: list[str]) -> list[str]:
    """Detect suspicious gaps: a date with 0 movies sandwiched between dates with many."""
    gaps = []
    for i, d in enumerate(all_dates):
        if d not in scraped_dates:
            prev_ok = i > 0 and all_dates[i - 1] in scraped_dates
            next_ok = i < len(all_dates) - 1 and all_dates[i + 1] in scraped_dates
            if prev_ok and next_ok:
                gaps.append(d)
    return gaps


def format_elapsed(seconds: float) -> str:
    if seconds < 60:
        return f"{seconds:.0f}s"
    minutes = seconds / 60
    if minutes < 60:
        return f"{minutes:.1f}min"
    hours = seconds / 3600
    return f"{hours:.1f}h"


def print_summary(
    meta: SyncMeta,
    all_date_strs: list[str],
    sample_doc_ids: list[str],
    elapsed: float,
    dry_run: bool,
) -> None:
    """Print final summary for Firestore verification."""
    print("\n" + "=" * 64)
    label = "DRY RUN COMPLETE" if dry_run else "BACKFILL COMPLETE"
    print(f"📊 {label}")
    print("=" * 64)
    print(f"  Batch ID:        {meta.batch_id}")
    print("  Direction:       backward (newest → oldest)")
    print(f"  Date range:      {meta.date_start} → {meta.date_end}")
    print(f"  Dates scraped:   {meta.dates_scraped}")
    print(f"  Dates skipped:   {meta.dates_skipped}")
    print(f"  Docs written:    {meta.docs_written}")
    print(f"  Docs unchanged:  {meta.docs_skipped_hash}")
    print(f"  Docs rejected:   {meta.docs_rejected}")
    print(f"  Elapsed:         {format_elapsed(elapsed)}")
    if sample_doc_ids:
        print("\n  Sample doc IDs (verify in Firestore console):")
        for sid in sample_doc_ids[:10]:
            print(f"    • {sid}")
    if not dry_run:
        print("\n  Firestore verification:")
        print(f"    Collection: {COLLECTION_BOX_OFFICE}")
        print(f"    Filter: date == '{meta.date_end}' (newest date)")
        print("    Expected: ~10-50 docs")
        print("\n  Resume: uv run scripts/cinepoint_backfill.py --resume")
    print("=" * 64 + "\n")


# ─── Main ───────────────────────────────────────────────────


def main() -> None:
    parser = argparse.ArgumentParser(
        description="CinePoint Box Office Backfill (scrapes backward: newest → oldest)",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Resume algorithm:
  Dates are scraped BACKWARD (--to → --from).
  After each date, checkpoint is saved.
  On --resume: re-scrapes checkpoint date, then continues backward.
  Re-runs are FREE — content hashing skips unchanged docs.

Examples:
  uv run scripts/cinepoint_backfill.py --from 2024-01-01
  uv run scripts/cinepoint_backfill.py --from 2024-01-01 --to 2026-05-06
  uv run scripts/cinepoint_backfill.py --resume
  uv run scripts/cinepoint_backfill.py --dry-run --from 2026-05-01
        """,
    )
    parser.add_argument("--from", dest="from_date", help="Oldest date to scrape back to (YYYY-MM-DD)", default=None)
    parser.add_argument("--to", dest="to_date", help="Newest date to start from (default: today)", default=None)
    parser.add_argument("--delay", type=float, default=DELAY_SECONDS, help=f"Delay between requests in seconds (default: {DELAY_SECONDS})")
    parser.add_argument("--resume", action="store_true", help="Resume from last checkpoint")
    parser.add_argument("--dry-run", action="store_true", help="Fetch and validate but don't write to Firestore")
    parser.add_argument("--no-skip-hash", action="store_true", help="Force overwrite even if content unchanged")
    args = parser.parse_args()

    # Load env
    load_env(ENV_FILE)

    today = date.today()

    # ── Resolve date range ──
    if not args.resume and not args.from_date:
        print("❌ --from date is required (or use --resume)")
        sys.exit(1)

    from_date = date.fromisoformat(args.from_date) if args.from_date else None
    to_date = date.fromisoformat(args.to_date) if args.to_date else today

    if from_date and to_date and from_date > to_date:
        print(f"❌ --from ({from_date}) is after --to ({to_date})")
        sys.exit(1)

    # ── Connect to Firestore ──
    print("\n🔥 CinePoint Box Office Backfill")
    print("   Connecting to Firestore...", flush=True)
    db = firestore_client()
    print("   ✓ Connected\n   Loading checkpoint...", flush=True)

    # ── Load checkpoint ──
    meta = load_sync_meta(db)

    if args.resume:
        if not meta.last_scraped_date and not args.from_date:
            print("❌ No checkpoint found. Provide --from date.")
            sys.exit(1)

        # Resume: re-scrape checkpoint date, continue backward to date_start
        if meta.last_scraped_date:
            checkpoint = date.fromisoformat(meta.last_scraped_date)
            to_date = checkpoint  # re-scrape this date
            print(f"   📌 Checkpoint found: {meta.last_scraped_date}")
        else:
            to_date = date.fromisoformat(args.from_date)
            print(f"   📌 No checkpoint, starting fresh from {args.from_date}")

        if args.from_date:
            from_date = date.fromisoformat(args.from_date)
        elif meta.date_start:
            from_date = date.fromisoformat(meta.date_start)
        else:
            print("❌ No start date found. Provide --from.")
            sys.exit(1)

        # If user provides --to, override
        if args.to_date:
            to_date = date.fromisoformat(args.to_date)

        print(f"   📌 Resuming: re-scraping {to_date} backward to {from_date}")
    else:
        assert from_date is not None
        assert to_date is not None

    assert from_date is not None
    assert to_date is not None

    # ── Generate date list (backward) ──
    dates = generate_dates_backward(from_date, to_date)
    total_days = len(dates)

    print("   Direction:      backward (newest → oldest)")
    print(f"   Date range:     {to_date} → {from_date} ({total_days} days)")
    print(f"   Delay:          {args.delay}s between requests")
    if args.dry_run:
        print("   🔎 DRY RUN — no data will be written")
    print(flush=True)

    # ── Initialize meta ──
    batch_id = meta.batch_id or str(uuid.uuid4())[:8]
    if not args.resume:
        meta = SyncMeta(
            status="running",
            direction="backward",
            date_start=str(from_date),
            date_end=str(to_date),
            batch_id=batch_id,
            started_at=datetime.now(UTC).isoformat(),
        )
    else:
        meta.status = "running"
        # Keep original date_start, update date_end if range changed
        meta.date_end = str(to_date)

    if not args.dry_run:
        save_sync_meta(db, meta)

    # ── Main loop ──
    start_time = time.time()
    sample_doc_ids: list[str] = []
    scraped_dates: set[str] = set()

    try:
        for i, d in enumerate(dates):
            date_str = str(d)
            day_t0 = time.time()

            print(f"\n  [{i+1}/{total_days}] ── {date_str} ──", flush=True)

            # Fetch from CinePoint
            result = fetch_day(date_str)

            if result.error:
                print(f"    ❌ FAILED after {MAX_RETRIES} retries: {result.error}")
                meta.dates_skipped += 1
                if not args.dry_run:
                    save_sync_meta(db, meta)
                # Still delay before next date
                if i < total_days - 1:
                    print(f"    ⏳ Waiting {args.delay}s...", flush=True)
                    time.sleep(args.delay)
                continue

            total_adm = sum(m.get("admission", 0) for m in result.movies)
            num_movies = len(result.movies)
            day_elapsed = time.time() - day_t0

            if num_movies == 0:
                print(f"    ⬜ Empty day — 0 movies returned ({day_elapsed:.1f}s)")
                meta.dates_skipped += 1

            elif args.dry_run:
                print(f"    🔎 {num_movies} movies, {total_adm:,} admissions ({day_elapsed:.1f}s)")
                # Show top 3
                for m in result.movies[:3]:
                    rank = m.get("rank", {}).get("current_rank", "?")
                    adm = m.get("admission", 0)
                    print(f"       #{rank} {m.get('title', '?')}: {adm:,} adm")
                meta.dates_scraped += 1
                meta.docs_written += num_movies

            else:
                # Write to Firestore
                skip_unchanged = not args.no_skip_hash
                written, skipped, rejected = write_batch(
                    db, date_str, result.movies, result.scraped_at, batch_id, skip_unchanged
                )

                meta.dates_scraped += 1
                meta.docs_written += written
                meta.docs_skipped_hash += skipped
                meta.docs_rejected += rejected

                # Update catalog (best-effort)
                if written > 0:
                    try:
                        cat_count = update_catalog(db, result.movies, date_str, result.scraped_at)
                        print(f"    📦 Catalog updated: {cat_count} movies")
                    except Exception as e:
                        print(f"    ⚠️ Catalog update failed: {e}")

                # Save checkpoint
                meta.last_scraped_date = date_str
                save_sync_meta(db, meta)

                # Track sample doc IDs (first 3 dates with data)
                if len(sample_doc_ids) < 30:
                    for m in result.movies[:3]:
                        sample_doc_ids.append(f"{date_str}_{m['id']}")

                scraped_dates.add(date_str)

                # Show top 3
                for m in result.movies[:3]:
                    rank = m.get("rank", {}).get("current_rank", "?")
                    adm = m.get("admission", 0)
                    print(f"       #{rank} {m.get('title', '?')}: {adm:,} adm")

                icon = "✓" if rejected == 0 else "⚠️"
                print(f"    {icon} {written} written, {skipped} unchanged, {rejected} rejected ({day_elapsed:.1f}s)")

            # ── Progress summary ──
            dates_done = i + 1
            if dates_done % PROGRESS_INTERVAL == 0:
                elapsed = time.time() - start_time
                rate = dates_done / elapsed if elapsed > 0 else 0
                remaining_days = total_days - dates_done
                eta = remaining_days / rate if rate > 0 else 0
                total_docs = meta.docs_written + meta.docs_skipped_hash
                pct = dates_done / total_days * 100
                print(
                    f"\n  📊 Progress: {dates_done}/{total_days} dates ({pct:.0f}%) | "
                    f"{total_docs:,} docs processed | "
                    f"{meta.docs_written:,} written | "
                    f"{format_elapsed(elapsed)} elapsed | "
                    f"ETA: {format_elapsed(eta)}\n",
                    flush=True,
                )

            # Polite delay (skip on last date)
            if i < total_days - 1:
                print(f"    ⏳ Waiting {args.delay}s...", end="", flush=True)
                time.sleep(args.delay)
                print(" done")

    except KeyboardInterrupt:
        elapsed = time.time() - start_time
        meta.status = "paused"
        meta.error_message = "Interrupted by user (Ctrl+C)"
        if not args.dry_run:
            save_sync_meta(db, meta)
        print(f"\n\n⏸️ PAUSED at {meta.last_scraped_date}")
        print(f"   Progress: {meta.dates_scraped}/{total_days} dates, {meta.docs_written} docs, {format_elapsed(elapsed)}")
        print("   Resume:   uv run scripts/cinepoint_backfill.py --resume\n")
        sys.exit(0)

    except Exception as e:
        elapsed = time.time() - start_time
        meta.status = "error"
        meta.error_message = str(e)
        if not args.dry_run:
            save_sync_meta(db, meta)
        print(f"\n❌ Fatal error: {e}")
        print(f"   Last scraped: {meta.last_scraped_date}")
        print("   Resume: uv run scripts/cinepoint_backfill.py --resume\n")
        sys.exit(1)

    # ── Final ──
    elapsed = time.time() - start_time
    meta.status = "complete"
    meta.completed_at = datetime.now(UTC).isoformat()
    if not args.dry_run:
        save_sync_meta(db, meta)

    # Gap detection (on the forward-sorted date list)
    all_date_strs = [str(from_date + timedelta(days=i)) for i in range((to_date - from_date).days + 1)]
    gaps = detect_gaps(scraped_dates, all_date_strs)
    if gaps and not args.dry_run:
        print(f"\n  ⚠️ Potential gaps (empty days between scraped days): {gaps[:10]}")

    # Summary
    print_summary(meta, all_date_strs, sample_doc_ids, elapsed, args.dry_run)


if __name__ == "__main__":
    main()
