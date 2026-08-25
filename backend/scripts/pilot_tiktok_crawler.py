"""TikTok Pilot Crawler for CineRadar.

This script executes a 3-stage pilot workflow:
1. Scan a hashtag for top TikTok posts (metadata + metrics).
2. Fetch top comments for high-engagement posts.
3. Normalize data into CineRadar's FirestoreSocialPost format.
4. (Optional) Run Gemini AI sentiment and audience buzz analysis.

Usage:
    # Dry run with sample payload (no Apify token required):
    uv run python backend/scripts/pilot_tiktok_crawler.py --hashtag filmindonesia --dry-run

    # Live run with Apify API token:
    APIFY_API_TOKEN="your_token" uv run python backend/scripts/pilot_tiktok_crawler.py --hashtag filmindonesia --limit 10 --comments-per-post 15
"""

from __future__ import annotations

import argparse
import json
import os
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from dotenv import load_dotenv

load_dotenv()

APIFY_API_TOKEN = os.getenv("APIFY_API_TOKEN")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")


def create_sample_mock_data(hashtag: str) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    """Generates realistic sample TikTok posts and comments for testing without an API key."""
    clean_tag = hashtag.lstrip("#").lower()
    posts = [
        {
            "id": "7391204859123849102",
            "text": f"Gak nyangka plot twist film ini gokil banget! Wajib nonton weekend ini. #{clean_tag} #BioskopIndonesia #ReviewFilm",
            "createTime": int(datetime.now(UTC).timestamp()) - 7200,
            "webVideoUrl": "https://www.tiktok.com/@bioskopmania/video/7391204859123849102",
            "authorMeta": {
                "id": "bioskopmania_id",
                "name": "bioskopmania",
                "nickName": "Bioskop Mania ID",
                "avatar": "https://p16-sign.tiktokcdn.com/avatar1.jpeg",
                "verified": True,
            },
            "musicMeta": {
                "musicName": "Original Sound - Bioskop Mania",
            },
            "playCount": 184500,
            "diggCount": 24300,
            "commentCount": 380,
            "shareCount": 1420,
        },
        {
            "id": "7391305928194857201",
            "text": f"Official Teaser Trailer sudah rilis di bioskop XXI, CGV, Cinepolis! Catat tanggal tayangnya. #{clean_tag} #OfficialTrailer",
            "createTime": int(datetime.now(UTC).timestamp()) - 14400,
            "webVideoUrl": "https://www.tiktok.com/@mdentertainment/video/7391305928194857201",
            "authorMeta": {
                "id": "mdentertainment_id",
                "name": "mdentertainment",
                "nickName": "MD Entertainment",
                "avatar": "https://p16-sign.tiktokcdn.com/avatar2.jpeg",
                "verified": True,
            },
            "musicMeta": {
                "musicName": "Epic Cinematic Soundtrack",
            },
            "playCount": 350200,
            "diggCount": 42100,
            "commentCount": 612,
            "shareCount": 3890,
        },
    ]

    comments = [
        {
            "videoId": "7391204859123849102",
            "id": "c101",
            "text": "Akting aktor utamanya keren banget, merinding pas scene terakhir!",
            "diggCount": 142,
            "authorName": "cinemalover_jkt",
            "createTime": int(datetime.now(UTC).timestamp()) - 3600,
        },
        {
            "videoId": "7391204859123849102",
            "id": "c102",
            "text": "Tiket XXI di kotaku udah sold out dari kemarin, terpaksa nonton CGV besok.",
            "diggCount": 89,
            "authorName": "rendy_moviefan",
            "createTime": int(datetime.now(UTC).timestamp()) - 3000,
        },
        {
            "videoId": "7391204859123849102",
            "id": "c103",
            "text": "Pacingnya agak lambat di tengah, tapi endingnya memuaskan 8/10.",
            "diggCount": 45,
            "authorName": "critic_id",
            "createTime": int(datetime.now(UTC).timestamp()) - 2400,
        },
        {
            "videoId": "7391305928194857201",
            "id": "c201",
            "text": "Penasaran banget! Udah nunggu sekuel ini dari tahun lalu.",
            "diggCount": 210,
            "authorName": "siti_nur",
            "createTime": int(datetime.now(UTC).timestamp()) - 7000,
        },
        {
            "videoId": "7391305928194857201",
            "id": "c202",
            "text": "Semoga dapet jatah layar banyak di Cinepolis & XXI daerah luar Jawa.",
            "diggCount": 67,
            "authorName": "filmnusantara",
            "createTime": int(datetime.now(UTC).timestamp()) - 6500,
        },
    ]
    return posts, comments


def run_apify_hashtag_search(
    client: Any, hashtag: str, limit: int
) -> list[dict[str, Any]]:
    """Runs Apify clockworks/tiktok-scraper for hashtag discovery."""
    clean_tag = hashtag.lstrip("#").lower()
    print(f"[*] Querying Apify for hashtag: #{clean_tag} (limit: {limit} posts)...")
    run_input = {
        "hashtags": [clean_tag],
        "resultsPerPage": limit,
        "shouldDownloadVideos": False,
        "shouldDownloadCovers": False,
    }
    run = client.actor("clockworks/tiktok-scraper").call(run_input=run_input)
    dataset_id = getattr(run, "default_dataset_id", None) or (run.get("defaultDatasetId") if isinstance(run, dict) else "")
    items = list(client.dataset(dataset_id).iterate_items())
    print(f"[+] Retrieved {len(items)} posts from Apify.")
    return items


def run_apify_comments_scraper(
    client: Any, video_urls: list[str], comments_per_post: int
) -> list[dict[str, Any]]:
    """Runs Apify clockworks/tiktok-comments-scraper for given video URLs."""
    if not video_urls:
        return []
    print(f"[*] Fetching top comments for {len(video_urls)} posts ({comments_per_post} per post)...")
    run_input = {
        "postURLs": video_urls,
        "commentsPerPost": comments_per_post,
        "maxRepliesPerComment": 0,
    }
    run = client.actor("clockworks/tiktok-comments-scraper").call(run_input=run_input)
    dataset_id = getattr(run, "default_dataset_id", None) or (run.get("defaultDatasetId") if isinstance(run, dict) else "")
    comments = list(client.dataset(dataset_id).iterate_items())
    print(f"[+] Retrieved {len(comments)} comments from Apify.")
    return comments


def normalize_to_cineradar_post(raw: dict[str, Any]) -> dict[str, Any]:
    """Transforms raw TikTok post data into CineRadar's FirestoreSocialPost format."""
    post_id = str(raw.get("id") or raw.get("video_id") or "")
    author = raw.get("authorMeta") or raw.get("author") or {}
    stats = raw.get("stats") or {}
    music = raw.get("musicMeta") or raw.get("music") or {}

    published_timestamp = raw.get("createTime") or raw.get("create_time") or 0
    if published_timestamp:
        published_iso = datetime.fromtimestamp(published_timestamp, tz=UTC).isoformat()
    else:
        published_iso = datetime.now(UTC).isoformat()

    play_count = int(raw.get("playCount") or stats.get("playCount") or 0)
    like_count = int(raw.get("diggCount") or stats.get("diggCount") or 0)
    comment_count = int(raw.get("commentCount") or stats.get("commentCount") or 0)
    share_count = int(raw.get("shareCount") or stats.get("shareCount") or 0)

    author_name = author.get("nickName") or author.get("name") or "TikTok Creator"
    author_handle = f"@{author.get('name', 'unknown').lstrip('@')}"

    return {
        "id": f"tiktok_{post_id}",
        "platform": "tiktok",
        "title": (raw.get("text") or "")[:80] + ("..." if len(raw.get("text") or "") > 80 else ""),
        "text": raw.get("text") or "",
        "url": raw.get("webVideoUrl") or f"https://www.tiktok.com/{author_handle}/video/{post_id}",
        "published_at": published_iso,
        "fetched_at": datetime.now(UTC).isoformat(),
        "source_id": f"tiktok_{author.get('name', 'creator').lower()}",
        "source_name": author_name,
        "source_handle": author_handle,
        "source_avatar": author.get("avatar") or "",
        "source_category": "community",
        "content_type": "community",
        "thumbnail": raw.get("videoMeta", {}).get("coverUrl", "") or author.get("avatar", ""),
        "media": [],
        "metrics": {
            "views": play_count,
            "likes": like_count,
            "comments": comment_count,
            "shares": share_count,
        },
        "platform_data": {
            "tiktok_sound": music.get("musicName") or "",
        },
    }


def analyze_with_gemini(posts: list[dict[str, Any]], comments: list[dict[str, Any]]) -> str:
    """Passes collected posts and comments to Gemini for audience sentiment analysis."""
    if not GEMINI_API_KEY:
        return "Gemini API Key not configured. Set GEMINI_API_KEY in .env to enable AI sentiment."

    try:
        import httpx

        prompt_data = {
            "posts_summary": [
                {
                    "author": p["source_name"],
                    "handle": p["source_handle"],
                    "views": p["metrics"]["views"],
                    "likes": p["metrics"]["likes"],
                    "text": p["text"],
                }
                for p in posts
            ],
            "sample_audience_comments": [
                {"user": c.get("authorName", "user"), "comment": c.get("text", "")}
                for c in comments[:30]
            ],
        }

        url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key={GEMINI_API_KEY}"
        system_instruction = (
            "You are an expert film market analyst covering the Indonesian cinema industry. "
            "Analyze the provided TikTok posts and audience comments. Provide:\n"
            "1. Overall Audience Sentiment (Positive / Mixed / Critical percentage estimate)\n"
            "2. Key Topics & Buzz (What people praise or complain about: actors, ticket availability, plot, cinemas)\n"
            "3. Actionable insight for cinema exhibitors / distributors."
        )

        payload = {
            "contents": [
                {
                    "parts": [
                        {
                            "text": f"{system_instruction}\n\nData:\n{json.dumps(prompt_data, ensure_ascii=False, indent=2)}"
                        }
                    ]
                }
            ]
        }

        with httpx.Client(timeout=30.0) as client:
            resp = client.post(url, json=payload)
            if resp.status_code == 200:
                result = resp.json()
                return result["candidates"][0]["content"]["parts"][0]["text"]
            return f"Gemini API returned status {resp.status_code}: {resp.text}"
    except Exception as e:
        return f"Gemini analysis error: {e}"


def main() -> None:
    parser = argparse.ArgumentParser(description="CineRadar TikTok Pilot Crawler")
    parser.add_argument("--hashtag", type=str, default="filmindonesia", help="Hashtag to scan")
    parser.add_argument("--limit", type=int, default=5, help="Number of posts to fetch")
    parser.add_argument("--comments-per-post", type=int, default=10, help="Comments per post")
    parser.add_argument("--dry-run", action="store_true", help="Use mock data without Apify token")
    parser.add_argument("--out-dir", type=str, default="backend/scripts/output", help="Output directory")

    args = parser.parse_args()

    clean_tag = args.hashtag.lstrip("#").lower()
    print("==================================================")
    print(f" CineRadar TikTok Pilot Crawler - #{clean_tag}")
    print("==================================================")

    use_dry_run = args.dry_run or not APIFY_API_TOKEN

    if use_dry_run:
        print("[!] Running in DRY-RUN / MOCK mode (No API token used or requested).")
        raw_posts, raw_comments = create_sample_mock_data(clean_tag)
    else:
        from apify_client import ApifyClient

        client = ApifyClient(APIFY_API_TOKEN)
        raw_posts = run_apify_hashtag_search(client, clean_tag, args.limit)
        video_urls = [
            p.get("webVideoUrl")
            for p in raw_posts
            if p.get("webVideoUrl")
        ][:3]  # take top 3 for comments to conserve quota
        raw_comments = run_apify_comments_scraper(client, video_urls, args.comments_per_post)

    normalized_posts = [normalize_to_cineradar_post(p) for p in raw_posts]

    print("\n--- Extracted Posts Summary ---")
    for i, post in enumerate(normalized_posts, 1):
        m = post["metrics"]
        print(f"[{i}] {post['source_name']} ({post['source_handle']})")
        print(f"    Text: {post['title']}")
        print(f"    Views: {m['views']:,} | Likes: {m['likes']:,} | Comments: {m['comments']:,} | Shares: {m['shares']:,}")
        print(f"    URL: {post['url']}\n")

    print(f"--- Extracted Comments Sample ({len(raw_comments)} total) ---")
    for i, c in enumerate(raw_comments[:6], 1):
        print(f"  {i}. @{c.get('authorName', 'user')}: {c.get('text', '')}")

    print("\n--- Running AI Sentiment Analysis ---")
    ai_summary = analyze_with_gemini(normalized_posts, raw_comments)
    print(ai_summary)

    # Save output JSON
    out_path = Path(args.out_dir)
    out_path.mkdir(parents=True, exist_ok=True)
    file_name = out_path / f"tiktok_pilot_{clean_tag}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"

    output_payload = {
        "hashtag": f"#{clean_tag}",
        "executed_at": datetime.now(UTC).isoformat(),
        "is_mock": use_dry_run,
        "total_posts": len(normalized_posts),
        "total_comments": len(raw_comments),
        "ai_sentiment_summary": ai_summary,
        "posts": normalized_posts,
        "comments": raw_comments,
    }

    with open(file_name, "w", encoding="utf-8") as f:
        json.dump(output_payload, f, ensure_ascii=False, indent=2)

    # Also save a copy for Studio frontend consumption
    studio_data_dir = Path("studio/src/data")
    studio_data_dir.mkdir(parents=True, exist_ok=True)
    studio_file = studio_data_dir / f"tiktok_{clean_tag}.json"
    studio_latest = studio_data_dir / "tiktok_latest.json"
    with open(studio_file, "w", encoding="utf-8") as f:
        json.dump(output_payload, f, ensure_ascii=False, indent=2)
    with open(studio_latest, "w", encoding="utf-8") as f:
        json.dump(output_payload, f, ensure_ascii=False, indent=2)

    print(f"\n[+] Full normalized pilot dataset saved to: {file_name}")
    print(f"[+] Studio frontend dataset synced to: {studio_latest}")
    print("==================================================")


if __name__ == "__main__":
    main()
