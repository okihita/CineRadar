#!/usr/bin/env python3
"""
Daily Summary Report Generator

Aggregates seat occupancy data from Firestore and sends a notification
with total audience counts for the day.
"""

import json
import os
from datetime import datetime, timedelta

from google.cloud import firestore
from google.oauth2 import service_account


def get_firestore_client():
    """Initialize Firestore client from service account."""
    sa_json = os.environ.get("FIREBASE_SERVICE_ACCOUNT")
    if sa_json:
        sa_info = json.loads(sa_json)
        credentials = service_account.Credentials.from_service_account_info(sa_info)
        return firestore.Client(credentials=credentials, project=sa_info["project_id"])
    else:
        return firestore.Client()


def aggregate_daily_audience(date_str: str | None = None) -> dict:
    """
    Aggregate seat occupancy data for a given date.

    Args:
        date_str: Date in YYYY-MM-DD format. Defaults to today.

    Returns:
        Dict with aggregated stats
    """
    if not date_str:
        date_str = datetime.now().strftime("%Y-%m-%d")

    db = get_firestore_client()
    collection = db.collection("seat_snapshots")

    # Query all snapshots for this date
    # Document IDs contain the date in the scraped_at field
    docs = collection.stream()

    total_seats = 0
    total_sold = 0
    total_available = 0
    showtime_count = 0
    movies_seen = set()
    theatres_seen = set()
    cities_seen = set()

    for doc in docs:
        data = doc.to_dict()

        # Filter by date (scraped_at contains ISO timestamp)
        scraped_at = data.get("scraped_at", "")
        if not scraped_at.startswith(date_str):
            continue

        total_seats += data.get("total_seats", 0)
        total_sold += data.get("sold_seats", data.get("unavailable_seats", 0))
        total_available += data.get("available_seats", 0)
        showtime_count += 1

        if data.get("movie_id"):
            movies_seen.add(data["movie_id"])
        if data.get("theatre_id"):
            theatres_seen.add(data["theatre_id"])
        if data.get("city"):
            cities_seen.add(data["city"])

    occupancy_pct = (total_sold / total_seats * 100) if total_seats > 0 else 0

    return {
        "date": date_str,
        "total_audience": total_sold,
        "total_seats": total_seats,
        "total_available": total_available,
        "occupancy_pct": round(occupancy_pct, 1),
        "showtime_count": showtime_count,
        "movie_count": len(movies_seen),
        "theatre_count": len(theatres_seen),
        "city_count": len(cities_seen),
    }


def format_summary_message(stats: dict) -> str:
    """Format stats as a readable message."""
    return f"""
🎬 CineRadar Daily Summary - {stats['date']}

📊 AUDIENCE STATISTICS
━━━━━━━━━━━━━━━━━━━━━━
🎟️ Total Audience: {stats['total_audience']:,} seats sold
🪑 Total Capacity: {stats['total_seats']:,} seats
📈 Occupancy Rate: {stats['occupancy_pct']}%

📋 COVERAGE
━━━━━━━━━━━━━━━━━━━━━━
🎬 Movies: {stats['movie_count']}
🏢 Theatres: {stats['theatre_count']}
🏙️ Cities: {stats['city_count']}
⏰ Showtimes: {stats['showtime_count']:,}

Generated at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')} WIB
"""


def send_github_summary(message: str):
    """Output summary to GitHub Actions step summary."""
    summary_file = os.environ.get("GITHUB_STEP_SUMMARY")
    if summary_file:
        with open(summary_file, "a") as f:
            f.write("```\n")
            f.write(message)
            f.write("```\n")
    else:
        print(message)


def main():
    print("\n" + "=" * 60)
    print("📊 CineRadar Daily Summary Report")
    print("=" * 60 + "\n")

    # Get yesterday's date (for midnight report)
    yesterday = (datetime.now() - timedelta(days=1)).strftime("%Y-%m-%d")

    stats = aggregate_daily_audience(yesterday)

    if stats["showtime_count"] == 0:
        print(f"⚠️ No seat data found for {yesterday}")
        print("   This may be normal if seat scraping hasn't run yet.")
        return

    message = format_summary_message(stats)
    print(message)

    # Output to GitHub Actions summary if available
    send_github_summary(message)

    # Store summary in Firestore for historical tracking
    try:
        db = get_firestore_client()
        db.collection("daily_summaries").document(yesterday).set({
            **stats,
            "generated_at": datetime.now().isoformat(),
        })
        print(f"💾 Saved summary to Firestore: daily_summaries/{yesterday}")
    except Exception as e:
        print(f"⚠️ Failed to save summary: {e}")


if __name__ == "__main__":
    main()
