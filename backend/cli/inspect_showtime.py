"""CLI tool to inspect raw API responses for debugging seat type issues."""

import argparse
import json
from google.cloud import firestore
import gzip


def inspect_showtime(showtime_id: str, movie_id: str, date: str, verbose: bool = False):
    """Retrieve and display raw API response for debugging.

    Args:
        showtime_id: Showtime ID to inspect
        movie_id: Movie ID for Firestore path
        date: Date (YYYY-MM-DD) for Firestore path
        verbose: If True, show full raw JSON
    """
    db = firestore.Client()
    doc_ref = (
        db.collection("movie_performance")
        .document(movie_id)
        .collection("days")
        .document(date)
        .collection("showtimes")
        .document(showtime_id)
    )

    doc = doc_ref.get()
    if not doc.exists:
        print(f"❌ Showtime {showtime_id} not found")
        print(f"   Path: movie_performance/{movie_id}/days/{date}/showtimes/{showtime_id}")
        return

    data = doc.to_dict()
    raw = data.get("raw_api_response")

    if not raw:
        print(f"⚠️  No raw_api_response stored")
        print(f"   This might be legacy data before raw response capture was implemented")
        print(f"\n📋 Available Data:")
        print(f"  Movie: {data.get('movie_title')}")
        print(f"  Theatre: {data.get('theatre_name')} ({data.get('city')})")
        print(f"  Time: {data.get('showtime')} on {data.get('date')}")
        print(
            f"  Occupancy: {data.get('occupancy_pct')}% ({data.get('sold_seats')}/{data.get('total_seats')})"
        )
        return

    print(f"\n{'=' * 60}")
    print(f"SHOWTIME INSPECTION: {showtime_id}")
    print(f"{'=' * 60}")

    print(f"\n📋 Metadata:")
    print(f"  Movie: {data.get('movie_title')}")
    print(f"  Theatre: {data.get('theatre_name')} ({data.get('city')})")
    print(f"  Time: {data.get('showtime')} on {data.get('date')}")
    print(f"  Room: {data.get('room_category')} ({data.get('merchant')})")
    print(f"  Scraped: {data.get('scraped_at')}")

    print(f"\n📊 Calculated Occupancy:")
    print(
        f"  {data.get('occupancy_pct')}% ({data.get('sold_seats')}/{data.get('total_seats')} seats)"
    )

    print(f"\n🔍 Raw API Response Structure:")
    print(f"  Success: {raw.get('success')}")
    print(f"  Code: {raw.get('code')}")
    print(f"  Has seat_map: {'seat_map' in raw.get('data', {})}")

    if verbose:
        print(f"\n📄 Full Raw API Response:")
        print(json.dumps(raw, indent=2))

    # Analyze seat types if present
    seat_map = raw.get("data", {}).get("seat_map", [])
    seat_types = set()
    status_codes = set()

    for item in seat_map:
        if "seat_rows" in item:
            for seat in item.get("seat_rows", []):
                if "seat_type" in seat:
                    seat_types.add(seat["seat_type"])
                if "status" in seat:
                    status_codes.add(seat["status"].get("code"))
        else:
            # Flat structure
            if "seat_yn" in item:
                status_codes.add(item.get("seat_status", item.get("status")))

    if seat_types:
        print(f"\n🪑 Seat Types Detected:")
        for seat_type in sorted(seat_types):
            print(f"  - {seat_type}")

    if status_codes:
        print(f"\n🔢 Status Codes Found:")
        for code in sorted(str(c) for c in status_codes):
            print(f"  - Code: {code}")

    # Check for anomalies
    total_calculated = data.get("total_seats", 0)
    if total_calculated == 0 and seat_map:
        print(f"\n⚠️  WARNING: Total seats calculated as 0, but seat_map has data!")
        print(f"   This suggests a calculation bug - check seat status interpretation")
        print(f"   Possible causes: Unknown status codes, seat_type mismatch")

    # Check for multiple seat types (potential issue from yesterday)
    if len(seat_types) > 1:
        print(f"\n🎯 DETECTED MULTIPLE SEAT TYPES: {len(seat_types)} types")
        print(f"   This could cause calculation issues if status codes vary by seat type")
        print(f"   Review status code interpretation for each type:")
        for seat_type in sorted(seat_types):
            print(f"   - {seat_type}")


def main():
    parser = argparse.ArgumentParser(description="Inspect raw API response for showtime debugging")
    parser.add_argument("--showtime-id", required=True, help="Showtime ID")
    parser.add_argument("--movie-id", required=True, help="Movie ID")
    parser.add_argument("--date", required=True, help="Date (YYYY-MM-DD)")
    parser.add_argument("--verbose", "-v", action="store_true", help="Show full raw JSON")

    args = parser.parse_args()
    inspect_showtime(args.showtime_id, args.movie_id, args.date, args.verbose)


if __name__ == "__main__":
    main()
