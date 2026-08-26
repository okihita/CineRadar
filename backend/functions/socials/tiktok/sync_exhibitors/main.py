"""CineRadar — Exhibitor 3-Hourly Archive & Continuous Hashtag Derivation Engine (Gen 2 Cloud Function).

HTTP & Cloud Scheduler-triggered function that runs every 3 hours (`0 */3 * * *` WIB):
1. Scrapes the top 3 national exhibitor channels (`@cinema.21`, `@cgv.id`, `@cinepolisid`).
   - Normal mode: Scrapes the latest 10 posts per account.
   - Backfill mode (`is_backfill: true`): Scrapes up to 60 posts per account (~7-day history).
2. Upserts all posts into Firestore `tiktok_exhibitor_archive/{post_id}`:
   - Updates engagement velocity (`views`, `likes`, `comments`, `shares`).
   - Maintains a persistent rolling archive of all promotional posts.
3. Automatically derives authentic movie campaign hashtags for today's active theatrical slate:
   - Queries today's active movies from `schedules_v2/{target_date}/movies`.
   - Matches movie titles against all archived exhibitor posts from the last 14 days.
   - Filters out all exhibitor noise tags via `tiktok_sources/config` (`excluded_hashtags`).
   - Updates `tiktok_hashtag_discovery/{target_date}` with the freshly derived slate.
4. Updates the daily circuit snapshot `tiktok_circuit_timeline/{target_date}` for fast 1-read UI access.
5. Dispatches an aggregated 3-hourly summary alert to Telegram.
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

PROJECT_ID: str = str(os.environ.get("GOOGLE_CLOUD_PROJECT", "cineradar-481014"))
WIB = ZoneInfo("Asia/Jakarta")

EXHIBITOR_HANDLES: tuple[str, ...] = ("cinema.21", "cgv.id", "cinepolisid")
GENERIC_TAGS: frozenset[str] = frozenset(
    {"fyp", "foryou", "viral", "bioskop", "cinema", "nontondibioskop"}
)


# ─── 1. Infrastructure & Helpers ───


def get_firestore_client() -> firestore.Client:
    return firestore.Client(project=PROJECT_ID)


def json_response(data: dict[str, Any], status: int) -> tuple[str, int, dict[str, str]]:
    return json.dumps(data), status, {"Content-Type": "application/json"}


def send_telegram_alert(db: firestore.Client, message: str) -> None:
    """Sends a markdown notification to Telegram."""
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
        with httpx.Client(timeout=10.0) as client:
            client.post(
                url, json={"chat_id": str(chat_id), "text": message, "parse_mode": "Markdown"}
            )
    except Exception as exc:
        logger.warning("Failed to send Telegram alert: %s", exc)


def get_apify_token(db: firestore.Client) -> str:
    """Fetches Apify API token from Firestore auth_tokens/socials or env. Fails loudly."""
    token = ""
    try:
        doc = db.collection("auth_tokens").document("socials").get()
        if doc.exists:
            token = str((doc.to_dict() or {}).get("apify_api_token", "")).strip()
    except Exception as exc:
        logger.error("Failed to read auth_tokens/socials from Firestore: %s", exc)

    token = token or str(os.environ.get("APIFY_API_TOKEN", "")).strip()
    if not token:
        raise ValueError("Apify API token is not configured in Firestore 'auth_tokens/socials'.")
    return token


def normalize_title(title: str) -> str:
    return "".join(re.sub(r"[^\w\s]", "", title.lower()).split())


# ─── 2. Scraping & Tag Extraction ───


def scrape_exhibitor_posts(apify_token: str, is_backfill: bool = False) -> list[dict[str, Any]]:
    """Scrapes latest posts from Cinema XXI, CGV, and Cinépolis."""
    profiles = [f"https://www.tiktok.com/@{h}" for h in EXHIBITOR_HANDLES]
    limit = 60 if is_backfill else 10
    logger.info("Scraping %d exhibitor profiles (resultsPerPage=%d)...", len(profiles), limit)

    actor_id = "clockworks~tiktok-profile-scraper"
    url = f"https://api.apify.com/v2/acts/{actor_id}/run-sync-get-dataset-items?token={apify_token}"
    payload = {
        "profiles": profiles,
        "resultsPerPage": limit,
        "shouldDownloadVideos": False,
        "shouldDownloadCovers": False,
    }

    try:
        with httpx.Client(timeout=90.0) as client:
            res = client.post(url, json=payload)
            if res.status_code not in (200, 201):
                raise RuntimeError(
                    f"Apify Actor failed with HTTP {res.status_code}: {res.text[:200]}"
                )
            items = res.json()
            if not isinstance(items, list):
                raise RuntimeError(f"Unexpected Apify response structure: {type(items).__name__}")

            clean_items: list[dict[str, Any]] = [
                item for item in items if isinstance(item, dict) and item.get("id")
            ]
            logger.info("Fetched %d raw posts from exhibitor channels", len(clean_items))
            return clean_items
    except httpx.RequestError as exc:
        raise RuntimeError(f"Network error connecting to Apify API: {exc}") from exc


def extract_tags(post: dict[str, Any], excluded_tags: set[str]) -> list[str]:
    """Extracts clean non-generic, non-exhibitor noise hashtags."""
    banned = GENERIC_TAGS.union(excluded_tags)
    tags: set[str] = set()
    for t in post.get("hashtags") or []:
        t_raw = t.get("name") if isinstance(t, dict) else t
        if t_raw is not None:
            clean_t = str(t_raw).replace("#", "").strip().lower()
            if clean_t and clean_t not in banned:
                tags.add(clean_t)
    return sorted(tags)


# ─── 3. Archive Storage & Hashtag Derivation ───


def upsert_exhibitor_archive(
    db: firestore.Client, posts: list[dict[str, Any]], excluded_tags: set[str]
) -> tuple[int, int]:
    """Upserts posts into tiktok_exhibitor_archive and returns (new_count, updated_count)."""
    batch = db.batch()
    new_count = 0
    updated_count = 0
    now_iso = datetime.datetime.now(WIB).isoformat()

    for post in posts:
        post_id = str(post.get("id") or "")
        if not post_id:
            continue

        author_meta = post.get("authorMeta")
        author_name = str(
            author_meta.get("name")
            if isinstance(author_meta, dict)
            else post.get("source_handle") or ""
        ).lower()
        post_url = str(
            post.get("webVideoUrl")
            or post.get("url")
            or f"https://www.tiktok.com/@{author_name}/video/{post_id}"
        )
        caption = str(post.get("text") or post.get("caption") or "").strip()
        hashtags = extract_tags(post, excluded_tags)

        doc_ref = db.collection("tiktok_exhibitor_archive").document(post_id)
        doc_data = {
            "id": post_id,
            "url": post_url,
            "author": f"@{author_name.lstrip('@')}",
            "caption": caption[:500],
            "hashtags": hashtags,
            "views": int(post.get("playCount") or post.get("views") or 0),
            "likes": int(post.get("diggCount") or post.get("likes") or 0),
            "comments": int(post.get("commentCount") or 0),
            "shares": int(post.get("shareCount") or 0),
            "published_at": str(post.get("createTimeISO") or post.get("published_at") or ""),
            "last_synced_at": now_iso,
        }
        batch.set(doc_ref, doc_data, merge=True)
        new_count += 1

    batch.commit()
    logger.info("Committed %d posts to tiktok_exhibitor_archive", new_count)
    return new_count, updated_count


def derive_hashtags_from_archive(
    db: firestore.Client,
    target_date: str,
    sources_config: dict[str, Any],
) -> dict[str, Any]:
    """Derives hashtags for today's active theatrical slate from rolling 14-day exhibitor archive."""
    # 1. Fetch today's movies
    movie_docs = db.collection("schedules_v2").document(target_date).collection("movies").stream()
    active_movies = [data for doc in movie_docs if (data := doc.to_dict()) and "title" in data]

    # 2. Fetch all archived exhibitor posts (up to 300)
    archive_docs = (
        db.collection("tiktok_exhibitor_archive")
        .order_by("published_at", direction=firestore.Query.DESCENDING)
        .limit(300)
        .stream()
    )
    archived_posts: list[dict[str, Any]] = [
        data for doc in archive_docs if (data := doc.to_dict()) is not None
    ]

    overrides: dict[str, list[str]] = sources_config.get("overrides", {}) or {}
    excluded_tags: set[str] = {
        str(t).replace("#", "").strip().lower()
        for t in sources_config.get("excluded_hashtags", [])
        if t
    }

    discovered_slate: dict[str, dict[str, Any]] = {}
    now_wib = datetime.datetime.now(WIB)

    for movie in active_movies:
        title = movie.get("title", "").strip().upper()
        norm_title = normalize_title(title)
        found_tags: set[str] = set()
        sources: set[str] = set()
        matched_urls: list[str] = []

        # A. Check Overrides
        if title in overrides:
            for tag in overrides[title]:
                clean_tag = str(tag or "").replace("#", "").strip().lower()
                if clean_tag and clean_tag not in excluded_tags:
                    found_tags.add(clean_tag)
            sources.add("manual_override")

        # B. Match against 14-day archived exhibitor posts
        for post in archived_posts:
            caption = str(post.get("caption") or "").lower()
            author = str(post.get("author") or "").strip()
            post_url = str(post.get("url") or "")
            post_tags = post.get("hashtags") or []

            if title.lower() in caption or norm_title in caption:
                for t in post_tags:
                    if t not in excluded_tags:
                        found_tags.add(t)
                if author:
                    sources.add(author)
                if post_url and len(matched_urls) < 3:
                    matched_urls.append(post_url)

        discovered_slate[title] = {
            "movie_id": movie.get("movie_id", norm_title),
            "title": title,
            "age_category": movie.get("age_category", "SU"),
            "discovered_hashtags": sorted(found_tags),
            "contributing_sources": sorted(sources),
            "source_post_urls": matched_urls,
            "verified": len(found_tags) > 0,
        }

    resolved_count = sum(1 for m in discovered_slate.values() if m["discovered_hashtags"])

    # Persist updated discovery snapshot
    discovery_payload = {
        "date": target_date,
        "discovered_at": now_wib.isoformat(),
        "total_theatrical_titles": len(active_movies),
        "resolved_count": resolved_count,
        "archived_posts_inspected": len(archived_posts),
        "movies": discovered_slate,
    }
    db.collection("tiktok_hashtag_discovery").document(target_date).set(discovery_payload)
    return discovery_payload


def build_daily_circuit_timeline(db: firestore.Client, target_date: str) -> dict[str, Any]:
    """Builds a compressed 1-read snapshot in tiktok_circuit_timeline/{target_date}."""
    docs = (
        db.collection("tiktok_exhibitor_archive")
        .order_by("published_at", direction=firestore.Query.DESCENDING)
        .limit(100)
        .stream()
    )

    chain_map: dict[str, list[dict[str, Any]]] = {
        "cinema_21": [],
        "cgv_id": [],
        "cinepolis_id": [],
        "studios": [],
    }

    total = 0
    for doc in docs:
        post = doc.to_dict()
        if not post:
            continue
        author = str(post.get("author") or "").lower()
        if "cinema.21" in author or "21cineplex" in author:
            chain_map["cinema_21"].append(post)
        elif "cgv" in author:
            chain_map["cgv_id"].append(post)
        elif "cinepolis" in author:
            chain_map["cinepolis_id"].append(post)
        else:
            chain_map["studios"].append(post)
        total += 1

    payload = {
        "date": target_date,
        "crawled_at": datetime.datetime.now(WIB).isoformat(),
        "total_posts": total,
        "chains": {
            "cinema_21": {
                "name": "Cinema XXI",
                "handle": "@cinema.21",
                "posts": chain_map["cinema_21"],
            },
            "cgv_id": {"name": "CGV Cinemas", "handle": "@cgv.id", "posts": chain_map["cgv_id"]},
            "cinepolis_id": {
                "name": "Cinépolis Indonesia",
                "handle": "@cinepolisid",
                "posts": chain_map["cinepolis_id"],
            },
            "studios": {
                "name": "Production Studios",
                "handle": "Various",
                "posts": chain_map["studios"],
            },
        },
    }
    db.collection("tiktok_circuit_timeline").document(target_date).set(payload)
    return payload


def format_3hourly_telegram_report(
    target_date: str,
    scraped_count: int,
    discovery_payload: dict[str, Any],
    now_wib: datetime.datetime,
    is_backfill: bool,
) -> str:
    """Formats aggregated 3-hourly pulse alert for Telegram."""
    total_movies = discovery_payload.get("total_theatrical_titles", 0)
    resolved_count = discovery_payload.get("resolved_count", 0)
    movies = discovery_payload.get("movies", {})

    mode_str = (
        "🔥 *7-Day Deep Backfill Complete*"
        if is_backfill
        else "⏱ *3-Hourly Exhibitor Pulse & Sync*"
    )

    lines: list[str] = [
        f"{mode_str}",
        f"📅 Date: `{target_date}` | ⏰ Time: `{now_wib.strftime('%H:%M')} WIB`",
        "",
        f"📥 *Sync Activity*: Scraped `{scraped_count}` latest posts across XXI, CGV, Cinépolis.",
        f"🏷️ *Theatrical Hashtag Coverage*: `{resolved_count}/{total_movies} movies verified`",
        "",
        "🎬 *Top Verified Movie Campaigns*:",
    ]

    verified_movies = [m for m in movies.values() if m.get("discovered_hashtags")]
    for m in verified_movies[:8]:
        title = m.get("title")
        tags_str = " ".join([f"#{t}" for t in m.get("discovered_hashtags", [])[:3]])
        srcs = m.get("contributing_sources", [])
        src_str = f"({', '.join(srcs[:2])})" if srcs else ""
        lines.append(f"• *{title}* → `{tags_str}` {src_str}")

    if len(verified_movies) > 8:
        lines.append(f"_...and {len(verified_movies) - 8} more verified films_")

    lines.append("")
    lines.append("🔗 [Open Exhibitor Archive](https://studio.cineradar.id/tiktok/exhibitors)")
    return "\n".join(lines)


# ─── 4. Cloud Function Entrypoint ───


@functions_framework.http
def sync_exhibitors_http(request: Any) -> tuple[str, int, dict[str, str]]:
    """HTTP Entrypoint for 3-hourly sync and 7-day backfills."""
    now_wib = datetime.datetime.now(WIB)
    target_date = now_wib.strftime("%Y-%m-%d")
    is_backfill = False

    if request.is_json and (req_json := request.get_json(silent=True)):
        target_date = str(req_json.get("date") or target_date)
        is_backfill = bool(req_json.get("is_backfill", False))

    logger.info("Executing sync_exhibitors (date=%s, is_backfill=%s)", target_date, is_backfill)
    db = get_firestore_client()

    try:
        apify_token = get_apify_token(db)
        sources_doc = db.collection("tiktok_sources").document("config").get()
        sources_config = sources_doc.to_dict() or {} if sources_doc.exists else {}
        excluded_tags: set[str] = {
            str(t).replace("#", "").strip().lower()
            for t in sources_config.get("excluded_hashtags", [])
            if t
        }

        # Step 1: Scrape Exhibitors
        scraped_posts = scrape_exhibitor_posts(apify_token, is_backfill=is_backfill)
        if not scraped_posts:
            raise RuntimeError("No posts returned from Apify exhibitor scraper.")

        # Step 2: Upsert into persistent archive
        upsert_exhibitor_archive(db, scraped_posts, excluded_tags)

        # Step 3: Continuously derive hashtags for today's active theatrical slate
        discovery_payload = derive_hashtags_from_archive(db, target_date, sources_config)

        # Step 4: Build daily timeline rollup for fast UI access
        build_daily_circuit_timeline(db, target_date)

        # Step 5: Send rich aggregated Telegram alert
        telegram_report = format_3hourly_telegram_report(
            target_date, len(scraped_posts), discovery_payload, now_wib, is_backfill
        )
        send_telegram_alert(db, telegram_report)

        return json_response(
            {
                "success": True,
                "date": target_date,
                "is_backfill": is_backfill,
                "scraped_posts": len(scraped_posts),
                "total_movies": discovery_payload.get("total_theatrical_titles", 0),
                "resolved_movies": discovery_payload.get("resolved_count", 0),
                "executed_at": now_wib.isoformat(),
            },
            200,
        )

    except ValueError as val_err:
        logger.error("Configuration error: %s", val_err)
        send_telegram_alert(
            db, f"🚨 *CineRadar Exhibitor Sync [CONFIG ERROR]*\n❌ Error: `{val_err}`"
        )
        return json_response({"success": False, "error": str(val_err)}, 400)
    except RuntimeError as run_err:
        logger.error("Scraping execution error: %s", run_err)
        send_telegram_alert(
            db, f"🚨 *CineRadar Exhibitor Sync [SCRAPE ERROR]*\n❌ Error: `{run_err}`"
        )
        return json_response({"success": False, "error": str(run_err)}, 502)
    except Exception as gen_err:
        logger.exception("Unexpected sync failure: %s", gen_err)
        send_telegram_alert(
            db, f"🚨 *CineRadar Exhibitor Sync [CRITICAL ERROR]*\n❌ Error: `{gen_err}`"
        )
        return json_response({"success": False, "error": f"Internal error: {gen_err}"}, 500)
