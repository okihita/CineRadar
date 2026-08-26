"""CineRadar — Hashtag Discovery Engine (Gen 2 Cloud Function).

HTTP-triggered Cloud Function that runs daily at 08:00 WIB:
1. Loads Apify API token from Firestore `auth_tokens/socials`. FAILS LOUDLY (500) if missing.
2. Loads active 'ON' truth seed accounts from Firestore `tiktok_sources/config`. FAILS LOUDLY (400) if none active.
3. Queries today's active theatrical slate from Firestore `schedules_v2/{target_date}/movies`. FAILS LOUDLY (404) if empty.
4. Executes live Apify TikTok Profile Scraper across all active seed accounts. FAILS LOUDLY (502) if Apify API fails.
5. Matches and resolves authentic campaign hashtags from live seed posts and manual overrides only.
   - NO auto-seed generation.
   - NO silent mock fallback.
   - If a movie has no live posts or overrides, discovered_hashtags remains EMPTY [].
6. Persists the discovery snapshot to Firestore `tiktok_hashtag_discovery/{target_date}`.
7. Sends instant Telegram alerts for both successful completion and failure.

Triggered by Cloud Scheduler daily at 08:00 WIB (`0 8 * * *` WIB).
"""

from __future__ import annotations

import datetime
import json
import logging
import os
import re
from typing import Any
from zoneinfo import ZoneInfo

import functions_framework
import httpx
from google.cloud import firestore

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

PROJECT_ID: str = os.environ.get("GOOGLE_CLOUD_PROJECT", "cineradar-481014")
WIB = ZoneInfo("Asia/Jakarta")
GENERIC_TAGS: frozenset[str] = frozenset({"fyp", "foryou", "viral", "bioskop", "cinema"})


# ─── 1. Firestore & Infrastructure Clients (Single Responsibility) ───


def get_firestore_client() -> firestore.Client:
    return firestore.Client(project=PROJECT_ID)


def json_response(data: dict[str, Any], status: int) -> tuple[str, int, dict[str, str]]:
    """DRY JSON HTTP Response Helper."""
    return json.dumps(data), status, {"Content-Type": "application/json"}


def send_telegram_alert(db: firestore.Client, message: str) -> None:
    """Sends a markdown notification to Telegram if credentials exist in Firestore."""
    try:
        doc = db.collection("auth_tokens").document("socials").get()
        if not doc.exists:
            return
        data = doc.to_dict() or {}
        bot_token, chat_id = data.get("telegram_bot_token"), data.get("telegram_chat_id")
        if not bot_token or not chat_id:
            return

        url = f"https://api.telegram.org/bot{bot_token}/sendMessage"
        with httpx.Client(timeout=10.0) as client:
            client.post(
                url, json={"chat_id": str(chat_id), "text": message, "parse_mode": "Markdown"}
            )
    except Exception as e:
        logger.warning("Failed to send Telegram alert: %s", e)


def get_apify_token(db: firestore.Client) -> str:
    """Fetches Apify API token from Firestore auth_tokens/socials or env. Fails loudly."""
    token = ""
    try:
        doc = db.collection("auth_tokens").document("socials").get()
        if doc.exists:
            token = str((doc.to_dict() or {}).get("apify_api_token", "")).strip()
    except Exception as e:
        logger.error("Failed to read auth_tokens/socials from Firestore: %s", e)

    token = token or os.environ.get("APIFY_API_TOKEN", "").strip()
    if not token:
        raise ValueError("Apify API token is not configured in Firestore 'auth_tokens/socials'.")
    return token


# ─── 2. Data Access Layer (KISS & DRY) ───


def normalize_title(title: str) -> str:
    return "".join(re.sub(r"[^\w\s]", "", title.lower()).split())


def get_active_theatrical_movies(db: firestore.Client, target_date: str) -> list[dict[str, Any]]:
    docs = db.collection("schedules_v2").document(target_date).collection("movies").stream()
    movies = [data for doc in docs if (data := doc.to_dict()) and "title" in data]
    logger.info("Fetched %d active movies from schedules_v2/%s/movies", len(movies), target_date)
    return movies


def load_sources_config(db: firestore.Client) -> dict[str, Any]:
    doc = db.collection("tiktok_sources").document("config").get()
    return (
        doc.to_dict() or {"sources": [], "overrides": {}}
        if doc.exists
        else {"sources": [], "overrides": {}}
    )


# ─── 3. External Scraping & Resolution (SOLID / Pure Logic) ───


def scrape_seed_account_posts(apify_token: str, handles: list[str]) -> list[dict[str, Any]]:
    """Scrapes latest posts from active seed accounts via Apify Clockworks Actor."""
    if not handles:
        raise ValueError(
            "No active 'ON' seed accounts configured in Firestore 'tiktok_sources/config'."
        )

    profiles = [
        f"https://www.tiktok.com/@{h.replace('@', '').strip()}" for h in handles if h.strip()
    ]
    logger.info("Triggering live Apify TikTok profile scrape for %d accounts", len(profiles))

    actor_id = "clockworks~tiktok-profile-scraper"
    url = f"https://api.apify.com/v2/acts/{actor_id}/run-sync-get-dataset-items?token={apify_token}"
    payload = {
        "profiles": profiles,
        "resultsPerPage": 5,
        "shouldDownloadVideos": False,
        "shouldDownloadCovers": False,
    }

    try:
        with httpx.Client(timeout=60.0) as client:
            res = client.post(url, json=payload)
            if res.status_code not in (200, 201):
                raise RuntimeError(
                    f"Apify Actor failed with HTTP {res.status_code}: {res.text[:200]}"
                )
            items = res.json()
            if not isinstance(items, list):
                raise RuntimeError(f"Unexpected Apify response structure: {type(items).__name__}")
            logger.info("Fetched %d recent posts from live Apify seed profiles", len(items))
            return items
    except httpx.RequestError as e:
        raise RuntimeError(f"Network error connecting to Apify API: {e}") from e


def extract_tags_from_post(post: dict[str, Any]) -> set[str]:
    """Extracts clean non-generic hashtags from a single TikTok post."""
    tags: set[str] = set()
    for t in post.get("hashtags") or []:
        t_raw = t.get("name") if isinstance(t, dict) else t
        if t_raw is not None:
            clean_t = str(t_raw).replace("#", "").strip().lower()
            if clean_t and clean_t not in GENERIC_TAGS:
                tags.add(clean_t)
    return tags


def resolve_hashtags_for_slate(
    active_movies: list[dict[str, Any]],
    sources_config: dict[str, Any],
    scraped_posts: list[dict[str, Any]],
) -> dict[str, dict[str, Any]]:
    """Resolves hashtags strictly from manual overrides and live posts. Zero mock fallback."""
    overrides: dict[str, list[str]] = sources_config.get("overrides", {}) or {}
    discovered_slate: dict[str, dict[str, Any]] = {}

    for movie in active_movies:
        title = movie.get("title", "").strip().upper()
        norm_title = normalize_title(title)
        found_tags: set[str] = set()
        sources: set[str] = set()

        # 1. Custom Overrides (Highest priority)
        if title in overrides:
            for tag in overrides[title]:
                if clean_tag := tag.replace("#", "").strip().lower():
                    found_tags.add(clean_tag)
            sources.add("manual_override")

        # 2. Match live scraped posts
        for post in scraped_posts:
            caption = (post.get("text") or post.get("caption") or "").lower()
            author = post.get("authorMeta", {}).get("name") or post.get("source_handle") or ""

            if title.lower() in caption or norm_title in caption:
                found_tags.update(extract_tags_from_post(post))
                if author and isinstance(author, str):
                    sources.add(f"@{author.replace('@', '')}")

        discovered_slate[title] = {
            "movie_id": movie.get("movie_id", norm_title),
            "title": title,
            "age_category": movie.get("age_category", "SU"),
            "discovered_hashtags": sorted(found_tags),
            "contributing_sources": sorted(sources),
            "verified": len(found_tags) > 0,
        }

    return discovered_slate


# ─── 4. Cloud Function Entrypoint (Controller) ───


@functions_framework.http
def discover_hashtags_http(request: Any) -> tuple[str, int, dict[str, str]]:
    """HTTP Cloud Function entrypoint. Fails loudly and alerts Telegram."""
    now_wib = datetime.datetime.now(WIB)
    target_date = now_wib.strftime("%Y-%m-%d")

    if request.is_json and (req_json := request.get_json(silent=True)):
        target_date = req_json.get("date", target_date)

    logger.info("Starting Morning Hashtag Discovery for target date: %s", target_date)
    db = get_firestore_client()

    try:
        # Step 1 & 2: Token & Active Seed Accounts validation
        apify_token = get_apify_token(db)
        sources_config = load_sources_config(db)
        active_handles = [
            s.get("handle")
            for s in sources_config.get("sources", [])
            if s.get("active", True) and s.get("handle")
        ]
        if not active_handles:
            raise ValueError(
                "No active 'ON' seed accounts found in Firestore 'tiktok_sources/config'."
            )

        # Step 3: Active Theatrical Movies validation
        active_movies = get_active_theatrical_movies(db, target_date)
        if not active_movies:
            error_msg = f"No active theatrical movies found in schedules_v2/{target_date}/movies."
            send_telegram_alert(
                db,
                f"🚨 *CineRadar TikTok Discovery Failed*\n📅 Date: `{target_date}`\n❌ Error: {error_msg}",
            )
            return json_response({"success": False, "error": error_msg}, 404)

        # Step 4 & 5: Live Apify Scraping & Authentic Resolution
        scraped_posts = scrape_seed_account_posts(apify_token, active_handles)
        discovered_slate = resolve_hashtags_for_slate(active_movies, sources_config, scraped_posts)
        resolved_count = sum(1 for m in discovered_slate.values() if m["discovered_hashtags"])

        # Step 6: Persist Daily Snapshot
        db.collection("tiktok_hashtag_discovery").document(target_date).set(
            {
                "date": target_date,
                "discovered_at": now_wib.isoformat(),
                "total_theatrical_titles": len(active_movies),
                "resolved_count": resolved_count,
                "live_posts_scanned": len(scraped_posts),
                "active_seeds_count": len(active_handles),
                "movies": discovered_slate,
            }
        )

        # Step 7: Rich Telegram Success Alert
        send_telegram_alert(
            db,
            f"🍿 *CineRadar TikTok Discovery Complete*\n\n"
            f"📅 *Date*: `{target_date}`\n"
            f"🎬 *Theatrical Slate*: `{len(active_movies)} movies`\n"
            f"🏷️ *Verified Campaigns*: `{resolved_count}/{len(active_movies)} titles`\n"
            f"📡 *Live Posts Scanned*: `{len(scraped_posts)}` from `{len(active_handles)} seeds`\n"
            f"⏱ *Executed at*: `{now_wib.strftime('%H:%M:%S')} WIB`",
        )

        return json_response(
            {
                "success": True,
                "date": target_date,
                "total_titles": len(active_movies),
                "resolved_count": resolved_count,
                "live_posts_scanned": len(scraped_posts),
                "active_seeds_count": len(active_handles),
                "discovered_at": now_wib.isoformat(),
            },
            200,
        )

    except ValueError as ve:
        logger.error("Configuration error: %s", ve)
        send_telegram_alert(
            db,
            f"🚨 *CineRadar TikTok Discovery [CONFIG ERROR]*\n📅 Date: `{target_date}`\n❌ Error: `{ve}`",
        )
        return json_response({"success": False, "error": str(ve)}, 400)
    except RuntimeError as re:
        logger.error("Apify execution error: %s", re)
        send_telegram_alert(
            db,
            f"🚨 *CineRadar TikTok Discovery [APIFY ERROR]*\n📅 Date: `{target_date}`\n❌ Error: `{re}`",
        )
        return json_response({"success": False, "error": str(re)}, 502)
    except Exception as e:
        logger.exception("Unexpected discovery failure: %s", e)
        send_telegram_alert(
            db,
            f"🚨 *CineRadar TikTok Discovery [CRITICAL ERROR]*\n📅 Date: `{target_date}`\n❌ Error: `{e}`",
        )
        return json_response({"success": False, "error": f"Internal server error: {e}"}, 500)
