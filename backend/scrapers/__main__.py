#!/usr/bin/env python3
"""
CineRadar CLI - Daily Movie Availability Scraper
"""
import argparse
import asyncio
import json
from datetime import datetime
from pathlib import Path
from typing import Optional

from backend.services.tix_client import CineRadarScraper
from backend.config import CITIES


def run_scrape(
    output_dir: str = "data",
    headless: bool = True,
    city_limit: Optional[int] = None,
    specific_city: Optional[str] = None,
    schedules: bool = False,
    batch: Optional[int] = None,
    total_batches: int = 9,
    max_retries: int = 3
):
    """Run the scraper with retry logic."""
    
    async def _run():
        scraper = CineRadarScraper()
        output_path = Path(output_dir)
        output_path.mkdir(exist_ok=True)
        
        date_str = datetime.now().strftime("%Y-%m-%d")
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        
        # Determine cities to scrape
        if batch is not None:
            cities_per_batch = len(CITIES) // total_batches + 1
            start_idx = batch * cities_per_batch
            end_idx = min(start_idx + cities_per_batch, len(CITIES))
            city_names = [c['name'] for c in CITIES[start_idx:end_idx]]
            print(f"🔢 Batch {batch}/{total_batches-1}: cities {start_idx}-{end_idx-1} ({len(city_names)} cities)")
        else:
            city_names = None
        
        # Header
        print("\n" + "=" * 60)
        print("🎬 CineRadar - Daily Movie Availability Scraper")
        print(f"📅 Date: {date_str}")
        print("=" * 60 + "\n")
        
        # Scrape with retry
        result = None
        for attempt in range(max_retries):
            try:
                result = await scraper.scrape(
                    headless=headless,
                    city_limit=city_limit,
                    specific_city=specific_city,
                    city_names=city_names,
                    fetch_schedules=schedules
                )
                if result and result.get('movies'):
                    break
            except Exception as e:
                print(f"⚠️ Attempt {attempt + 1}/{max_retries} failed: {e}")
                if attempt < max_retries - 1:
                    wait = 2 ** attempt * 5
                    print(f"   Retrying in {wait}s...")
                    await asyncio.sleep(wait)
        
        if not result or not result.get('movies'):
            print("❌ No data collected after retries.")
            return None
        
        # Summary
        print(f"\n📊 Cities: {result['total_cities']}, Movies: {result['total_movies']}")
        
        # Save results
        if batch is not None:
            output_file = output_path / f"batch_{batch}_{date_str}.json"
        else:
            output_file = output_path / f"movies_{date_str}.json"
            
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump({
                'scraped_at': timestamp,
                'date': date_str,
                'batch': batch,
                'movies': result['movies'],
                'city_stats': result['city_stats'],
            }, f, indent=2, ensure_ascii=False)
        
        print(f"💾 Saved to: {output_file}")
        return result
        
    return asyncio.run(_run())


def main():
    parser = argparse.ArgumentParser(description='CineRadar - TIX.id Movie Scraper')
    parser.add_argument('--visible', action='store_true')
    parser.add_argument('--limit', type=int)
    parser.add_argument('--city', type=str)
    parser.add_argument('--schedules', action='store_true')
    parser.add_argument('--output', default='data')
    parser.add_argument('--batch', type=int, help='Batch number (0-indexed)')
    parser.add_argument('--total-batches', type=int, default=9)
    
    args = parser.parse_args()
    
    run_scrape(
        output_dir=args.output,
        headless=not args.visible,
        city_limit=args.limit,
        specific_city=args.city,
        schedules=args.schedules,
        batch=args.batch,
        total_batches=args.total_batches
    )


if __name__ == "__main__":
    main()
