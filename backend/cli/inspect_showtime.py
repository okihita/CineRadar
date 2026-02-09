"""CLI tool to inspect raw API responses for debugging seat type issues."""

import argparse
import json
import logging

from google.cloud import firestore

logger = logging.getLogger(__name__)


def inspect_showtime(showtime_id: str, movie_id: str, date: str, verbose: bool = False) -> None:
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
        logger.info(f"❌ Showtime {showtime_id} not found")
        logger.info(
            f"   Path: movie_performance/{movie_id}/days/{date}/showtimes/{showtime_id}"
        )
        return

    data = doc.to_dict()
    raw = data.get("raw_api_response")

    if not raw:
        logger.info("⚠️  No raw_api_response stored")
        logger.info(
            "   This might be legacy data before raw response capture was implemented"
        )
        logger.info("\n📋 Available Data:")
        logger.info(f"  Movie: {data.get('movie_title')}")
        logger.info(f"  Theatre: {data.get('theatre_name')} ({data.get('city')})")
        logger.info(f"  Time: {data.get('showtime')} on {data.get('date')}")
        logger.info(
            f"  Occupancy: {data.get('occupancy_pct')}% ({data.get('sold_seats')}/{data.get('total_seats')})"
        )
        return

    logger.info("\n" + "=" * 60)
    logger.info(f"SHOWTIME INSPECTION: {showtime_id}")
    logger.info("=" * 60)

    logger.info("\n📋 Metadata:")
    logger.info(f"  Movie: {data.get('movie_title')}")
    logger.info(f"  Theatre: {data.get('theatre_name')} ({data.get('city')})")
    logger.info(f"  Time: {data.get('showtime')} on {data.get('date')}")
    logger.info(f"  Room: {data.get('room_category')} ({data.get('merchant')})")
    logger.info(f"  Scraped: {data.get('scraped_at')}")

    logger.info("\n📊 Calculated Occupancy:")
    logger.info(
        f"  {data.get('occupancy_pct')}% ({data.get('sold_seats')}/{data.get('total_seats')} seats)"
    )

    logger.info("\n🔍 Raw API Response Structure:")
    logger.info(f"  Success: {raw.get('success')}")
    logger.info(f"  Code: {raw.get('code')}")
    logger.info(f"  Has seat_map: {'seat_map' in raw.get('data', {})}")

    if verbose:
        logger.info("\n📄 Full Raw API Response:")
        logger.info(json.dumps(raw, indent=2))

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
        logger.info("\n🪑 Seat Types Detected:")
        for seat_type in sorted(seat_types):
            logger.info(f"  - {seat_type}")

    if status_codes:
        logger.info("\n🔢 Status Codes Found:")
        for code in sorted(str(c) for c in status_codes):
            logger.info(f"  - Code: {code}")

    # Check for anomalies
    total_calculated = data.get("total_seats", 0)
    if total_calculated == 0 and seat_map:
        logger.info(
            "\n⚠️  WARNING: Total seats calculated as 0, but seat_map has data!"
        )
        logger.info(
            "   This suggests a calculation bug - check seat status interpretation"
        )
        logger.info("   Possible causes: Unknown status codes, seat_type mismatch")

    # Check for multiple seat types (potential issue from yesterday)
    if len(seat_types) > 1:
        logger.info(f"\n🎯 DETECTED MULTIPLE SEAT TYPES: {len(seat_types)} types")
        logger.info(
            "   This could cause calculation issues if status codes vary by seat type"
        )
        logger.info("   Review status code interpretation for each type:")
        for seat_type in sorted(seat_types):
            logger.info(f"   - {seat_type}")


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Inspect raw API response for showtime debugging"
    )
    parser.add_argument("--showtime-id", required=True, help="Showtime ID")
    parser.add_argument("--movie-id", required=True, help="Movie ID")
    parser.add_argument("--date", required=True, help="Date (YYYY-MM-DD)")
    parser.add_argument("--verbose", "-v", action="store_true", help="Show full raw JSON")

    args = parser.parse_args()
    inspect_showtime(args.showtime_id, args.movie_id, args.date, args.verbose)


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(message)s")
    main()
