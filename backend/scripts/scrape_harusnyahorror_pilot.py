"""Pilot Script: Scrape Top 100 Viral Posts for 'Harusnya Horror' and persist to Firestore.

Schema Target:
1. Daily Leaderboard / Pulse: `tiktok_daily_pulse/{YYYY-MM-DD}` (Summary object in leaderboard)
2. Lifetime Movie Trend: `tiktok_movie_trends/{movie_id}` (Daily history time-series array)
3. Subcollection Raw Posts: `tiktok_daily_pulse/{YYYY-MM-DD}/movies/{movie_id}` (Top 100 raw post objects)
"""

import datetime
import json
import logging
import os
import sys
from zoneinfo import ZoneInfo
import httpx
from google.cloud import firestore

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("pilot_harusnyahorror")

PROJECT_ID = os.environ.get("GOOGLE_CLOUD_PROJECT", "cineradar-481014")
WIB = ZoneInfo("Asia/Jakarta")

TARGET_DATE = "2026-08-26"
MOVIE_ID = "harusnyahorror"
MOVIE_TITLE = "HARUSNYA HORROR"
HASHTAGS = ["harusnyahorror", "filmharusnyahorror"]


def get_apify_token(db: firestore.Client) -> str:
    doc = db.collection("auth_tokens").document("socials").get()
    token = ""
    if doc.exists:
        token = str((doc.to_dict() or {}).get("apify_api_token", "")).strip()
    token = token or os.environ.get("APIFY_API_TOKEN", "").strip()
    if not token:
        raise ValueError("Apify API token not found in Firestore auth_tokens/socials.")
    return token


def scrape_top_hashtag_posts(apify_token: str, hashtags: list[str], max_posts: int = 100) -> list[dict]:
    """Scrapes top viral TikTok posts for the target hashtags."""
    actor_id = "clockworks~tiktok-scraper"
    url = f"https://api.apify.com/v2/acts/{actor_id}/run-sync-get-dataset-items?token={apify_token}"
    
    # Format hashtags for the actor
    formatted_tags = [f"https://www.tiktok.com/tag/{h.replace('#', '').strip()}" for h in hashtags]
    logger.info("Scraping top %d posts for tags: %s", max_posts, hashtags)

    payload = {
        "hashtags": formatted_tags,
        "resultsPerPage": max_posts,
        "shouldDownloadVideos": False,
        "shouldDownloadCovers": False,
    }

    with httpx.Client(timeout=120.0) as client:
        res = client.post(url, json=payload)
        if res.status_code not in (200, 201):
            raise RuntimeError(f"Apify Actor failed with HTTP {res.status_code}: {res.text[:300]}")
        items = res.json()
        if not isinstance(items, list):
            raise RuntimeError(f"Unexpected Apify response: {type(items)}")
        
        logger.info("Fetched %d raw posts from Apify", len(items))
        return items


def sanitize_post(p: dict) -> dict:
    """Sanitizes raw TikTok post into clean JSON document."""
    post_id = str(p.get("id") or "")
    author_meta = p.get("authorMeta") or {}
    author_name = author_meta.get("name") if isinstance(author_meta, dict) else ""
    author_handle = author_meta.get("nickName") or author_name or p.get("source_handle") or "unknown"
    author_avatar = author_meta.get("avatar") if isinstance(author_meta, dict) else ""

    tags = []
    for t in p.get("hashtags") or []:
        name = t.get("name") if isinstance(t, dict) else t
        if name:
            tags.append(str(name).replace("#", "").lower().strip())

    return {
        "id": post_id,
        "url": str(p.get("webVideoUrl") or p.get("url") or f"https://www.tiktok.com/@{author_name}/video/{post_id}"),
        "author_name": str(author_name),
        "author_handle": str(author_handle),
        "author_avatar": str(author_avatar),
        "caption": str(p.get("text") or p.get("caption") or "")[:600],
        "hashtags": sorted(list(set(tags))),
        "views": int(p.get("playCount") or p.get("views") or 0),
        "likes": int(p.get("diggCount") or p.get("likes") or 0),
        "comments": int(p.get("commentCount") or 0),
        "shares": int(p.get("shareCount") or 0),
        "bookmarks": int(p.get("collectCount") or 0),
        "published_at": str(p.get("createTimeISO") or p.get("published_at") or ""),
    }


def main():
    db = firestore.Client(project=PROJECT_ID)
    apify_token = get_apify_token(db)
    
    # 1. Scrape Apify
    raw_posts = scrape_top_hashtag_posts(apify_token, HASHTAGS, max_posts=100)
    if not raw_posts:
        logger.error("No posts returned.")
        sys.exit(1)

    # Sanitize and deduplicate by post_id
    seen_ids = set()
    sanitized_posts = []
    for p in raw_posts:
        item = sanitize_post(p)
        if item["id"] and item["id"] not in seen_ids:
            seen_ids.add(item["id"])
            sanitized_posts.append(item)

    # Sort descending by views (top viral)
    sanitized_posts.sort(key=lambda x: x["views"], reverse=True)
    top_100_posts = sanitized_posts[:100]

    total_views = sum(p["views"] for p in top_100_posts)
    total_likes = sum(p["likes"] for p in top_100_posts)
    total_comments = sum(p["comments"] for p in top_100_posts)
    total_shares = sum(p["shares"] for p in top_100_posts)

    logger.info("=== SCRAPE SUMMARY FOR %s ===", MOVIE_TITLE)
    logger.info("Total Posts Captured: %d", len(top_100_posts))
    logger.info("Total Viral Views: %s", f"{total_views:,}")
    logger.info("Total Likes: %s", f"{total_likes:,}")
    logger.info("Total Comments: %s", f"{total_comments:,}")

    top_viral_post = top_100_posts[0] if top_100_posts else {}

    # ─── 2. Write to Firestore ───

    now_iso = datetime.datetime.now(WIB).isoformat()

    # A. Subcollection: `tiktok_daily_pulse/{date}/movies/{movie_id}`
    subcoll_ref = db.collection("tiktok_daily_pulse").document(TARGET_DATE).collection("movies").document(MOVIE_ID)
    subcoll_ref.set({
        "movie_id": MOVIE_ID,
        "title": MOVIE_TITLE,
        "date": TARGET_DATE,
        "crawled_at": now_iso,
        "total_posts": len(top_100_posts),
        "total_views": total_views,
        "total_likes": total_likes,
        "total_comments": total_comments,
        "total_shares": total_shares,
        "campaign_hashtags": HASHTAGS,
        "posts": top_100_posts,
    })
    logger.info("✓ Written %d raw posts to tiktok_daily_pulse/%s/movies/%s", len(top_100_posts), TARGET_DATE, MOVIE_ID)

    # B. Daily Leaderboard Summary: `tiktok_daily_pulse/{date}`
    daily_pulse_ref = db.collection("tiktok_daily_pulse").document(TARGET_DATE)
    daily_doc = daily_pulse_ref.get()
    current_leaderboard = (daily_doc.to_dict() or {}).get("leaderboard", []) if daily_doc.exists else []

    # Update or insert Harusnya Horror entry in leaderboard
    summary_entry = {
        "movie_id": MOVIE_ID,
        "title": MOVIE_TITLE,
        "total_views": total_views,
        "total_likes": total_likes,
        "total_comments": total_comments,
        "total_shares": total_shares,
        "posts_count": len(top_100_posts),
        "top_viral_post": {
            "id": top_viral_post.get("id"),
            "url": top_viral_post.get("url"),
            "author": top_viral_post.get("author_handle"),
            "views": top_viral_post.get("views"),
            "likes": top_viral_post.get("likes"),
            "snippet": top_viral_post.get("caption", "")[:120],
        },
    }

    # Upsert in leaderboard list
    new_leaderboard = [entry for entry in current_leaderboard if entry.get("movie_id") != MOVIE_ID]
    new_leaderboard.append(summary_entry)
    new_leaderboard.sort(key=lambda x: x["total_views"], reverse=True)
    for idx, item in enumerate(new_leaderboard, start=1):
        item["rank"] = idx

    daily_pulse_ref.set({
        "date": TARGET_DATE,
        "updated_at": now_iso,
        "total_movies_tracked": len(new_leaderboard),
        "leaderboard": new_leaderboard,
    }, merge=True)
    logger.info("✓ Updated daily leaderboard in tiktok_daily_pulse/%s", TARGET_DATE)

    # C. Lifetime Movie Trend: `tiktok_movie_trends/{movie_id}`
    trend_ref = db.collection("tiktok_movie_trends").document(MOVIE_ID)
    trend_doc = trend_ref.get()
    trend_data = trend_doc.to_dict() or {} if trend_doc.exists else {}

    daily_history = trend_data.get("daily_history", [])
    # Filter out today if already exists to make it idempotent
    daily_history = [d for d in daily_history if d.get("date") != TARGET_DATE]
    daily_history.append({
        "date": TARGET_DATE,
        "total_views": total_views,
        "total_likes": total_likes,
        "total_comments": total_comments,
        "total_shares": total_shares,
        "posts_count": len(top_100_posts),
    })
    daily_history.sort(key=lambda x: x["date"])

    trend_ref.set({
        "movie_id": MOVIE_ID,
        "title": MOVIE_TITLE,
        "campaign_hashtags": HASHTAGS,
        "first_tracked_at": daily_history[0]["date"] if daily_history else TARGET_DATE,
        "latest_tracked_at": TARGET_DATE,
        "days_tracked": len(daily_history),
        "cumulative": {
            "latest_total_views": total_views,
            "latest_total_likes": total_likes,
            "latest_total_comments": total_comments,
            "latest_total_shares": total_shares,
        },
        "daily_history": daily_history,
    }, merge=True)
    logger.info("✓ Updated lifetime trend history in tiktok_movie_trends/%s", MOVIE_ID)


if __name__ == "__main__":
    main()
