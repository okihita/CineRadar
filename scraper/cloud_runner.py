#!/usr/bin/env python3
"""
Cloud Run Jobs entry point for CineRadar scraper.
Runs the scraper and uploads results to Cloud Storage.
"""
import asyncio
import json
import os
import sys
from datetime import datetime
from pathlib import Path

# Add parent to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from scraper.tix_client import CineRadarScraper


# Configuration
GCS_BUCKET = os.environ.get('GCS_BUCKET', 'cineradar-data')
GOOGLE_MAPS_API_KEY = os.environ.get('GOOGLE_MAPS_API_KEY', '')
ENABLE_GEOCODING = os.environ.get('ENABLE_GEOCODING', 'true').lower() == 'true'


async def upload_to_gcs(data: dict, filename: str):
    """Upload JSON data to Google Cloud Storage."""
    try:
        from google.cloud import storage
        
        client = storage.Client()
        bucket = client.bucket(GCS_BUCKET)
        
        # Upload the data
        blob = bucket.blob(filename)
        blob.upload_from_string(
            json.dumps(data, indent=2, ensure_ascii=False),
            content_type='application/json'
        )
        
        print(f"✅ Uploaded to gs://{GCS_BUCKET}/{filename}")
        
        # Also upload as 'latest.json' for easy access
        latest_blob = bucket.blob('latest.json')
        latest_blob.upload_from_string(
            json.dumps(data, indent=2, ensure_ascii=False),
            content_type='application/json'
        )
        print(f"✅ Updated gs://{GCS_BUCKET}/latest.json")
        
        return True
    except Exception as e:
        print(f"❌ GCS upload failed: {e}")
        return False


async def run_scrape():
    """Run the full scrape with schedules and geocoding."""
    print("\n" + "="*60)
    print("🎬 CineRadar Cloud Scraper")
    print(f"📅 Date: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"🌍 Geocoding: {'Enabled' if ENABLE_GEOCODING else 'Disabled'}")
    print(f"☁️ GCS Bucket: {GCS_BUCKET}")
    print("="*60 + "\n")
    
    scraper = CineRadarScraper()
    
    try:
        # Run scrape with schedules
        result = await scraper.scrape(
            fetch_schedules=True,
            geocode=ENABLE_GEOCODING
        )
        
        if result:
            # Generate filename
            date_str = datetime.now().strftime('%Y-%m-%d')
            filename = f"movies_{date_str}.json"
            
            # Upload to GCS
            await upload_to_gcs(result, filename)
            
            # Sync theatres to Firestore
            try:
                from scraper.firestore_client import sync_theatres_from_scrape, log_scraper_run
                
                movies = result.get('movies', [])
                sync_result = sync_theatres_from_scrape(movies)
                print(f"🏠 Synced {sync_result['success']}/{sync_result['total']} theatres to Firestore")
                
                # Log scraper run
                cities = set()
                for movie in movies:
                    cities.update(movie.get('schedules', {}).keys())
                
                log_scraper_run({
                    'status': 'success',
                    'movies': len(movies),
                    'cities': len(cities),
                    'theatres_synced': sync_result['success'],
                    'date': date_str
                })
                print("📝 Logged scraper run to Firestore")
            except Exception as e:
                print(f"⚠️ Firestore sync warning: {e}")
            
            # Print summary
            movies = result.get('movies', [])
            cities = set()
            for movie in movies:
                cities.update(movie.get('schedules', {}).keys())
            
            print("\n" + "="*60)
            print("📊 SCRAPE COMPLETE")
            print("="*60)
            print(f"Total Movies: {len(movies)}")
            print(f"Cities with Schedules: {len(cities)}")
            print(f"Scraped at: {result.get('scraped_at', 'N/A')}")
            print("="*60 + "\n")
            
            return True
        else:
            print("❌ Scrape returned no data")
            return False
            
    except Exception as e:
        print(f"❌ Scrape failed: {e}")
        import traceback
        traceback.print_exc()
        return False


def main():
    """Main entry point."""
    success = asyncio.run(run_scrape())
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()
