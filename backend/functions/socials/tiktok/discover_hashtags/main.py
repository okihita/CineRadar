"""CineRadar — Hashtag Discovery Engine (Gen 2 Cloud Function).

HTTP-triggered Cloud Function that runs daily at 08:00 WIB:
1. Reads Apify token from Firestore `auth_tokens/socials` (falling back to env APIFY_API_TOKEN).
2. Loads active 'ON' truth seed accounts from Firestore `tiktok_sources/config`.
3. Queries today's active theatrical slate from Firestore `schedules_v2/{target_date}/movies`.
4. Scrapes recent video captions from active seed accounts via Apify / Clockworks actor.
5. Matches and resolves multi-agency campaign hashtags against active theatrical titles.
6. Persists the discovery snapshot to Firestore `tiktok_hashtag_discovery/{target_date}`.

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


def get_apify_token(db: firestore.Client) -> str:
    """Fetches Apify API token from Firestore auth_tokens/socials, with env fallback."""
    try:
        doc = db.collection("auth_tokens").document("socials").get()
        if doc.exists:
            token = (doc.to_dict() or {}).get("apify_api_token", "")
            if token and isinstance(token, str) and len(token) > 10:
                logger.info("Loaded Apify API token from Firestore auth_tokens/socials")
                return token.strip()
    except Exception as e:
        logger.warning("Failed to read auth_tokens/socials from Firestore: %s", e)

    return os.environ.get("APIFY_API_TOKEN", "").strip()


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
    """Scrapes latest posts from active seed accounts via Apify Clockworks TikTok actor."""
    if not apify_token or not handles:
        logger.info("Skipping live Apify scrape: no token or active handles")
        return []

    profiles = [f"https://www.tiktok.com/@{h.replace('@', '').strip()}" for h in handles if h.strip()]
    logger.info("Triggering Apify TikTok profile scrape for %d accounts: %s", len(profiles), profiles)

    try:
        # Run Apify clockworks/tiktok-profile-scraper actor (sync dataset wait, up to 5 posts per seed)
        actor_id = "clockworks~tiktok-profile-scraper"
        url = f"https://api.apify.com/v2/acts/{actor_id}/run-sync-get-dataset-items?token={apify_token}"

        payload = {
            "profiles": profiles,
            "resultsPerPage": 5,
            "shouldDownloadVideos": False,
            "shouldDownloadCovers": False,
        }

        with httpx.Client(timeout=45.0) as client:
            response = client.post(url, json=payload)
            if response.status_code == 200 or response.status_code == 201:
                items = response.json()
                if isinstance(items, list):
                    logger.info("Successfully fetched %d recent posts from Apify seed profiles", len(items))
                    return items
            else:
                logger.warning("Apify Actor returned HTTP %d: %s", response.status_code, response.text[:200])
    except Exception as e:
        logger.warning("Apify seed profile crawl encountered error: %s", e)

    return []


def resolve_hashtags_for_slate(
    active_movies: list[dict[str, Any]],
    sources_config: dict[str, Any],
    scraped_posts: list[dict[str, Any]],
) -> dict[str, dict[str, Any]]:
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

        # 1. Highest Priority: Check custom overrides
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

                # Check if movie title or normalized title is mentioned in post
                if title.lower() in text or norm_title in text:
                    # Extract hashtags from post hashtags array or regex
                    post_tags = post.get("hashtags") or []
                    for t in post_tags:
                        t_raw = t.get("name") if isinstance(t, dict) else t
                        if t_raw is not None:
                            clean_t = str(t_raw).replace("#", "").strip().lower()
                            if clean_t and clean_t not in {"fyp", "foryou", "viral", "bioskop", "cinema"}:
                                found_tags.add(clean_t)
                    if author and isinstance(author, str):
                        contributing_sources.add(f"@{author.replace('@', '')}")

        # 3. Deterministic Fallback if live scrape is empty or unreleased
        if not found_tags:
            found_tags.add(norm_title)
            found_tags.add(f"film{norm_title}")
            contributing_sources.add("automated_seed_pattern")

        discovered_slate[title] = {
            "movie_id": movie.get("movie_id", norm_title),
            "title": title,
            "age_category": movie.get("age_category", "SU"),
            "discovered_hashtags": sorted(found_tags),
            "contributing_sources": sorted(contributing_sources),
            "verified": True,
        }

    return discovered_slate


@functions_framework.http
def discover_hashtags_http(request: Any) -> tuple[str, int, dict[str, str]]:
    """HTTP Cloud Function entrypoint."""
    now_wib = datetime.datetime.now(WIB)
    target_date = now_wib.strftime("%Y-%m-%d")

    # Optional target date override in request payload
    if request.is_json:
        req_json = request.get_json(silent=True) or {}
        if "date" in req_json:
            target_date = req_json["date"]

    logger.info("Starting Morning Hashtag Discovery for target date: %s", target_date)

    try:
        db = get_firestore_client()
        apify_token = get_apify_token(db)
        sources_config = load_sources_config(db)
        active_movies = get_active_theatrical_movies(db, target_date)

        if not active_movies:
            logger.warning("No active theatrical movies found for %s", target_date)
            return (
                json.dumps({"success": False, "message": f"No active movies found for {target_date}"}),
                404,
                {"Content-Type": "application/json"},
            )

        # Scrape active seed profiles via Apify
        active_handles = [s.get("handle") for s in sources_config.get("sources", []) if s.get("active", True) and s.get("handle")]
        scraped_posts = scrape_seed_account_posts(apify_token, active_handles)

        # Resolve multi-agency hashtags
        discovered_slate = resolve_hashtags_for_slate(active_movies, sources_config, scraped_posts)

        # Persist daily discovery snapshot to Firestore
        db.collection("tiktok_hashtag_discovery").document(target_date).set({
            "date": target_date,
            "discovered_at": now_wib.isoformat(),
            "total_theatrical_titles": len(active_movies),
            "resolved_count": len(discovered_slate),
            "live_posts_scanned": len(scraped_posts),
            "active_seeds_count": len(active_handles),
            "movies": discovered_slate,
        })

        logger.info("Successfully resolved %d titles for %s (live posts: %d)", len(discovered_slate), target_date, len(scraped_posts))

        return (
            json.dumps({
                "success": True,
                "date": target_date,
                "total_titles": len(active_movies),
                "resolved_count": len(discovered_slate),
                "live_posts_scanned": len(scraped_posts),
                "discovered_at": now_wib.isoformat(),
            }),
            200,
            {"Content-Type": "application/json"},
        )

    except Exception as e:
        logger.exception("Hashtag discovery failed: %s", e)
        return (
            json.dumps({"success": False, "error": str(e)}),
            500,
            {"Content-Type": "application/json"},
        )
