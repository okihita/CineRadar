
#!/usr/bin/env python3
"""
Final Snap Worker - Captures the final seating layout 5 minutes before showtime.
"""

import asyncio
import json
import logging
import sys
from datetime import datetime, timedelta
from pathlib import Path

from backend.infrastructure.scrapers.seat_scraper import TixSeatScraper
from backend.infrastructure.token_refresher import TokenRefresher

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)
logger = logging.getLogger("FinalSnap")

class FinalSnapWorker:
    def __init__(self):
        self.scraper = TixSeatScraper()
        self.token_refresher = TokenRefresher()
        self.processed_ids = set()

    async def _ensure_token(self):
        token = await self.token_refresher.ensure_valid_token()
        self.scraper.set_token(token.token)

    async def capture_final(self, task: dict):
        """Scrape and save the final snap for a showtime."""
        showtime_id = task["id"]
        logger.info(f"📸 Capturing FINAL SNAP for {task['movie']} at {task['theatre']} ({task['start_time']})")

        try:
            await self._ensure_token()
            results = await self.scraper.scrape_seats(
                showtime_ids=[showtime_id],
                merchant=task.get("merchant", "XXI")
            )

            if results:
                occ = results[0]
                # Add snapshot type for Firestore identification
                data = occ.to_dict()
                data["snapshot_type"] = "final"

                # Save locally as well
                self._save_local(data, task)

                # TODO: Direct Firestore upload if desired, or let upload_seats handle it
                # For now, we rely on local files + upload_seats

                logger.info(f"✅ Final snap captured for {showtime_id}")
                return True
        except Exception as e:
            logger.error(f"❌ Failed to capture final snap for {showtime_id}: {e}")
            return False

    def _save_local(self, data: dict, task: dict):
        output_dir = Path("data/final_snaps")
        output_dir.mkdir(parents=True, exist_ok=True)

        date_str = task["date"]
        filename = f"final_{date_str}_{task['id']}.json"

        with open(output_dir / filename, "w") as f:
            json.dump(data, f, indent=2)

    async def run(self, tasks: list[dict]):
        logger.info(f"🚀 Final Snap Worker started for {len(tasks)} showtimes")

        while True:
            now = datetime.now()
            pending = []

            for task in tasks:
                if task["id"] in self.processed_ids:
                    continue

                # Parse start time
                sh, sm = map(int, task["start_time"].split(":"))
                start_dt = now.replace(hour=sh, minute=sm, second=0, microsecond=0)

                # If crossover to next day (rare for this worker which runs daily)
                if now.hour > sh + 12: # Very late night/early morning check
                    continue

                # Trigger exactly 5 minutes before (or within 4-6 minutes window)
                trigger_time = start_dt - timedelta(minutes=5)

                if now >= trigger_time:
                    pending.append(task)
                    self.processed_ids.add(task["id"])
                elif now > start_dt:
                    # Missed it or already past
                    self.processed_ids.add(task["id"])

            if pending:
                logger.info(f"⏰ Triggering {len(pending)} final snaps...")
                await asyncio.gather(*(self.capture_final(t) for t in pending))

            # Sleep until next minute
            if len(self.processed_ids) >= len(tasks):
                logger.info("🏁 All showtimes processed. Exiting.")
                break

            await asyncio.sleep(30)

async def main():
    # Load today's movie data
    data_path = Path("data/movies_2025-12-23.json") # Example for now, should be dynamic
    if not data_path.exists():
        logger.error(f"❌ Data file {data_path} not found")
        return

    with open(data_path) as f:
        data = json.load(f)

    tasks = []
    now = datetime.now()
    date_str = data.get("date")

    for movie in data.get("movies", []):
        for _city, schedules in movie.get("schedules", {}).items():
            for theatre in schedules:
                for room in theatre.get("rooms", []):
                    for st in room.get("all_showtimes", []):
                        if isinstance(st, dict) and st.get("showtime_id"):
                            st_time = st["time"]
                            # Only future showtimes for today
                            sh, sm = map(int, st_time.split(":"))
                            st_dt = now.replace(hour=sh, minute=sm, second=0, microsecond=0)

                            if st_dt > now:
                                tasks.append({
                                    "id": st["showtime_id"],
                                    "movie": movie["title"],
                                    "theatre": theatre["theatre_name"],
                                    "merchant": theatre["merchant"],
                                    "start_time": st_time,
                                    "date": date_str
                                })

    worker = FinalSnapWorker()
    await worker.run(tasks)

if __name__ == "__main__":
    asyncio.run(main())
