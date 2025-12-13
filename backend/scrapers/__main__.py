#!/usr/bin/env python3
"""
CineRadar CLI - Daily Movie Availability Scraper
Scrapes movie listings and showtimes from TIX.id across all Indonesian cities.

Usage:
    python -m backend.scrapers                    # Basic scrape
    python -m backend.scrapers --schedules        # Include showtimes
    python -m backend.scrapers --city JAKARTA     # Specific city
    python -m backend.scrapers --visible          # Show browser
"""
import argparse
import asyncio
import json
from datetime import datetime
from pathlib import Path
from typing import Optional

from backend.services.tix_client import CineRadarScraper



def run_scrape(
    output_dir: str = "data",
    headless: bool = True,
    city_limit: Optional[int] = None,
    specific_city: Optional[str] = None,
    schedules: bool = False,
    geocode: bool = False
):
    """Run the scraper and save results."""
    
    async def _run():
        scraper = CineRadarScraper()
        output_path = Path(output_dir)
        output_path.mkdir(exist_ok=True)
        
        date_str = datetime.now().strftime("%Y-%m-%d")
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        
        # Header
        print("\n" + "=" * 60)
        print("🎬 CineRadar - Daily Movie Availability Scraper")
        print(f"📅 Date: {date_str}")
        print(f"🕒 Schedules: {'Enabled' if schedules else 'Disabled'}")
        if specific_city:
            print(f"📍 City: {specific_city}")
        print("=" * 60 + "\n")
        
        # Scrape
        result = await scraper.scrape(
            headless=headless,
            city_limit=city_limit,
            specific_city=specific_city,
            fetch_schedules=schedules
        )
        
        if not result or not result.get('movies'):
            print("❌ No data collected.")
            return None
        
        # Geocode theatres if requested
        if geocode and schedules:
            # Build movie_map from result
            movie_map = {m['id']: m for m in result['movies']}
            await scraper.geocode_all_theatres(movie_map)
            result['movies'] = list(movie_map.values())
            
        # Summary
        print("\n" + "=" * 60)
        print("📊 SUMMARY")
        print("=" * 60)
        print(f"Total Cities: {result['total_cities']}")
        print(f"Total Movies: {result['total_movies']}")
        
        # Pre-sales
        presales = [m for m in result['movies'] if m.get('is_presale')]
        if presales:
            print(f"Pre-sale Movies: {len(presales)}")
        
        # Save results
        output_file = output_path / f"movies_{date_str}.json"
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump({
                'scraped_at': timestamp,
                'date': date_str,
                'summary': {
                    'total_cities': result['total_cities'],
                    'total_movies': result['total_movies'],
                    'presale_count': len(presales)
                },
                'movies': result['movies'],
                'city_stats': result['city_stats'],
            }, f, indent=2, ensure_ascii=False)
        
        print(f"\n💾 Saved to: {output_file}")
        return result
        
    return asyncio.run(_run())


def main():
    """CLI entry point."""
    parser = argparse.ArgumentParser(
        description='CineRadar - TIX.id Movie Scraper',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python -m scraper                     # Scrape all cities
  python -m scraper --schedules         # Include showtimes
  python -m scraper --city JAKARTA      # Single city
  python -m scraper --limit 5           # First 5 cities only
  python -m scraper --visible           # Show browser window
        """
    )
    parser.add_argument(
        '--visible', action='store_true',
        help='Show browser window (default: headless)'
    )
    parser.add_argument(
        '--limit', type=int, metavar='N',
        help='Limit to first N cities'
    )
    parser.add_argument(
        '--city', type=str, metavar='NAME',
        help='Scrape specific city only (e.g., JAKARTA)'
    )
    parser.add_argument(
        '--schedules', action='store_true',
        help='Fetch detailed theatre showtimes (slower)'
    )
    parser.add_argument(
        '--output', default='data', metavar='DIR',
        help='Output directory (default: data)'
    )
    parser.add_argument(
        '--geocode', action='store_true',
        help='Geocode theatre addresses (requires --schedules)'
    )
    
    args = parser.parse_args()
    
    run_scrape(
        output_dir=args.output,
        headless=not args.visible,
        city_limit=args.limit,
        specific_city=args.city,
        schedules=args.schedules,
        geocode=args.geocode
    )


if __name__ == "__main__":
    main()
