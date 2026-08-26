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


def get_firestore_client() -> firestore.Client:
    return firestore.Client(project=PROJECT_ID)


def send_telegram_alert(db: firestore.Client, message: str) -> None:
    """Sends a markdown formatted notification to Telegram if configured in Firestore."""
    try:
        doc = db.collection("auth_tokens").document("socials").get()
        if not doc.exists:
            return

        data = doc.to_dict() or {}
        bot_token = data.get("telegram_bot_token")
        chat_id = data.get("telegram_chat_id")

        if not bot_token or not chat_id:
            return

        url = f"https://api.telegram.org/bot{bot_token}/sendMessage"
        payload = {
            "chat_id": str(chat_id),
            "text": message,
            "parse_mode": "Markdown",
        }
        with httpx.Client(timeout=10.0) as client:
            client.post(url, json=payload)
    except Exception as e:
        logger.warning("Failed to send Telegram alert: %s", e)


def get_apify_token(db: firestore.Client) -> str:
    """Fetches Apify API token from Firestore auth_tokens/socials or env.

    Raises ValueError if token is missing.
    """
    token = ""
    try:
        doc = db.collection("auth_tokens").document("socials").get()
        if doc.exists:
            token = str((doc.to_dict() or {}).get("apify_api_token", "")).strip()
    except Exception as e:
        logger.error("Failed to read auth_tokens/socials from Firestore: %s", e)

    if not token:
        token = os.environ.get("APIFY_API_TOKEN", "").strip()

    if not token:
        raise ValueError(
            "CRITICAL: Apify API token is not configured in Firestore 'auth_tokens/socials' or APIFY_API_TOKEN environment variable."
        )

    return token


def normalize_title(title: str) -> str:
    cleaned = re.sub(r"[^\w\s]", "", title.lower())
    return "".join(cleaned.split())


def get_active_theatrical_movies(db: firestore.Client, target_date: str) -> list[dict[str, Any]]:
    movies_ref = db.collection("schedules_v2").document(target_date).collection("movies")
    docs = movies_ref.stream()
    movies: list[dict[str, Any]] = []
    for doc in docs:
        data = doc.to_dict()
        if data and "title" in data:
            movies.append(data)
    logger.info("Fetched %d active movies from schedules_v2/%s/movies", len(movies), target_date)
    return movies


def load_sources_config(db: firestore.Client) -> dict[str, Any]:
    doc = db.collection("tiktok_sources").document("config").get()
    if doc.exists:
        data = doc.to_dict()
        if data and "sources" in data:
            return data
    return {"sources": [], "overrides": {}}


def scrape_seed_account_posts(apify_token: str, handles: list[str]) -> list[dict[str, Any]]:
    """Scrapes latest posts from active seed accounts via Apify Clockworks TikTok actor.

    Raises RuntimeError on API failure or non-200 responses.
    """
    if not handles:
        raise ValueError(
            "No active 'ON' seed accounts configured in Firestore 'tiktok_sources/config'."
        )

    profiles = [
        f"https://www.tiktok.com/@{h.replace('@', '').strip()}" for h in handles if h.strip()
    ]
    logger.info(
        "Triggering live Apify TikTok profile scrape for %d accounts: %s", len(profiles), profiles
    )

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
            response = client.post(url, json=payload)
            if response.status_code not in (200, 201):
                error_msg = (
                    f"Apify Actor failed with HTTP {response.status_code}: {response.text[:300]}"
                )
                logger.error(error_msg)
                raise RuntimeError(error_msg)

            items = response.json()
            if not isinstance(items, list):
                raise RuntimeError(f"Unexpected Apify response structure: {type(items).__name__}")

            logger.info(
                "Successfully fetched %d recent posts from live Apify seed profiles", len(items)
            )
            return items

    except httpx.RequestError as e:
        error_msg = f"Network error connecting to Apify API: {e}"
        logger.error(error_msg)
        raise RuntimeError(error_msg) from e


def resolve_hashtags_for_slate(
    active_movies: list[dict[str, Any]],
    sources_config: dict[str, Any],
    scraped_posts: list[dict[str, Any]],
) -> dict[str, dict[str, Any]]:
    """Resolves hashtags strictly from manual overrides and live scraped posts.

    NO automated patterns. NO fake defaults.
    """
    existing_overrides: dict[str, list[str]] = sources_config.get("overrides", {}) or {}
    logger.info(
        "Resolving hashtags across %d movies using %d live posts and %d overrides",
        len(active_movies),
        len(scraped_posts),
        len(existing_overrides),
    )

    discovered_slate: dict[str, dict[str, Any]] = {}

    for movie in active_movies:
        title = movie.get("title", "").strip().upper()
        norm_title = normalize_title(title)

        found_tags: set[str] = set()
        contributing_sources: set[str] = set()

        # 1. Custom overrides take precedence
        if title in existing_overrides:
            for tag in existing_overrides[title]:
                clean_tag = tag.replace("#", "").strip().lower()
                if clean_tag:
                    found_tags.add(clean_tag)
            contributing_sources.add("manual_override")

        # 2. Live Scraped Captions Match
        if scraped_posts:
            for post in scraped_posts:
                text = (post.get("text") or post.get("caption") or "").lower()
                author = post.get("authorMeta", {}).get("name") or post.get("source_handle") or ""

                if title.lower() in text or norm_title in text:
                    post_tags = post.get("hashtags") or []
                    for t in post_tags:
                        t_raw = t.get("name") if isinstance(t, dict) else t
                        if t_raw is not None:
                            clean_t = str(t_raw).replace("#", "").strip().lower()
                            if clean_t and clean_t not in {
                                "fyp",
                                "foryou",
                                "viral",
                                "bioskop",
                                "cinema",
                            }:
                                found_tags.add(clean_t)
                    if author and isinstance(author, str):
                        contributing_sources.add(f"@{author.replace('@', '')}")

        # If no verified tags found from live seed posts or overrides, it stays empty []
        is_verified = len(found_tags) > 0

        discovered_slate[title] = {
            "movie_id": movie.get("movie_id", norm_title),
            "title": title,
            "age_category": movie.get("age_category", "SU"),
            "discovered_hashtags": sorted(found_tags),
            "contributing_sources": sorted(contributing_sources),
            "verified": is_verified,
        }

    return discovered_slate


@functions_framework.http
def discover_hashtags_http(request: Any) -> tuple[str, int, dict[str, str]]:
    """HTTP Cloud Function entrypoint. Fails loudly and alerts Telegram on completion/failure."""
    now_wib = datetime.datetime.now(WIB)
    target_date = now_wib.strftime("%Y-%m-%d")

    # Optional target date override in request payload
    if request.is_json:
        req_json = request.get_json(silent=True) or {}
        if "date" in req_json:
            target_date = req_json["date"]

    logger.info("Starting Morning Hashtag Discovery for target date: %s", target_date)
    db = get_firestore_client()

    try:
        # 1. Check Apify Token (Fails 500 if missing)
        apify_token = get_apify_token(db)

        # 2. Check Active Seed Accounts (Fails 400 if none active)
        sources_config = load_sources_config(db)
        active_handles = [
            s.get("handle")
            for s in sources_config.get("sources", [])
            if s.get("active", True) and s.get("handle")
        ]
        if not active_handles:
            error_msg = "No active 'ON' seed accounts found in Firestore 'tiktok_sources/config'."
            logger.error(error_msg)
            send_telegram_alert(
                db,
                f"🚨 *CineRadar TikTok Discovery Failed*\n📅 Date: `{target_date}`\n❌ Error: {error_msg}",
            )
            return (
                json.dumps({"success": False, "error": error_msg}),
                400,
                {"Content-Type": "application/json"},
            )

        # 3. Check Active Movies (Fails 404 if no schedule found)
        active_movies = get_active_theatrical_movies(db, target_date)
        if not active_movies:
            error_msg = f"No active theatrical movies found in schedules_v2/{target_date}/movies."
            logger.error(error_msg)
            send_telegram_alert(
                db,
                f"🚨 *CineRadar TikTok Discovery Failed*\n📅 Date: `{target_date}`\n❌ Error: {error_msg}",
            )
            return (
                json.dumps({"success": False, "error": error_msg}),
                404,
                {"Content-Type": "application/json"},
            )

        # 4. Scrape active seed profiles via Apify (Fails 502 on network/API error)
        scraped_posts = scrape_seed_account_posts(apify_token, active_handles)

        # 5. Resolve authentic hashtags only (NO fallback, NO fake patterns)
        discovered_slate = resolve_hashtags_for_slate(active_movies, sources_config, scraped_posts)
        resolved_count = sum(1 for m in discovered_slate.values() if m["discovered_hashtags"])

        # 6. Persist daily discovery snapshot to Firestore
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

        logger.info(
            "Hashtag discovery completed for %s: %d/%d titles verified (live posts: %d)",
            target_date,
            resolved_count,
            len(active_movies),
            len(scraped_posts),
        )

        # 7. Send Rich Telegram Success Alert
        success_msg = (
            f"🍿 *CineRadar TikTok Discovery Complete*\n\n"
            f"📅 *Date*: `{target_date}`\n"
            f"🎬 *Theatrical Slate*: `{len(active_movies)} movies`\n"
            f"🏷️ *Verified Campaigns*: `{resolved_count}/{len(active_movies)} titles`\n"
            f"📡 *Live Posts Scanned*: `{len(scraped_posts)}` from `{len(active_handles)} seeds`\n"
            f"⏱ *Executed at*: `{now_wib.strftime('%H:%M:%S')} WIB`"
        )
        send_telegram_alert(db, success_msg)

        return (
            json.dumps(
                {
                    "success": True,
                    "date": target_date,
                    "total_titles": len(active_movies),
                    "resolved_count": resolved_count,
                    "live_posts_scanned": len(scraped_posts),
                    "active_seeds_count": len(active_handles),
                    "discovered_at": now_wib.isoformat(),
                }
            ),
            200,
            {"Content-Type": "application/json"},
        )

    except ValueError as ve:
        error_msg = f"Configuration error: {ve}"
        logger.error(error_msg)
        send_telegram_alert(
            db,
            f"🚨 *CineRadar TikTok Discovery [CONFIG ERROR]*\n📅 Date: `{target_date}`\n❌ Error: `{ve}`",
        )
        return (
            json.dumps({"success": False, "error": str(ve)}),
            500,
            {"Content-Type": "application/json"},
        )
    except RuntimeError as re:
        error_msg = f"Apify execution error: {re}"
        logger.error(error_msg)
        send_telegram_alert(
            db,
            f"🚨 *CineRadar TikTok Discovery [APIFY ERROR]*\n📅 Date: `{target_date}`\n❌ Error: `{re}`",
        )
        return (
            json.dumps({"success": False, "error": str(re)}),
            502,
            {"Content-Type": "application/json"},
        )
    except Exception as e:
        logger.exception("Unexpected hashtag discovery failure: %s", e)
        send_telegram_alert(
            db,
            f"🚨 *CineRadar TikTok Discovery [CRITICAL ERROR]*\n📅 Date: `{target_date}`\n❌ Error: `{e}`",
        )
        return (
            json.dumps({"success": False, "error": f"Internal server error: {e}"}),
            500,
            {"Content-Type": "application/json"},
        )
