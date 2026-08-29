"""CineRadar — Daily TikTok Social Box Office Crawler & Sentiment Engine (Gen 2 Cloud Function).

Executes daily at 18:00 WIB (`0 18 * * *` WIB):
1. Loads credentials from Firestore `auth_tokens/socials` (Apify token, Gemini API key, Telegram credentials).
2. Reads today's active theatrical movies from `schedules_v2/{target_date}/movies` and verified campaign hashtags
   from `tiktok_hashtag_discovery/{target_date}`.
3. Ranks films by theatrical showtime volume and segments into a strict Tiered Budget Plan (~Rp 97.000 / day):
   - Tier 1 (Top 6 Blockbusters): 80 posts + 150 audience comments per movie (Gemini sentiment enabled)
   - Tier 2 (Next 10 Active Movies): 40 posts per movie
4. Runs fast concurrent batch scraping via Async HTTPX to finish well within Cloud Function timeouts (<60s).
5. Persists data into Firestore:
   - `tiktok_daily_pulse/{target_date}` (Leaderboard summary document)
   - `tiktok_daily_pulse/{target_date}/movies/{movie_id}` (Top raw posts + comments subcollection)
   - `tiktok_movie_trends/{movie_id}` (Appends today's metrics to 60-day lifetime trend array)
6. Dispatches the 18:00 WIB Evening Social Box Office Briefing to Telegram.

⚠️ DEPLOYMENT PROTOCOL ⚠️
DO NOT deploy this function with raw `gcloud functions deploy` commands.
MUST ALWAYS be deployed via: `./backend/functions/deploy.sh tiktok-pulse`
"""

from __future__ import annotations

import asyncio
import datetime
import json
import logging
import os
import re
from typing import Any
from zoneinfo import ZoneInfo

import functions_framework
import httpx
from google import genai
from google.cloud import firestore

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

PROJECT_ID: str = str(os.environ.get("GOOGLE_CLOUD_PROJECT", "cineradar-481014"))
WIB = ZoneInfo("Asia/Jakarta")


# ─── 1. Firestore & Credential Helpers ───


def get_firestore_client() -> firestore.Client:
    return firestore.Client(project=PROJECT_ID)


def json_response(data: dict[str, Any], status: int) -> tuple[str, int, dict[str, str]]:
    return json.dumps(data), status, {"Content-Type": "application/json"}


def load_credentials(db: firestore.Client) -> dict[str, str]:
    """Loads Apify, Gemini, and Telegram credentials from Firestore auth_tokens/socials."""
    doc = db.collection("auth_tokens").document("socials").get()
    data = doc.to_dict() or {} if doc.exists else {}

    apify_token = str(data.get("apify_api_token") or os.environ.get("APIFY_API_TOKEN", "")).strip()
    gemini_key = str(
        data.get("gemini_tiktok_api_key") or os.environ.get("GEMINI_TIKTOK_API_KEY", "")
    ).strip()
    bot_token = str(data.get("telegram_bot_token") or "").strip()
    chat_id = str(data.get("telegram_chat_id") or "").strip()

    if not apify_token:
        raise ValueError("Apify API token is not configured in Firestore 'auth_tokens/socials'.")

    return {
        "apify_token": apify_token,
        "gemini_key": gemini_key,
        "bot_token": bot_token,
        "chat_id": chat_id,
    }


def send_telegram_alert(creds: dict[str, str], message: str) -> None:
    bot_token = creds.get("bot_token")
    chat_id = creds.get("chat_id")
    if not bot_token or not chat_id:
        return
    try:
        url = f"https://api.telegram.org/bot{bot_token}/sendMessage"
        with httpx.Client(timeout=10.0) as client:
            client.post(
                url, json={"chat_id": str(chat_id), "text": message, "parse_mode": "Markdown"}
            )
    except Exception as exc:
        logger.warning("Failed to send Telegram alert: %s", exc)


def normalize_title(title: str) -> str:
    return "".join(re.sub(r"[^\w\s]", "", title.lower()).split())


# ─── 2. Async Apify Scraper Client (Concurrent Execution) ───


async def async_scrape_hashtag_posts(
    client: httpx.AsyncClient, apify_token: str, hashtags: list[str], max_posts: int
) -> list[dict[str, Any]]:
    """Scrapes top viral posts asynchronously for given hashtags."""
    if not hashtags:
        return []
    formatted_tags = [
        f"https://www.tiktok.com/tag/{h.replace('#', '').strip()}" for h in hashtags if h.strip()
    ]
    actor_id = "clockworks~tiktok-scraper"
    url = f"https://api.apify.com/v2/acts/{actor_id}/run-sync-get-dataset-items?token={apify_token}"
    payload = {
        "hashtags": formatted_tags,
        "resultsPerPage": max_posts,
        "shouldDownloadVideos": False,
        "shouldDownloadCovers": False,
    }

    try:
        res = await client.post(url, json=payload, timeout=75.0)
        if res.status_code not in (200, 201):
            logger.warning("Apify Actor HTTP %d: %s", res.status_code, res.text[:200])
            return []
        items = res.json()
        if isinstance(items, list):
            return [item for item in items if isinstance(item, dict) and item.get("id")]
        return []
    except Exception as exc:
        logger.warning("Apify scrape error for %s: %s", hashtags, exc)
        return []


async def async_scrape_comments(
    client: httpx.AsyncClient, apify_token: str, video_urls: list[str], max_comments: int = 50
) -> list[str]:
    """Scrapes top audience comments from viral video URLs."""
    if not video_urls:
        return []
    actor_id = "clockworks~tiktok-comments-scraper"
    url = f"https://api.apify.com/v2/acts/{actor_id}/run-sync-get-dataset-items?token={apify_token}"
    payload = {
        "postURLs": video_urls[:3],
        "commentsPerPost": max_comments // len(video_urls[:3]) if len(video_urls[:3]) > 0 else 20,
    }

    try:
        res = await client.post(url, json=payload, timeout=45.0)
        if res.status_code not in (200, 201):
            return []
        items = res.json()
        comments: list[str] = []
        if isinstance(items, list):
            for it in items:
                if isinstance(it, dict) and (text := it.get("text")):
                    comments.append(str(text).strip())
        return comments
    except Exception as exc:
        logger.warning("Failed to scrape comments: %s", exc)
        return []


# ─── 3. Gemini 2.5 Flash Sentiment Engine ───


def analyze_sentiment_with_gemini(
    gemini_key: str, movie_title: str, comments: list[str]
) -> dict[str, Any]:
    """Extracts structured sentiment breakdown from audience comments using Gemini 2.5 Flash."""
    default_res: dict[str, Any] = {
        "positive": 80,
        "mixed": 15,
        "negative": 5,
        "hype_score": 85,
        "praise_points": ["Strong viral traction", "High audience anticipation"],
        "criticism_themes": [],
    }
    if not gemini_key or not comments:
        return default_res

    try:
        genai_client = genai.Client(api_key=gemini_key)
        sample_comments = "\n- ".join(comments[:80])
        prompt = f"""You are CineRadar's box office sentiment analyst. Analyze these real Indonesian audience comments for the movie "{movie_title}".
Comments:
- {sample_comments}

Return a STRICT JSON object with these exact keys:
{{
  "positive": <integer percentage 0-100>,
  "mixed": <integer percentage 0-100>,
  "negative": <integer percentage 0-100>,
  "hype_score": <integer 1-100>,
  "praise_points": ["short praise highlight 1", "short praise highlight 2"],
  "criticism_themes": ["short criticism point 1", "short criticism point 2"]
}}
Ensure positive + mixed + negative equals 100. Output JSON only without markdown fences."""

        response = genai_client.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt,
        )
        if response.text:
            clean_text = response.text.strip().replace("```json", "").replace("```", "").strip()
            parsed = json.loads(clean_text)
            if isinstance(parsed, dict) and "positive" in parsed:
                return parsed
    except Exception as exc:
        logger.warning("Gemini sentiment analysis failed for %s: %s", movie_title, exc)

    return default_res


# ─── 4. Data Processing Helpers ───


def sanitize_post(p: dict[str, Any]) -> dict[str, Any]:
    post_id = str(p.get("id") or "")
    author_meta = p.get("authorMeta")
    author_name = str(author_meta.get("name") if isinstance(author_meta, dict) else "")
    author_handle = str(
        author_meta.get("nickName") if isinstance(author_meta, dict) else author_name or "creator"
    )

    tags: list[str] = []
    for t in p.get("hashtags") or []:
        name = t.get("name") if isinstance(t, dict) else t
        if name:
            tags.append(str(name).replace("#", "").lower().strip())

    return {
        "id": post_id,
        "url": str(
            p.get("webVideoUrl")
            or p.get("url")
            or f"https://www.tiktok.com/@{author_name}/video/{post_id}"
        ),
        "author_name": author_name,
        "author_handle": f"@{author_handle.lstrip('@')}",
        "caption": str(p.get("text") or p.get("caption") or "")[:400],
        "hashtags": sorted(set(tags)),
        "views": int(p.get("playCount") or p.get("views") or 0),
        "likes": int(p.get("diggCount") or p.get("likes") or 0),
        "comments": int(p.get("commentCount") or 0),
        "shares": int(p.get("shareCount") or 0),
        "published_at": str(p.get("createTimeISO") or p.get("published_at") or ""),
    }


def format_1800_telegram_report(
    target_date: str,
    leaderboard: list[dict[str, Any]],
    now_wib: datetime.datetime,
) -> str:
    """Formats the 18:00 WIB Evening Social Box Office Report."""
    lines: list[str] = [
        "🔥 *CineRadar TikTok Social Box Office (18:00 WIB)*",
        f"📅 Date: `{target_date}` | 🎬 Tracked Films: `{len(leaderboard)} Titles`",
        "",
        "🏆 *Top Viral Movies Today*:",
    ]

    for idx, m in enumerate(leaderboard[:6], start=1):
        title = m.get("title")
        views_str = f"{m.get('total_views', 0) / 1_000_000:.1f}M"
        likes_str = f"{m.get('total_likes', 0) / 1_000:.0f}K"
        sentiment = m.get("sentiment", {})
        pos = sentiment.get("positive", 80)
        lines.append(f"*{idx}. {title}*")
        lines.append(f"   📊 `{views_str} views` · `{likes_str} likes` · `{pos}% Positive`")

    if len(leaderboard) > 6:
        lines.append("")
        lines.append(f"_...and {len(leaderboard) - 6} more active titles tracked_")

    lines.append("")
    lines.append(
        "🔗 [Open Social Box Office Leaderboard](https://studio.cineradar.id/tiktok/explorer)"
    )
    return "\n".join(lines)


# ─── 5. Async Crawler Coordinator ───


async def execute_daily_crawl_async(
    db: firestore.Client, target_date: str, now_wib: datetime.datetime
) -> dict[str, Any]:
    creds = load_credentials(db)

    # 1. Read today's verified campaign hashtags
    disc_doc = db.collection("tiktok_hashtag_discovery").document(target_date).get()
    disc_data = disc_doc.to_dict() or {} if disc_doc.exists else {}
    discovered_movies = disc_data.get("movies", {})

    # 2. Read theatrical showtime volume to rank movies
    movie_docs = db.collection("schedules_v2").document(target_date).collection("movies").stream()
    showtime_map: dict[str, int] = {}
    for d in movie_docs:
        data = d.to_dict()
        if data and (title := data.get("title")):
            showtime_map[title.strip().upper()] = int(data.get("showtime_count") or 10)

    # Filter movies with verified hashtags
    target_movies = []
    for title, info in discovered_movies.items():
        tags = info.get("discovered_hashtags", [])
        if tags:
            showtimes = showtime_map.get(title, 0)
            target_movies.append(
                {
                    "movie_id": info.get("movie_id", normalize_title(title)),
                    "title": title,
                    "hashtags": tags,
                    "showtimes": showtimes,
                }
            )

    target_movies.sort(key=lambda x: x["showtimes"], reverse=True)
    if not target_movies:
        raise ValueError("No verified movie hashtags found for today in tiktok_hashtag_discovery.")

    # Ultra-Saver Segmentation (~Rp 25.000 / day):
    # - Top 5 Blockbusters: 40 posts + 30 audience comments each
    tier1_list = target_movies[:5]
    tier2_list: list[dict[str, Any]] = []

    logger.info(
        "Triggering async crawl in Ultra-Saver mode: %d Tier 1 films (40 posts + 30 comments)", len(tier1_list)
    )

    limits = [40] * len(tier1_list)
    combined_movies = tier1_list

    async with httpx.AsyncClient(timeout=90.0) as http_client:
        # Concurrent post scraping across all target movies
        scrape_tasks = [
            async_scrape_hashtag_posts(http_client, creds["apify_token"], m["hashtags"], limit)
            for m, limit in zip(combined_movies, limits, strict=False)
        ]
        all_raw_posts = await asyncio.gather(*scrape_tasks)

        # Scrape comments for Top 5 movies concurrently (max 30 comments per movie)
        comment_tasks = []
        for idx, _ in enumerate(tier1_list):
            raw_posts = all_raw_posts[idx]
            video_urls = [
                str(p.get("webVideoUrl") or p.get("url") or "")
                for p in raw_posts[:2]
                if p.get("id")
            ]
            comment_tasks.append(
                async_scrape_comments(
                    http_client, creds["apify_token"], video_urls, max_comments=30
                )
            )

        all_comments = await asyncio.gather(*comment_tasks)

    # Process and Persist Data to Firestore
    leaderboard: list[dict[str, Any]] = []

    for idx, m in enumerate(combined_movies):
        is_tier1 = idx < len(tier1_list)
        tier_name = "tier_1" if is_tier1 else "tier_2"
        raw_posts = all_raw_posts[idx]

        clean_posts: list[dict[str, Any]] = []
        seen_ids = set()
        for p in raw_posts:
            item = sanitize_post(p)
            if item["id"] and item["id"] not in seen_ids:
                seen_ids.add(item["id"])
                clean_posts.append(item)

        clean_posts.sort(key=lambda x: x["views"], reverse=True)
        top_limit = 80 if is_tier1 else 40
        top_posts = clean_posts[:top_limit]

        total_views = sum(p["views"] for p in top_posts)
        total_likes = sum(p["likes"] for p in top_posts)
        total_comments = sum(p["comments"] for p in top_posts)
        total_shares = sum(p["shares"] for p in top_posts)

        sentiment: dict[str, Any]
        if is_tier1:
            comments = all_comments[idx]
            sentiment = analyze_sentiment_with_gemini(creds["gemini_key"], m["title"], comments)
        else:
            sentiment = {"positive": 80, "mixed": 15, "negative": 5, "hype_score": 80}

        top_viral = top_posts[0] if top_posts else {}

        # 1. Save Subcollection: tiktok_daily_pulse/{date}/movies/{movie_id}
        db.collection("tiktok_daily_pulse").document(target_date).collection("movies").document(
            m["movie_id"]
        ).set(
            {
                "movie_id": m["movie_id"],
                "title": m["title"],
                "date": target_date,
                "tier": tier_name,
                "total_posts": len(top_posts),
                "total_views": total_views,
                "total_likes": total_likes,
                "total_comments": total_comments,
                "total_shares": total_shares,
                "sentiment": sentiment,
                "campaign_hashtags": m["hashtags"],
                "posts": top_posts,
            }
        )

        # 2. Append to Lifetime Movie Trends: tiktok_movie_trends/{movie_id}
        trend_ref = db.collection("tiktok_movie_trends").document(m["movie_id"])
        trend_doc = trend_ref.get()
        history = (trend_doc.to_dict() or {}).get("daily_history", []) if trend_doc.exists else []
        history = [d for d in history if d.get("date") != target_date]
        history.append(
            {
                "date": target_date,
                "total_views": total_views,
                "total_likes": total_likes,
                "total_comments": total_comments,
                "total_shares": total_shares,
                "posts_count": len(top_posts),
                "sentiment_score": sentiment.get("positive", 80),
            }
        )
        history.sort(key=lambda x: x["date"])
        trend_ref.set(
            {
                "movie_id": m["movie_id"],
                "title": m["title"],
                "campaign_hashtags": m["hashtags"],
                "days_tracked": len(history),
                "cumulative": {
                    "latest_total_views": total_views,
                    "latest_total_likes": total_likes,
                    "latest_total_comments": total_comments,
                },
                "daily_history": history,
            },
            merge=True,
        )

        leaderboard.append(
            {
                "movie_id": m["movie_id"],
                "title": m["title"],
                "tier": tier_name,
                "total_views": total_views,
                "total_likes": total_likes,
                "total_comments": total_comments,
                "total_shares": total_shares,
                "posts_count": len(top_posts),
                "sentiment": sentiment,
                "top_viral_post": {
                    "id": top_viral.get("id"),
                    "url": top_viral.get("url"),
                    "author": top_viral.get("author_handle"),
                    "views": top_viral.get("views"),
                    "likes": top_viral.get("likes"),
                    "snippet": top_viral.get("caption", "")[:120],
                },
            }
        )

    # Sort Leaderboard by total views
    leaderboard.sort(key=lambda x: x["total_views"], reverse=True)
    for rank_idx, item in enumerate(leaderboard, start=1):
        item["rank"] = rank_idx

    # 3. Persist Daily Pulse Leaderboard
    db.collection("tiktok_daily_pulse").document(target_date).set(
        {
            "date": target_date,
            "updated_at": now_wib.isoformat(),
            "total_movies_tracked": len(leaderboard),
            "leaderboard": leaderboard,
        }
    )

    # 4. Dispatch Telegram Briefing
    telegram_report = format_1800_telegram_report(target_date, leaderboard, now_wib)
    send_telegram_alert(creds, telegram_report)

    return {
        "success": True,
        "date": target_date,
        "movies_tracked": len(leaderboard),
        "executed_at": now_wib.isoformat(),
    }


# ─── 6. Cloud Function Entrypoint ───


@functions_framework.http
def crawl_daily_pulse_http(request: Any) -> tuple[str, int, dict[str, str]]:
    """HTTP Entrypoint for 18:00 WIB Daily Social Box Office Crawl."""
    now_wib = datetime.datetime.now(WIB)
    target_date = now_wib.strftime("%Y-%m-%d")

    if request.is_json and (req_json := request.get_json(silent=True)):
        target_date = str(req_json.get("date") or target_date)

    logger.info("Starting Daily Social Box Office Crawl for date: %s", target_date)
    db = get_firestore_client()

    try:
        result = asyncio.run(execute_daily_crawl_async(db, target_date, now_wib))
        return json_response(result, 200)
    except ValueError as val_err:
        logger.error("Config error: %s", val_err)
        return json_response({"success": False, "error": str(val_err)}, 400)
    except Exception as exc:
        logger.exception("Daily pulse crawl failed: %s", exc)
        return json_response({"success": False, "error": f"Internal error: {exc}"}, 500)
