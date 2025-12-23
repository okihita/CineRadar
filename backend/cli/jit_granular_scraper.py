#!/usr/bin/env python3
"""
JIT Granular Seat Scraper
Monitors seat occupancy for upcoming showtimes with 5-minute granularity.
Includes anti-bot measures (random jitter, user-agent rotation, rate limiting).
"""

import asyncio
import json
import logging
import random
import sys
import time
from datetime import datetime, timedelta
from pathlib import Path
from typing import List, Dict, Any

from backend.infrastructure.scrapers.seat_scraper import TixSeatScraper
from backend.infrastructure.token_refresher import TokenRefresher, TokenRefreshError
from backend.domain.models import SeatOccupancy

# --- Configuration ---
SCRAPE_INTERVAL_MINUTES = 5
JITTER_SECONDS = 30  # ±30 seconds
MIN_DELAY_BETWEEN_REQUESTS = 2.0  # Seconds
MAX_DELAY_BETWEEN_REQUESTS = 8.0  # Seconds
MAX_REQUESTS_PER_MINUTE = 10
UA_POOL = [
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/119.0",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36",
]

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler("jit_scraper.log")
    ]
)
logger = logging.getLogger("JITScraper")

class RateLimiter:
    """Simple sliding window rate limiter."""
    def __init__(self, max_rate: int, time_window: int = 60):
        self.max_rate = max_rate
        self.time_window = time_window
        self.timestamps = []

    async def acquire(self):
        """Wait until a request slot is available."""
        while True:
            now = time.time()
            # Remove old timestamps
            self.timestamps = [t for t in self.timestamps if now - t <= self.time_window]
            
            if len(self.timestamps) < self.max_rate:
                self.timestamps.append(now)
                return
            
            # Wait a bit before checking again
            await asyncio.sleep(0.5)

class GranularScraper:
    def __init__(self):
        self.scraper = TixSeatScraper()
        self.rate_limiter = RateLimiter(MAX_REQUESTS_PER_MINUTE)
        self.token_refresher = TokenRefresher()
        self.data_dir = Path("data/jit_granular")
        self.data_dir.mkdir(parents=True, exist_ok=True)
        self.active_monitors = []

    async def _check_and_refresh_token(self) -> bool:
        """Ensure valid token exists using hybrid refresh strategy."""
        try:
            token = await self.token_refresher.ensure_valid_token()
            self.scraper.set_token(token.token)
            return True
        except TokenRefreshError as e:
            logger.error(f"❌ Token refresh failed: {e}")
            return False

    async def _scrape_single(self, task: Dict[str, Any]):
        """Perform a single scrape task with anti-bot delays."""
        showtime_id = task['id']
        movie_title = task['movie']
        theatre_name = task['theatre']
        
        # 1. Anti-bot: Rate Limiting
        await self.rate_limiter.acquire()
        
        # 2. Anti-bot: Random Delay
        delay = random.uniform(MIN_DELAY_BETWEEN_REQUESTS, MAX_DELAY_BETWEEN_REQUESTS)
        logger.info(f"⏳ Waiting {delay:.2f}s before scraping {movie_title}...")
        await asyncio.sleep(delay)
        
        # 3. Perform Scrape
        try:
            # Token check before every request
            await self._check_and_refresh_token()
            
            # TODO: Add UA rotation to the underlying scraper if possible
            # For now, we rely on the header rotation if implemented in base, 
            # or we just rely on the delay.
            
            results = await self.scraper.scrape_seats(
                showtime_ids=[showtime_id],
                merchant=task.get('merchant', 'XXI') # Default to XXI for now
            )
            
            if results:
                result = results[0]
                self._save_result(result, task)
                logger.info(f"✅ Scraped {movie_title} ({result.occupancy_pct:.1f}% occupied)")
                return True
            else:
                logger.warning(f"⚠️ Empty result for {movie_title}")
                return False
                
        except Exception as e:
            logger.error(f"❌ Error scraping {showtime_id}: {e}")
            return False

    def _save_result(self, occupancy: SeatOccupancy, task: Dict[str, Any]):
        """Save observation to JSON line file."""
        filename = f"jit_{task['date']}_{task['movie'].replace(' ', '_')}_{task['start_time'].replace(':','')}.jsonl"
        filepath = self.data_dir / filename
        
        record = {
            "timestamp": datetime.utcnow().isoformat(),
            "showtime_id": occupancy.showtime_id,
            "movie": occupancy.movie_title,
            "theatre": occupancy.theatre_name,
            "showtime": occupancy.showtime,
            "total_seats": occupancy.total_seats,
            "sold_seats": occupancy.sold_seats,
            "occupancy_pct": occupancy.occupancy_pct
        }
        
        with open(filepath, 'a') as f:
            f.write(json.dumps(record) + "\n")

    async def monitor(self, showtime_tasks: List[Dict[str, Any]]):
        """Main monitoring loop."""
        logger.info(f"🚀 Starting monitoring for {len(showtime_tasks)} showtimes")
        
        # Initial validation
        if not await self._check_and_refresh_token():
            logger.error("❌ Initial token check failed. Aborting.")
            return

        while True:
            # 1. Filter completed/past showtimes
            # For now, assuming we monitor until manual stop or end of day
            
            # 2. Schedule batch
            batch_start = time.time()
            tasks = []
            
            for task in showtime_tasks:
                tasks.append(self._scrape_single(task))
            
            # Run batch concurrently (limited by RateLimiter internally)
            await asyncio.gather(*tasks)
            
            # 3. Wait for next interval
            elapsed = time.time() - batch_start
            wait_time = (SCRAPE_INTERVAL_MINUTES * 60) - elapsed
            
            # Anti-bot: Jitter
            jitter = random.uniform(-JITTER_SECONDS, JITTER_SECONDS)
            wait_time += jitter
            
            if wait_time > 0:
                next_run = datetime.now() + timedelta(seconds=wait_time)
                logger.info(f"💤 Batch complete. Sleeping {wait_time:.1f}s until {next_run.strftime('%H:%M:%S')}...")
                await asyncio.sleep(wait_time)
            else:
                logger.warning(f"⚠️ Batch took too long ({elapsed:.1f}s). Starting next immediately.")

async def main():
    import argparse
    parser = argparse.ArgumentParser(description='JIT Granular Seat Scraper')
    parser.add_argument('--file', help='Path to movies JSON file', default=None)
    parser.add_argument('--city', help='Filter by city name (e.g. JAKARTA)')
    parser.add_argument('--movie', help='Filter by movie title (partial match)')
    parser.add_argument('--interval', type=int, default=SCRAPE_INTERVAL_MINUTES, help='Scrape interval in minutes')
    parser.add_argument('--limit', type=int, default=100, help='Max showtimes to monitor')
    args = parser.parse_args()
    
    # Determine input file
    if args.file:
        file_path = Path(args.file)
    else:
        # Find latest movies_*.json
        files = sorted(Path("data").glob("movies_202*.json"))
        if not files:
            logger.error("❌ No movie data files found in data/!")
            return
        file_path = files[-1]
        
    logger.info(f"📂 Loading data from {file_path}")
    
    tasks = []
    
    try:
        with open(file_path, 'r') as f:
            data = json.load(f)
            
        now = datetime.now()
        movies = data.get('movies', [])
        logger.info(f"   Found {len(movies)} movies in file")
        
        for m in movies:
            title = m.get('title')
            # Filter by movie title
            if args.movie and args.movie.lower() not in title.lower():
                continue
                
            for city, schedules in m.get('schedules', {}).items():
                # Filter by city
                if args.city and args.city.upper() != city.upper():
                    continue

                for theatre in schedules:
                    theatre_name = theatre.get('theatre_name')
                    merchant = theatre.get('merchant')
                    
                    for room in theatre.get('rooms', []):
                        # Use all_showtimes
                        showtimes = room.get('all_showtimes', [])
                        if not showtimes:
                            showtimes = room.get('showtimes', [])
                            
                        for st in showtimes:
                            if isinstance(st, dict):
                                st_time = st.get('time')
                                st_id = st.get('showtime_id')
                            else:
                                continue
                                
                            if not st_id or not st_time:
                                continue
                                
                            # Parse time
                            try:
                                sh, sm = map(int, st_time.split(':'))
                                st_dt = now.replace(hour=sh, minute=sm, second=0, microsecond=0)
                                
                                # Only future showtimes
                                if st_dt > now:
                                    tasks.append({
                                        'id': st_id,
                                        'movie': title,
                                        'theatre': theatre_name,
                                        'city': city,
                                        'merchant': merchant,
                                        'start_time': st_time,
                                        'date': data.get('date'),
                                        'interval': args.interval
                                    })
                            except:
                                continue
                                
    except FileNotFoundError:
        logger.error(f"❌ File {file_path} not found!")
        return

    logger.info(f"✅ Found {len(tasks)} upcoming showtimes matching criteria.")
    
    if args.limit and len(tasks) > args.limit:
        logger.warning(f"⚠️ Limit applied: keeping first {args.limit} of {len(tasks)} tasks")
        tasks = tasks[:args.limit]
    
    if not tasks:
        logger.warning("No upcoming showtimes found. Exiting.")
        return

    # Start scraper
    scraper = GranularScraper()
    await scraper.monitor(tasks)

if __name__ == "__main__":
    asyncio.run(main())
