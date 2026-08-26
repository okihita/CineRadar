"""CineRadar — Hashtag Discovery & Cinema Chain Monitoring Engine (Gen 2 Cloud Function).

HTTP-triggered Cloud Function that runs daily at 08:00 WIB:
1. Loads Apify API token from Firestore `auth_tokens/socials`. FAILS LOUDLY (500) if missing.
2. Loads active truth seed accounts from Firestore `tiktok_sources/config`. FAILS LOUDLY (400) if none active.
3. Queries today's active theatrical slate from Firestore `schedules_v2/{target_date}/movies`. FAILS LOUDLY (404) if empty.
4. Executes live Apify TikTok Profile Scraper across top 3 exhibitor chains + studios (up to 30 posts/exhibitor).
5. Stores full raw exhibitor timeline rollup in Firestore `tiktok_circuit_timeline/{target_date}`.
6. Matches and resolves authentic campaign hashtags from live seed posts and manual overrides only.
   - NO auto-seed generation.
   - NO silent mock fallback.
7. Persists the discovery snapshot to Firestore `tiktok_hashtag_discovery/{target_date}`.
8. Sends a rich, structured Telegram Morning Briefing containing:
   - Total active theatrical movies for today
   - Exhibitor pulse metrics
   - Successfully mapped Movie -> Hashtag(s) (with contributing sources)
   - Unmarketed/Pending titles

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

PROJECT_ID: str = str(os.environ.get("GOOGLE_CLOUD_PROJECT", "cineradar-481014"))
WIB = ZoneInfo("Asia/Jakarta")
GENERIC_TAGS: frozenset[str] = frozenset(
    {"fyp", "foryou", "viral", "bioskop", "cinema", "nontondibioskop"}
)


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


# ─── 2. Data Access Layer (KISS & DRY) ───


def normalize_title(title: str) -> str:
    return "".join(re.sub(r"[^\w\s]", "", title.lower()).split())


def get_active_theatrical_movies(db: firestore.Client, target_date: str) -> list[dict[str, Any]]:
    docs = db.collection("schedules_v2").document(target_date).collection("movies").stream()
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
        if data:
            return data
    return {"sources": [], "overrides": {}}


# ─── 3. External Scraping & Chain Timeline (SOLID / Pure Logic) ───


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
    # Fetch 25 posts per profile to cover recent theatrical marketing window
    payload = {
        "profiles": profiles,
        "resultsPerPage": 25,
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

            clean_items: list[dict[str, Any]] = [item for item in items if isinstance(item, dict)]
            logger.info("Fetched %d recent posts from live Apify seed profiles", len(clean_items))
            return clean_items
    except httpx.RequestError as exc:
        raise RuntimeError(f"Network error connecting to Apify API: {exc}") from exc


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


def build_circuit_timeline_rollup(
    scraped_posts: list[dict[str, Any]], target_date: str
) -> dict[str, Any]:
    """Rolls up raw exhibitor posts into a compact single-document structure."""
    chain_map: dict[str, list[dict[str, Any]]] = {
        "cinema_21": [],
        "cgv_id": [],
        "cinepolis_id": [],
        "studios": [],
    }

    for post in scraped_posts:
        author_meta = post.get("authorMeta")
        author_name = str(
            author_meta.get("name")
            if isinstance(author_meta, dict)
            else post.get("source_handle") or ""
        ).lower()
        post_id = str(post.get("id") or "")
        post_url = str(
            post.get("webVideoUrl")
            or post.get("url")
            or f"https://www.tiktok.com/@{author_name}/video/{post_id}"
        )
        caption = str(post.get("text") or post.get("caption") or "").strip()
        hashtags = sorted(extract_tags_from_post(post))

        post_summary = {
            "id": post_id,
            "url": post_url,
            "author": f"@{author_name.lstrip('@')}",
            "caption": caption[:300],
            "hashtags": hashtags,
            "views": int(post.get("playCount") or post.get("views") or 0),
            "likes": int(post.get("diggCount") or post.get("likes") or 0),
            "comments": int(post.get("commentCount") or 0),
            "shares": int(post.get("shareCount") or 0),
            "published_at": str(post.get("createTimeISO") or post.get("published_at") or ""),
        }

        if "cinema.21" in author_name or "21cineplex" in author_name:
            chain_map["cinema_21"].append(post_summary)
        elif "cgv" in author_name:
            chain_map["cgv_id"].append(post_summary)
        elif "cinepolis" in author_name:
            chain_map["cinepolis_id"].append(post_summary)
        else:
            chain_map["studios"].append(post_summary)

    return {
        "date": target_date,
        "crawled_at": datetime.datetime.now(WIB).isoformat(),
        "total_posts": len(scraped_posts),
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
                "name": "Production Houses",
                "handle": "Various",
                "posts": chain_map["studios"],
            },
        },
    }


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
        matched_urls: list[str] = []

        # 1. Custom Overrides (Highest priority)
        if title in overrides:
            for tag in overrides[title]:
                tag_str = str(tag or "").strip()
                if tag_str.startswith("#"):
                    tag_str = tag_str[1:]
                if clean_tag := tag_str.lower():
                    found_tags.add(clean_tag)
            sources.add("manual_override")

        # 2. Match live scraped posts
        for post in scraped_posts:
            caption = str(post.get("text") or post.get("caption") or "").lower()
            author_meta = post.get("authorMeta")
            author_name = author_meta.get("name") if isinstance(author_meta, dict) else None
            author = str(author_name or post.get("source_handle") or "").strip()
            post_url = str(post.get("webVideoUrl") or post.get("url") or "")

            if title.lower() in caption or norm_title in caption:
                post_tags = extract_tags_from_post(post)
                found_tags.update(post_tags)
                if author:
                    sources.add(f"@{author.lstrip('@')}")
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

    return discovered_slate


def format_telegram_report(
    target_date: str,
    active_movies: list[dict[str, Any]],
    discovered_slate: dict[str, dict[str, Any]],
    circuit_rollup: dict[str, Any],
    now_wib: datetime.datetime,
) -> str:
    """Formats a rich, compact, mobile-friendly Telegram report."""
    mapped_movies: list[tuple[str, list[str], list[str]]] = []
    unmapped_movies: list[str] = []

    for title, info in discovered_slate.items():
        if info["discovered_hashtags"]:
            mapped_movies.append((title, info["discovered_hashtags"], info["contributing_sources"]))
        else:
            unmapped_movies.append(title)

    lines: list[str] = [
        "🍿 *CineRadar Theatrical & Social Pulse*",
        f"📅 Date: `{target_date}` | 🎬 Theatrical Slate: `{len(active_movies)} Movies`",
        "",
        f"✅ *Verified Campaigns ({len(mapped_movies)}/{len(active_movies)})*:",
    ]

    for title, tags, srcs in mapped_movies[:15]:
        tags_str = " ".join([f"#{t}" for t in tags[:3]])
        src_str = f"({', '.join(srcs[:2])})" if srcs else ""
        lines.append(f"• *{title}* → `{tags_str}` {src_str}")

    if len(mapped_movies) > 15:
        lines.append(f"_...and {len(mapped_movies) - 15} more verified titles_")

    if unmapped_movies:
        lines.append("")
        lines.append(f"⏳ *Pending / No Promo Tags ({len(unmapped_movies)})*:")
        sample_unmapped = ", ".join(unmapped_movies[:6])
        if len(unmapped_movies) > 6:
            sample_unmapped += f", +{len(unmapped_movies) - 6} more"
        lines.append(f"_{sample_unmapped}_")

    # Circuit summary
    chains = circuit_rollup.get("chains", {})
    xxi_count = len(chains.get("cinema_21", {}).get("posts", []))
    cgv_count = len(chains.get("cgv_id", {}).get("posts", []))
    cine_count = len(chains.get("cinepolis_id", {}).get("posts", []))

    lines.append("")
    lines.append("📡 *Exhibitor Feed Pulse*:")
    lines.append(
        f"• Cinema XXI: `{xxi_count} promos` | CGV: `{cgv_count} promos` | Cinépolis: `{cine_count} promos`"
    )
    lines.append(f"⏱ *Scan Completed*: `{now_wib.strftime('%H:%M:%S')} WIB`")

    return "\n".join(lines)


# ─── 4. Cloud Function Entrypoint (Controller) ───


@functions_framework.http
def discover_hashtags_http(request: Any) -> tuple[str, int, dict[str, str]]:
    """HTTP Cloud Function entrypoint. Fails loudly and alerts Telegram."""
    now_wib = datetime.datetime.now(WIB)
    target_date = now_wib.strftime("%Y-%m-%d")

    if request.is_json and (req_json := request.get_json(silent=True)):
        target_date = str(req_json.get("date") or target_date)

    logger.info("Starting Morning Hashtag Discovery for target date: %s", target_date)
    db = get_firestore_client()

    try:
        # Step 1 & 2: Token & Active Seed Accounts validation
        apify_token = get_apify_token(db)
        sources_config = load_sources_config(db)
        active_handles = [
            str(s.get("handle"))
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

        # Step 4: Live Apify Scraping across all active handles
        scraped_posts = scrape_seed_account_posts(apify_token, active_handles)

        # Step 5: Save Circuit Timeline Rollup to Firestore
        circuit_rollup = build_circuit_timeline_rollup(scraped_posts, target_date)
        db.collection("tiktok_circuit_timeline").document(target_date).set(circuit_rollup)

        # Step 6: Authentic Slate Hashtag Resolution
        discovered_slate = resolve_hashtags_for_slate(active_movies, sources_config, scraped_posts)
        resolved_count = sum(1 for m in discovered_slate.values() if m["discovered_hashtags"])

        # Step 7: Persist Daily Discovery Snapshot
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

        # Step 8: Send Rich Telegram Morning Intelligence Report
        telegram_report = format_telegram_report(
            target_date, active_movies, discovered_slate, circuit_rollup, now_wib
        )
        send_telegram_alert(db, telegram_report)

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

    except ValueError as val_err:
        logger.error("Configuration error: %s", val_err)
        send_telegram_alert(
            db,
            f"🚨 *CineRadar TikTok Discovery [CONFIG ERROR]*\n📅 Date: `{target_date}`\n❌ Error: `{val_err}`",
        )
        return json_response({"success": False, "error": str(val_err)}, 400)
    except RuntimeError as run_err:
        logger.error("Apify execution error: %s", run_err)
        send_telegram_alert(
            db,
            f"🚨 *CineRadar TikTok Discovery [APIFY ERROR]*\n📅 Date: `{target_date}`\n❌ Error: `{run_err}`",
        )
        return json_response({"success": False, "error": str(run_err)}, 502)
    except Exception as gen_err:
        logger.exception("Unexpected discovery failure: %s", gen_err)
        send_telegram_alert(
            db,
            f"🚨 *CineRadar TikTok Discovery [CRITICAL ERROR]*\n📅 Date: `{target_date}`\n❌ Error: `{gen_err}`",
        )
        return json_response({"success": False, "error": f"Internal server error: {gen_err}"}, 500)
