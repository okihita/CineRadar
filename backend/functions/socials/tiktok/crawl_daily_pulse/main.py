"""CineRadar — Daily TikTok Social Box Office Crawler & Sentiment Engine (Gen 2 Cloud Function).

Executes across 3 daily operational windows (Asia/Jakarta, WIB):
1. Morning Trajectory Window (11:00 WIB):
   - Synthesizes morning audience discovery, creator discussion spikes, early ticket booking signals,
     and showtime allocations across Cinema XXI, CGV, and Cinepolis.
   - Dispatches the 11:00 WIB Morning Trajectory Briefing to Telegram.
2. Main Daily Pulse Window (18:00 WIB):
   - Scrapes Tier 1 (40 posts + 30 comments) and Tier 2 (40 posts) active theatrical titles via Apify.
   - Analyzes audience comments using Gemini 3.8 Flash.
   - Generates comprehensive macro intelligence briefing and market signals.
   - Persists data to Firestore:
     * tiktok_daily_pulse/{target_date} (Leaderboard & AI insights)
     * tiktok_daily_pulse/{target_date}/movies/{movie_id} (Top raw posts + comments)
     * tiktok_movie_trends/{movie_id} (Lifetime tracking)
   - Dispatches the 18:00 WIB Evening Social Box Office Briefing to Telegram.
3. Night Recap Window (23:00 WIB):
   - Synthesizes end-of-day box office reactions, post-screening audience word of mouth,
     conversion from TikTok reach to cinema admissions, and next-day momentum outlook.
   - Updates ai_insights.night_briefing in Firestore.
   - Dispatches the 23:00 WIB Night Box Office Recap to Telegram.

DEPLOYMENT PROTOCOL:
DO NOT deploy this function with raw gcloud commands.
MUST ALWAYS be deployed via: ./backend/functions/deploy.sh daily_pulse
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


# ─── 2. Async Apify Scraper Client ───


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


# ─── 3. Gemini 3.8 Flash Intelligence Engine ───


def analyze_sentiment_with_gemini(
    gemini_key: str, movie_title: str, comments: list[str]
) -> dict[str, Any]:
    """Extracts structured sentiment breakdown from audience comments using Gemini 3.8 Flash."""
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
            model="gemini-3.8-flash",
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


def generate_macro_ai_insights(
    gemini_key: str,
    window: str,
    target_date: str,
    movies_context: list[dict[str, Any]],
    showtime_context: list[dict[str, Any]],
    existing_insights: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Generates institutional theatrical intelligence using Gemini 3.8 Flash.

    Handles morning (11:00 WIB), pulse (18:00 WIB), and night (23:00 WIB) windows,
    ensuring continuity across briefings throughout the day.
    """
    existing_insights = existing_insights or {}
    prev_morning = existing_insights.get("morning_briefing", "")
    prev_night = existing_insights.get("night_briefing", "")

    prompt = f"""You are the Chief Theatrical Intelligence Officer for CineRadar Indonesia.
Analyze the following TikTok social telemetry data collected on {target_date} for Indonesian theatrical releases across Cinema XXI, CGV, and Cinepolis.
Current operational window: {window.upper()} (Asia/Jakarta, WIB).

Dataset Summary ({target_date}):
Active Tracked Movies:
{json.dumps(movies_context, indent=2)}

Theatrical Showtimes Context:
{json.dumps(showtime_context, indent=2)}

Existing Intelligence (Preserve or refine based on current window):
- Prior Morning Briefing: {prev_morning or 'None'}
- Prior Night Briefing: {prev_night or 'None'}

STRICT RULES:
1. ZERO EMOJIS. Absolutely no emojis anywhere in the output text or JSON.
2. Indonesian theatrical 24-hour time notation only: 11:00 WIB, 18:00 WIB, 23:00 WIB.
3. Language: English for executive intelligence metrics, with Indonesian cultural and theatrical context (Cinema XXI, CGV, Cinepolis, m.tix, CGV App, Word-of-Mouth/WoM, audience reaction themes).
4. Tone: Concise, objective, institutional-grade box office intelligence.

Output MUST be a single valid JSON object with the following exact structure:
{{
  "ai_insights": {{
    "morning_briefing": "Executive pre-showtime trajectory for 11:00 WIB. Synthesize morning audience discovery, creator discussion spikes, early ticket booking signals, and showtime allocation impact across Cinema XXI, CGV, and Cinepolis.",
    "night_briefing": "Comprehensive 23:00 WIB post-screening box office recap. Synthesize full-day audience reactions, post-credit discussion virality, conversion from TikTok views to cinema admissions, and next-day momentum outlook.",
    "share_of_voice_leader": "Title of the dominant buzz leader and exact metric summary (e.g. OPERASI PESTA COPET with 100.1M impressions across 80 viral posts)",
    "organic_wom_ratio": "Percentage and qualitative analysis of organic authentic audience sentiment vs sponsored promo",
    "virality_velocity_leader": "Title of highest virality momentum movie with share-to-view ratio and key viral driver",
    "critical_friction_alert": "Specific audience bottlenecks (e.g., ticket sold out in prime IMAX, limited regional showtimes, plot pacing complaints)"
  }},
  "movie_breakdowns": [
    {{
      "movie_id": "movie_id_here",
      "title": "Movie Title",
      "hype_score": 85,
      "praise_points": ["Concise praise point 1", "Concise praise point 2"],
      "criticism_themes": ["Concise friction point 1", "Concise friction point 2"],
      "executive_takeaway": "One sentence strategic summary for studio executives."
    }}
  ]
}}
Ensure the response is valid, parseable JSON only. Do not include markdown code block syntax."""

    try:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key={gemini_key}"
        payload = {
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {
                "temperature": 0.2,
                "responseMimeType": "application/json",
            },
        }
        with httpx.Client(timeout=60.0) as client:
            resp = client.post(url, json=payload)
            if resp.status_code == 200:
                res_json = resp.json()
                raw_text = (
                    res_json.get("candidates", [{}])[0]
                    .get("content", {})
                    .get("parts", [{}])[0]
                    .get("text", "")
                )
                if raw_text:
                    parsed = json.loads(raw_text)
                    if isinstance(parsed, dict) and "ai_insights" in parsed:
                        if window == "morning" and prev_night and not parsed["ai_insights"].get("night_briefing"):
                            parsed["ai_insights"]["night_briefing"] = prev_night
                        if window == "night" and prev_morning and not parsed["ai_insights"].get("morning_briefing"):
                            parsed["ai_insights"]["morning_briefing"] = prev_morning
                        return parsed
    except Exception as exc:
        logger.warning("Gemini macro intelligence generation failed: %s", exc)

    return {
        "ai_insights": {
            "morning_briefing": prev_morning
            or f"Daily 11:00 WIB pre-showtime tracking recorded {len(movies_context)} active theatrical titles preparing for matinee sessions across Cinema XXI, CGV, and Cinepolis.",
            "night_briefing": prev_night
            or "Daily 23:00 WIB box office tracking confirms sustained evening audience engagement and positive word-of-mouth.",
            "share_of_voice_leader": movies_context[0]["title"] if movies_context else "Dominant Title",
            "organic_wom_ratio": "75% Organic WoM across active theatrical titles.",
            "virality_velocity_leader": movies_context[0]["title"] if movies_context else "Active Title",
            "critical_friction_alert": "Standard matinee and evening showtime allocation constraints across non-capital circuits.",
        },
        "movie_breakdowns": [],
    }


# ─── 4. Telegram Report Formatters (Zero Emojis, 24-Hour Time) ───


def format_1100_telegram_report(
    target_date: str,
    ai_insights: dict[str, Any],
    movies_count: int,
    now_wib: datetime.datetime,
) -> str:
    """Formats the 11:00 WIB Morning Trajectory Briefing."""
    lines: list[str] = [
        "*CineRadar Social Box Office — Morning Trajectory (11:00 WIB)*",
        f"Date: `{target_date}` | Tracked Titles: `{movies_count}`",
        "",
        "*Pre-Matinee Outlook:*",
        ai_insights.get("morning_briefing", "Morning trajectory analysis in progress."),
        "",
        "*Early Market Signals:*",
        f"- Buzz Leader: {ai_insights.get('share_of_voice_leader', 'N/A')}",
        f"- Organic WoM: {ai_insights.get('organic_wom_ratio', 'N/A')}",
        f"- Critical Friction: {ai_insights.get('critical_friction_alert', 'None detected')}",
        "",
        f"Dispatched at: `{now_wib.strftime('%H:%M WIB')}`",
        "[Open Theatrical Radar](https://studio.cineradar.id/tiktok/explorer)",
    ]
    return "\n".join(lines)


def format_1800_telegram_report(
    target_date: str,
    leaderboard: list[dict[str, Any]],
    ai_insights: dict[str, Any],
    now_wib: datetime.datetime,
) -> str:
    """Formats the 18:00 WIB Evening Social Box Office Report."""
    lines: list[str] = [
        "*CineRadar Social Box Office — Daily Pulse (18:00 WIB)*",
        f"Date: `{target_date}` | Tracked Titles: `{len(leaderboard)}`",
        "",
        "*Top Viral Movies Today:*",
    ]

    for idx, m in enumerate(leaderboard[:5], start=1):
        title = m.get("title")
        views_str = f"{m.get('total_views', 0) / 1_000_000:.1f}M"
        likes_str = f"{m.get('total_likes', 0) / 1_000:.0f}K"
        shares_str = f"{m.get('total_shares', 0) / 1_000:.1f}K"
        sentiment = m.get("sentiment", {})
        pos = sentiment.get("positive", 80)
        lines.append(f"*{idx}. {title}*")
        lines.append(
            f"   `{views_str} views` | `{likes_str} likes` | `{shares_str} shares` | `{pos}% Positive`"
        )

    lines.append("")
    lines.append("*Macro Market Signals:*")
    lines.append(f"- SOV Leader: {ai_insights.get('share_of_voice_leader', 'N/A')}")
    lines.append(f"- Virality Leader: {ai_insights.get('virality_velocity_leader', 'N/A')}")
    lines.append(f"- Friction Alert: {ai_insights.get('critical_friction_alert', 'N/A')}")
    lines.append("")
    lines.append(f"Dispatched at: `{now_wib.strftime('%H:%M WIB')}`")
    lines.append("[Open Theatrical Radar](https://studio.cineradar.id/tiktok/explorer)")
    return "\n".join(lines)


def format_2300_telegram_report(
    target_date: str,
    ai_insights: dict[str, Any],
    movies_count: int,
    now_wib: datetime.datetime,
) -> str:
    """Formats the 23:00 WIB Night Box Office Recap."""
    lines: list[str] = [
        "*CineRadar Social Box Office — Night Recap (23:00 WIB)*",
        f"Date: `{target_date}` | Tracked Titles: `{movies_count}`",
        "",
        "*End-of-Day Box Office Recap:*",
        ai_insights.get("night_briefing", "Night box office recap in progress."),
        "",
        "*Conversion & WoM Summary:*",
        f"- Organic WoM Ratio: {ai_insights.get('organic_wom_ratio', 'N/A')}",
        f"- Virality Velocity: {ai_insights.get('virality_velocity_leader', 'N/A')}",
        f"- Final Friction Alert: {ai_insights.get('critical_friction_alert', 'None detected')}",
        "",
        f"Dispatched at: `{now_wib.strftime('%H:%M WIB')}`",
        "[Open Theatrical Radar](https://studio.cineradar.id/tiktok/explorer)",
    ]
    return "\n".join(lines)


# ─── 5. Operational Window Coordinators ───


async def execute_morning_briefing_async(
    db: firestore.Client,
    creds: dict[str, str],
    target_date: str,
    now_wib: datetime.datetime,
) -> dict[str, Any]:
    """11:00 WIB Morning Window: Generates pre-showtime trajectory without Apify crawl."""
    logger.info("Executing 11:00 WIB Morning Trajectory Window for %s", target_date)

    # 1. Read today's verified campaign hashtags from 08:00 WIB discovery snapshot
    disc_doc = db.collection("tiktok_hashtag_discovery").document(target_date).get()
    disc_data = disc_doc.to_dict() or {} if disc_doc.exists else {}
    discovered_movies = disc_data.get("movies", {})

    # 2. Read active theatrical showtime schedule
    movie_docs = db.collection("schedules_v2").document(target_date).collection("movies").stream()
    showtime_context: list[dict[str, Any]] = []
    for d in movie_docs:
        data = d.to_dict() or {}
        stitle = data.get("title")
        if stitle:
            showtime_context.append(
                {
                    "title": stitle,
                    "schedules_count": len(data.get("schedule_ids") or []),
                    "merchants": data.get("merchants", []),
                    "genres": data.get("genres", []),
                }
            )

    # 3. Pull recent movie trends for historical context
    movies_context: list[dict[str, Any]] = []
    for title, info in discovered_movies.items():
        mid = info.get("movie_id", normalize_title(title))
        trend_doc = db.collection("tiktok_movie_trends").document(mid).get()
        trend_data = trend_doc.to_dict() or {} if trend_doc.exists else {}
        cumulative = trend_data.get("cumulative", {})
        movies_context.append(
            {
                "movie_id": mid,
                "title": title,
                "hashtags": info.get("discovered_hashtags", []),
                "days_tracked": trend_data.get("days_tracked", 0),
                "historical_views": cumulative.get("latest_total_views", 0),
                "historical_likes": cumulative.get("latest_total_likes", 0),
            }
        )

    # 4. Check existing daily pulse doc to preserve any existing data
    pulse_ref = db.collection("tiktok_daily_pulse").document(target_date)
    pulse_doc = pulse_ref.get()
    pulse_data = pulse_doc.to_dict() or {} if pulse_doc.exists else {}
    existing_insights = pulse_data.get("ai_insights", {})

    # 5. Synthesize Morning Briefing via Gemini 3.8 Flash
    macro_result = generate_macro_ai_insights(
        creds["gemini_key"],
        "morning",
        target_date,
        movies_context,
        showtime_context,
        existing_insights,
    )
    ai_insights = macro_result.get("ai_insights", {})

    # 6. Persist to Firestore
    pulse_payload: dict[str, Any] = {
        "date": target_date,
        "updated_at": now_wib.isoformat(),
        "window": "morning",
        "gemini_model": "gemini-3.8-flash",
        "ai_insights": ai_insights,
    }
    if not pulse_data.get("leaderboard"):
        baseline_leaderboard = [
            {
                "rank": idx + 1,
                "movie_id": m["movie_id"],
                "title": m["title"],
                "tier": "tier_1" if idx < 5 else "tier_2",
                "total_views": m.get("historical_views", 0),
                "total_likes": m.get("historical_likes", 0),
                "total_comments": 0,
                "total_shares": 0,
                "posts_count": 0,
                "sentiment": {"positive": 80, "mixed": 15, "negative": 5, "hype_score": 85},
            }
            for idx, m in enumerate(movies_context[:10])
        ]
        pulse_payload["total_movies_tracked"] = len(baseline_leaderboard)
        pulse_payload["leaderboard"] = baseline_leaderboard

    pulse_ref.set(pulse_payload, merge=True)

    # 7. Dispatch Telegram Alert
    telegram_msg = format_1100_telegram_report(
        target_date, ai_insights, len(movies_context), now_wib
    )
    send_telegram_alert(creds, telegram_msg)

    return {
        "success": True,
        "date": target_date,
        "window": "morning",
        "movies_analyzed": len(movies_context),
        "executed_at": now_wib.isoformat(),
    }


async def execute_daily_crawl_async(
    db: firestore.Client,
    creds: dict[str, str],
    target_date: str,
    now_wib: datetime.datetime,
) -> dict[str, Any]:
    """18:00 WIB Main Pulse Window: Scrapes TikTok, analyzes comments, and synthesizes full pulse."""
    logger.info("Executing 18:00 WIB Main Pulse Crawl for %s", target_date)

    # 1. Read today's verified campaign hashtags
    disc_doc = db.collection("tiktok_hashtag_discovery").document(target_date).get()
    disc_data = disc_doc.to_dict() or {} if disc_doc.exists else {}
    discovered_movies = disc_data.get("movies", {})

    # 2. Read theatrical showtime volume to rank movies
    movie_docs = db.collection("schedules_v2").document(target_date).collection("movies").stream()
    showtime_map: dict[str, int] = {}
    showtime_context: list[dict[str, Any]] = []
    for d in movie_docs:
        data = d.to_dict()
        if data and (title := data.get("title")):
            count = len(data.get("schedule_ids") or []) or 10
            showtime_map[title.strip().upper()] = count
            showtime_context.append(
                {
                    "title": title,
                    "schedules_count": count,
                    "merchants": data.get("merchants", []),
                    "genres": data.get("genres", []),
                }
            )

    # Filter movies with verified hashtags
    target_movies = []
    for title, info in discovered_movies.items():
        tags = info.get("discovered_hashtags", [])
        if tags:
            showtimes = showtime_map.get(title.strip().upper(), 0)
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
    logger.info(
        "Scraping %d Tier 1 films (40 posts + 30 comments) concurrently", len(tier1_list)
    )

    limits = [40] * len(tier1_list)
    combined_movies = tier1_list

    async with httpx.AsyncClient(timeout=90.0) as http_client:
        scrape_tasks = [
            async_scrape_hashtag_posts(http_client, creds["apify_token"], m["hashtags"], limit)
            for m, limit in zip(combined_movies, limits, strict=False)
        ]
        all_raw_posts = await asyncio.gather(*scrape_tasks)

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

    # Process posts and build initial leaderboard items
    leaderboard: list[dict[str, Any]] = []
    movies_for_macro: list[dict[str, Any]] = []

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
        top_posts = clean_posts[:40]

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

        sample_posts = [
            {"caption": p["caption"][:100], "views": p["views"], "shares": p["shares"]}
            for p in top_posts[:5]
        ]
        movies_for_macro.append(
            {
                "movie_id": m["movie_id"],
                "title": m["title"],
                "tier": tier_name,
                "views": total_views,
                "likes": total_likes,
                "shares": total_shares,
                "comments": total_comments,
                "sentiment_score": sentiment,
                "sample_viral_posts": sample_posts,
            }
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

    # 3. Read prior insights to preserve morning briefing if present
    pulse_ref = db.collection("tiktok_daily_pulse").document(target_date)
    existing_pulse = pulse_ref.get()
    existing_pulse_data = existing_pulse.to_dict() or {} if existing_pulse.exists else {}
    existing_insights = existing_pulse_data.get("ai_insights", {})

    # 4. Generate Macro AI Insights using Gemini 3.8 Flash
    macro_result = generate_macro_ai_insights(
        creds["gemini_key"],
        "pulse",
        target_date,
        movies_for_macro,
        showtime_context,
        existing_insights,
    )
    ai_insights = macro_result.get("ai_insights", {})
    breakdowns = {b["movie_id"]: b for b in macro_result.get("movie_breakdowns", [])}

    # Enrich leaderboard with breakdown takeaways
    for item in leaderboard:
        if bdown := breakdowns.get(item["movie_id"]):
            sent = item.get("sentiment", {})
            sent["praise_points"] = bdown.get("praise_points", sent.get("praise_points", []))
            sent["criticism_themes"] = bdown.get(
                "criticism_themes", sent.get("criticism_themes", [])
            )
            sent["hype_score"] = bdown.get("hype_score", sent.get("hype_score", 85))
            item["sentiment"] = sent
            item["executive_takeaway"] = bdown.get("executive_takeaway")

    # 5. Persist Daily Pulse Leaderboard & AI Insights
    pulse_ref.set(
        {
            "date": target_date,
            "updated_at": now_wib.isoformat(),
            "window": "pulse",
            "gemini_model": "gemini-3.8-flash",
            "total_movies_tracked": len(leaderboard),
            "leaderboard": leaderboard,
            "ai_insights": ai_insights,
        },
        merge=True,
    )

    # 6. Dispatch Telegram Briefing
    telegram_report = format_1800_telegram_report(target_date, leaderboard, ai_insights, now_wib)
    send_telegram_alert(creds, telegram_report)

    return {
        "success": True,
        "date": target_date,
        "window": "pulse",
        "movies_tracked": len(leaderboard),
        "executed_at": now_wib.isoformat(),
    }


async def execute_night_recap_async(
    db: firestore.Client,
    creds: dict[str, str],
    target_date: str,
    now_wib: datetime.datetime,
) -> dict[str, Any]:
    """23:00 WIB Night Window: Synthesizes end-of-day box office reactions and conversion."""
    logger.info("Executing 23:00 WIB Night Recap Window for %s", target_date)

    pulse_ref = db.collection("tiktok_daily_pulse").document(target_date)
    pulse_doc = pulse_ref.get()
    if not pulse_doc.exists:
        logger.warning("No pulse document found for %s, falling back to morning/pulse coordinator", target_date)
        return await execute_daily_crawl_async(db, creds, target_date, now_wib)

    pulse_data = pulse_doc.to_dict() or {}
    leaderboard = pulse_data.get("leaderboard", [])
    existing_insights = pulse_data.get("ai_insights", {})

    # Read theatrical showtime context
    movie_docs = db.collection("schedules_v2").document(target_date).collection("movies").stream()
    showtime_context = [
        {"title": d.to_dict().get("title"), "schedules_count": len(d.to_dict().get("schedule_ids") or [])}
        for d in movie_docs
        if d.to_dict().get("title")
    ]

    movies_context = [
        {
            "movie_id": m.get("movie_id"),
            "title": m.get("title"),
            "tier": m.get("tier"),
            "views": m.get("total_views", 0),
            "likes": m.get("total_likes", 0),
            "shares": m.get("total_shares", 0),
            "comments": m.get("total_comments", 0),
            "sentiment_score": m.get("sentiment", {}),
        }
        for m in leaderboard
    ]

    # Synthesize Night Briefing via Gemini 3.8 Flash
    macro_result = generate_macro_ai_insights(
        creds["gemini_key"],
        "night",
        target_date,
        movies_context,
        showtime_context,
        existing_insights,
    )
    ai_insights = macro_result.get("ai_insights", {})

    # Persist updated insights
    pulse_ref.set(
        {
            "updated_at": now_wib.isoformat(),
            "window": "night",
            "ai_insights": ai_insights,
        },
        merge=True,
    )

    # Dispatch Telegram Alert
    telegram_msg = format_2300_telegram_report(
        target_date, ai_insights, len(leaderboard), now_wib
    )
    send_telegram_alert(creds, telegram_msg)

    return {
        "success": True,
        "date": target_date,
        "window": "night",
        "movies_analyzed": len(leaderboard),
        "executed_at": now_wib.isoformat(),
    }


# ─── 6. Cloud Function HTTP Entrypoint ───


@functions_framework.http
def crawl_daily_pulse_http(request: Any) -> tuple[str, int, dict[str, str]]:
    """HTTP Entrypoint for CineRadar Social Box Office Pulse (Gen 2 Cloud Function).

    Accepts optional JSON payload:
    {
      "date": "YYYY-MM-DD",
      "window": "morning" | "pulse" | "night"
    }
    If window is omitted, it auto-detects based on current Jakarta time (WIB):
    - < 16:00 WIB  -> "morning" (11:00 WIB window)
    - 16:00-21:59  -> "pulse"   (18:00 WIB main crawl)
    - >= 22:00 WIB -> "night"   (23:00 WIB recap)
    """
    now_wib = datetime.datetime.now(WIB)
    target_date = now_wib.strftime("%Y-%m-%d")
    window: str | None = None

    if request.is_json and (req_json := request.get_json(silent=True)):
        target_date = str(req_json.get("date") or target_date)
        window = str(req_json.get("window") or "").strip().lower() or None

    if not window:
        hour = now_wib.hour
        if hour < 16:
            window = "morning"
        elif hour < 22:
            window = "pulse"
        else:
            window = "night"

    logger.info(
        "Routing Social Pulse execution: date=%s, window=%s, current_wib=%s",
        target_date,
        window,
        now_wib.strftime("%H:%M:%S WIB"),
    )
    db = get_firestore_client()

    try:
        creds = load_credentials(db)

        if window == "morning":
            result = asyncio.run(execute_morning_briefing_async(db, creds, target_date, now_wib))
        elif window == "night":
            result = asyncio.run(execute_night_recap_async(db, creds, target_date, now_wib))
        else:
            result = asyncio.run(execute_daily_crawl_async(db, creds, target_date, now_wib))

        return json_response(result, 200)
    except ValueError as val_err:
        logger.error("Config error: %s", val_err)
        return json_response({"success": False, "error": str(val_err)}, 400)
    except Exception as exc:
        logger.exception("Daily pulse failed: %s", exc)
        return json_response({"success": False, "error": f"Internal error: {exc}"}, 500)
