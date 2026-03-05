# Initial Layout Plan - Accurate Audience Calculation

## Problem Statement

TIX.id API seat status codes cannot distinguish between:
- **Sold seats** (actually booked by moviegoers)
- **Blocked/broken seats** (maintenance, broken seats)
- **Walking spaces/utility areas** (aisles, hallways)

Current status codes:
- `1`: Available (can purchase)
- `5, 6`: Unavailable (could be sold OR blocked)

This causes **overestimation of audience** when we count all unavailable seats as "sold".

## Proposed Solution

### Two-Phase Seat Scraping

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         DAILY WORKFLOW TIMELINE                          │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  03:00                    04:00                    06:00                 │
│    │                        │                        │                   │
│    ▼                        ▼                        ▼                   │
│  ┌──────────────┐      ┌──────────────┐      ┌──────────────┐          │
│  │   V2 SCRAPER │      │  INITIAL     │      │   POST       │          │
│  │   Showtimes  │      │  LAYOUT      │      │   PROCESS    │          │
│  │   Only       │      │  SCRAPER     │      │              │          │
│  └──────────────┘      └──────────────┘      └──────────────┘          │
│         │                     │                     │                   │
│         │                     │                     │                   │
│    ~15 minutes           ~1 hour               ~1 minute                │
│    4 req/sec             5 req/sec                                        │
│    Guest Token           Login Token                                       │
│                                                                          │
├─────────────────────────────────────────────────────────────────────────┤
│                         JIT WORKFLOW (hourly)                            │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  T-30min before showtime                                                 │
│    │                                                                     │
│    ▼                                                                     │
│  ┌──────────────┐                                                       │
│  │     JIT      │                                                       │
│  │   SCRAPER    │                                                       │
│  │              │                                                       │
│  │ Final Layout │                                                       │
│  └──────────────┘                                                       │
│         │                                                               │
│         ▼                                                               │
│  audience = final_unavailable - initial_unavailable                     │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### Audience Calculation Formula

```python
audience_count = final_unavailable - initial_unavailable
audience_pct = (audience_count / total_seats) * 100
```

**Assumptions:**
- Seats blocked in the morning remain blocked throughout the day
- Any NEW unavailable seats between morning and T-30min were actually sold
- This is a **lower bound estimate** (some seats may have been sold before 4am scrape)

## Detailed Schedule

### 03:00 - V2 Scraper (Showtimes Only)
- **Duration**: ~15 minutes
- **Rate Limit**: 4 req/sec
- **Auth**: Guest Token (30-min expiry, easy to refresh)
- **Output**: `schedules/{date}/movies/{movie_id}`

### 04:00 - Initial Layout Scraper (NEW)
- **Duration**: ~1 hour (estimated)
- **Rate Limit**: 5 req/sec
- **Auth**: Login Token (30-min expiry, needs refresh handling)
- **Input**: Today's showtimes from `schedules/{date}/movies/`
- **Output**: Initial layouts to `movie_performance/{movie_id}/days/{date}/showtimes/{showtime_id}`

#### Time Estimation
```
Total showtimes per day: ~500-1000 (estimate)
Rate limit: 5 req/sec
Time = 1000 showtimes / 5 req/sec = 200 seconds = ~3.3 minutes (ideal)

But with:
- Token refresh overhead (every 25 min): ~30 sec each
- Network latency: ~100-200ms per request
- Error retries: ~5% overhead

Estimated total: ~5-10 minutes for 1000 showtimes
Conservative estimate: ~15-30 minutes
```

### 06:00 - Post-Processing
- **Duration**: ~1 minute
- **Tasks**: Snapshots, theatre sync, logs

## Token Management for Initial Layout Scraper

### Challenge
Seat layout API requires **Login Token** (not Guest Token):
- Login tokens expire in 30 minutes
- Initial layout scrape may take 15-30 minutes
- Need to refresh token mid-scrape

### Solution: Token-Aware Batch Processing

```python
class InitialLayoutScraper:
    TOKEN_REFRESH_THRESHOLD = 25 * 60  # 25 minutes in seconds
    
    async def scrape_all_showtimes(self, showtimes: list[dict]) -> None:
        """Scrape all showtimes with automatic token refresh."""
        token = await self.get_valid_token()
        token_acquired_at = time.time()
        
        for i, showtime in enumerate(showtimes):
            # Check if token needs refresh
            elapsed = time.time() - token_acquired_at
            if elapsed > self.TOKEN_REFRESH_THRESHOLD:
                logger.info(f"🔄 Token aging ({elapsed/60:.1f}min), refreshing...")
                token = await self.refresh_token()
                token_acquired_at = time.time()
            
            # Scrape with rate limiting
            await self.rate_limiter.acquire()
            layout = await self.fetch_seat_layout(showtime, token)
            
            if layout:
                await self.save_initial_layout(showtime, layout)
            
            # Progress logging every 100 showtimes
            if (i + 1) % 100 == 0:
                logger.info(f"📊 Progress: {i+1}/{len(showtimes)} showtimes")
```

### Token Refresh Strategy
1. **Primary**: Use existing API refresh endpoint manually inside the scraper.
2. **Timing**: Refresh proactively when token age > 25 minutes.
3. **Dead Token Fallback**: If the refresh token itself is completely dead (API returns 401 on refresh), the script will immediately abort execution. It is safer to fail the GitHub Action than continually hammer the API with a dead token and risk an IP ban.

## Data Structure Changes

### Firestore Path
```
movie_performance/{movie_id}/days/{date}/showtimes/{showtime_id}
```

### New Schema
```python
{
    "showtime_id": "xxx",
    "movie_id": "yyy",
    "theatre_id": "zzz",
    "theatre_name": "CGV Paris Van Java",
    "showtime": "14:30",
    "date": "2026-03-02",
    "total_seats": 120,
    
    # Morning scrape (initial state) - NEW
    "initial_layout_compressed": bytes,      # gzip compressed layout
    "initial_unavailable": 12,               # Blocked/broken seats
    "initial_available": 108,
    "initial_scraped_at": "2026-03-02T04:15:00+07:00",
    
    # JIT scrape (final state) - populated by JIT scraper
    "final_layout_compressed": bytes,
    "final_unavailable": 45,
    "final_available": 75,
    "final_scraped_at": "2026-03-02T14:00:00+07:00",
    
    # Calculated audience (the actual metric we want)
    "audience_count": 33,          # final_unavailable - initial_unavailable
    "audience_pct": 27.5,          # audience_count / total_seats * 100
    
    # Legacy fields (for backward compatibility)
    "sold_seats": 45,              # = final_unavailable
    "occupancy_pct": 37.5,         # = final_unavailable / total_seats
    "layout_compressed": bytes,    # = final_layout_compressed
    "scraped_at": "2026-03-02T14:00:00+07:00",  # = final_scraped_at
}
```

## Implementation Plan

### Phase 1: Morning Initial Layout Scraper

#### 1.1 Create Initial Layout Scraper Script
- **File**: `backend/scripts/scrape_initial_layouts.py`
- **Dependencies**:
  - `backend/infrastructure/token_refresher.py` (for token management)
  - `backend/infrastructure/core/seat_scraper.py` (for seat layout API)
  - `aiolimiter` (for rate limiting)

```python
#!/usr/bin/env python3
"""
Initial Layout Scraper - Scrape seat layouts for all showtimes at 04:00.

This captures the "baseline" unavailable seats (blocked/broken) before
any sales happen, allowing accurate audience calculation.

Usage:
    PYTHONPATH=. uv run python backend/scripts/scrape_initial_layouts.py
"""

import argparse
import asyncio
import gzip
import json
import logging
import os
import sys
import time
from datetime import UTC, datetime
from typing import Any

sys.path.insert(0, ".")

from aiolimiter import AsyncLimiter
from google.cloud import firestore
from google.oauth2 import service_account

from backend.domain.time import JAKARTA_TZ
from backend.infrastructure.firestore_collections import MOVIES, SCHEDULES
from backend.infrastructure.token_refresher import TokenRefresher

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger(__name__)

# Constants
RATE_LIMIT = 5  # requests per second
TOKEN_REFRESH_THRESHOLD = 25 * 60  # 25 minutes in seconds


class InitialLayoutScraper:
    """Scrape initial seat layouts for all showtimes."""
    
    def __init__(self, rate_limit: int = RATE_LIMIT):
        self.rate_limiter = AsyncLimiter(rate_limit, 1)
        self.token_refresher = TokenRefresher()
        self.db = self._get_firestore_client()
        self.token: str | None = None
        self.token_acquired_at: float = 0
        
    def _get_firestore_client(self) -> firestore.Client:
        """Initialize Firestore client."""
        sa_json = os.environ.get("FIREBASE_SERVICE_ACCOUNT")
        if sa_json:
            sa_info = json.loads(sa_json)
            credentials = service_account.Credentials.from_service_account_info(sa_info)  # type: ignore
            return firestore.Client(credentials=credentials, project=sa_info["project_id"])
        return firestore.Client()
    
    async def get_valid_token(self) -> str:
        """Get a valid token, refreshing if necessary."""
        token = await self.token_refresher.ensure_valid_token()
        if not token:
            raise RuntimeError("Failed to acquire valid token")
        return token
    
    async def fetch_seat_layout(self, showtime_id: str, merchant: str, token: str) -> dict | None:
        """Fetch seat layout from TIX API."""
        # Implementation similar to JIT scraper
        # ...
        pass
    
    async def save_initial_layout(self, showtime: dict, layout_data: dict) -> None:
        """Save initial layout to Firestore."""
        movie_id = showtime["movie_id"]
        date = showtime["date"]
        showtime_id = showtime["showtime_id"]
        
        # Calculate occupancy
        total_seats, unavailable, layout_grid = self._calculate_occupancy(layout_data)
        
        # Compress layout
        layout_json = json.dumps(layout_grid)
        layout_compressed = gzip.compress(layout_json.encode("utf-8"))
        
        # Save to Firestore
        doc_ref = (
            self.db.collection("movie_performance")
            .document(movie_id)
            .collection("days")
            .document(date)
            .collection("showtimes")
            .document(showtime_id)
        )
        
        doc_ref.set({
            "showtime_id": showtime_id,
            "movie_id": movie_id,
            "theatre_id": showtime.get("theatre_id"),
            "theatre_name": showtime.get("theatre_name"),
            "showtime": showtime.get("showtime"),
            "date": date,
            "total_seats": total_seats,
            
            # Initial state
            "initial_layout_compressed": layout_compressed,
            "initial_unavailable": unavailable,
            "initial_available": total_seats - unavailable,
            "initial_scraped_at": datetime.now(JAKARTA_TZ).isoformat(),
        }, merge=True)
    
    async def scrape_all_showtimes(self, showtimes: list[dict]) -> dict[str, int]:
        """Scrape all showtimes with token refresh handling."""
        stats = {"total": len(showtimes), "success": 0, "failed": 0, "skipped": 0}
        
        # Get initial token
        self.token = await self.get_valid_token()
        self.token_acquired_at = time.time()
        
        for i, showtime in enumerate(showtimes):
            # Check token refresh
            elapsed = time.time() - self.token_acquired_at
            if elapsed > TOKEN_REFRESH_THRESHOLD:
                logger.info(f"🔄 Refreshing token (age: {elapsed/60:.1f}min)...")
                self.token = await self.get_valid_token()
                self.token_acquired_at = time.time()
            
            # Rate limiting
            await self.rate_limiter.acquire()
            
            # Fetch layout
            try:
                layout = await self.fetch_seat_layout(
                    showtime["showtime_id"],
                    showtime["merchant"],
                    self.token
                )
                
                if layout:
                    await self.save_initial_layout(showtime, layout)
                    stats["success"] += 1
                else:
                    stats["failed"] += 1
            except Exception as e:
                logger.error(f"Error scraping {showtime['showtime_id']}: {e}")
                stats["failed"] += 1
            
            # Progress logging
            if (i + 1) % 100 == 0:
                logger.info(f"📊 Progress: {i+1}/{len(showtimes)} ({stats['success']} ok, {stats['failed']} fail)")
        
        return stats


async def main() -> None:
    """Main entry point."""
    logger.info("=" * 60)
    logger.info("Initial Layout Scraper")
    logger.info("=" * 60)
    
    # Get today's date
    today = datetime.now(JAKARTA_TZ).strftime("%Y-%m-%d")
    logger.info(f"📅 Date: {today}")
    
    # Load showtimes from schedules
    scraper = InitialLayoutScraper()
    showtimes = await scraper.load_showtimes(today)
    
    if not showtimes:
        logger.warning("⚠️ No showtimes found - exiting")
        return
    
    logger.info(f"🎬 Found {len(showtimes)} showtimes to scrape")
    logger.info(f"⏱️ Estimated time: {len(showtimes) / RATE_LIMIT / 60:.1f} minutes")
    
    # Run scraper
    start = time.time()
    stats = await scraper.scrape_all_showtimes(showtimes)
    elapsed = time.time() - start
    
    logger.info("=" * 60)
    logger.info("Initial Layout Scraping Complete!")
    logger.info(f"  Total: {stats['total']}")
    logger.info(f"  Success: {stats['success']}")
    logger.info(f"  Failed: {stats['failed']}")
    logger.info(f"  Elapsed: {elapsed/60:.1f} minutes")
    logger.info("=" * 60)


if __name__ == "__main__":
    asyncio.run(main())
```

#### 1.2 Update Morning Workflow
- **File**: `.github/workflows/daily-morning-scrape.yml`

```yaml
name: Daily Morning Scrape

on:
  schedule:
    # 03:00 Jakarta time (20:00 UTC previous day)
    - cron: '0 20 * * *'
  workflow_dispatch:

jobs:
  scrape:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Python
        uses: actions/setup-python@v5
        with:
          python-version: '3.12'
      
      - name: Install uv
        uses: astral-sh/setup-uv@v4
      
      - name: Install dependencies
        run: uv sync
      
      # Step 1: V2 Scraper (03:00 Jakarta)
      - name: Run V2 API scraper
        run: PYTHONPATH=. uv run python backend/scripts/run_national_scrape.py
        env:
          FIREBASE_SERVICE_ACCOUNT: ${{ secrets.FIREBASE_SERVICE_ACCOUNT }}
      
      # Step 2: Post-Processing
      - name: Post-processing (snapshots, theatres, logs)
        run: PYTHONPATH=. uv run python backend/scripts/post_process.py
        env:
          FIREBASE_SERVICE_ACCOUNT: ${{ secrets.FIREBASE_SERVICE_ACCOUNT }}
      
      # Step 3: Initial Layout Scraper (04:00 Jakarta)
      - name: Scrape initial seat layouts
        run: PYTHONPATH=. uv run python backend/scripts/scrape_initial_layouts.py
        env:
          FIREBASE_SERVICE_ACCOUNT: ${{ secrets.FIREBASE_SERVICE_ACCOUNT }}
```

### Phase 2: JIT Scraper Updates

#### 2.1 Update JIT Scraper to Calculate Audience
- **File**: `backend/functions/scraper/main.py`

```python
def save_snapshot(...):
    # ... existing code ...
    
    # Load initial layout
    initial_data = get_initial_layout(db, movie_id, date, showtime_id)
    initial_unavailable = 0
    if initial_data and initial_data.exists:
        initial_unavailable = initial_data.to_dict().get("initial_unavailable", 0)
    
    # Calculate audience
    audience_count = max(0, sold_seats - initial_unavailable)
    audience_pct = (audience_count / total_seats * 100) if total_seats > 0 else 0
    
    snapshot_data = {
        # ... existing fields ...
        
        # New audience fields
        "initial_unavailable": initial_unavailable,
        "final_unavailable": sold_seats,
        "audience_count": audience_count,
        "audience_pct": round(audience_pct, 1),
    }
```

### Phase 3: Admin Dashboard Updates

#### 3.1 Update Performance Components
- Show `audience_count` and `audience_pct` as primary metrics
- Add tooltip: "Initial: X blocked → Final: Y unavailable → Audience: Y-X sold"
- Keep legacy fields for backward compatibility

## Execution Timeline

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     DAILY WORKFLOW TIMELINE                              │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  03:00                    04:00                    05:00-06:00           │
│    │                        │                           │                │
│    ▼                        ▼                           ▼                │
│  V2 Scraper           Initial Layout              Post-Process          │
│  (~15 min)            Scraper (~30 min)           (~1 min)              │
│                                                                          │
│  4 req/sec            5 req/sec                                         │
│  Guest Token          Login Token                                        │
│  (no refresh)         (auto-refresh at 25min)                            │
│                                                                          │
├─────────────────────────────────────────────────────────────────────────┤
│                     HOURLY JIT WORKFLOW                                  │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  Every hour, T-30min before showtimes                                    │
│    │                                                                     │
│    ▼                                                                     │
│  JIT Scraper                                                             │
│  - Fetch final layout                                                    │
│  - Load initial_unavailable from Firestore                               │
│  - Calculate audience = final - initial                                  │
│  - Save with new schema                                                  │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

## Todo List

### Phase 1: Morning Initial Layout Scraper
- [ ] Create `backend/scripts/scrape_initial_layouts.py`
  - [ ] Implement `InitialLayoutScraper` class
  - [ ] Add token refresh handling (25-min threshold)
  - [ ] Add rate limiting (5 req/sec)
  - [ ] Add progress logging (every 100 showtimes)
  - [ ] Add `load_showtimes()` to read from `schedules/{date}/movies/`
  - [ ] Add `fetch_seat_layout()` using Login Token
  - [ ] Add `save_initial_layout()` with gzip compression
- [ ] Update `.github/workflows/daily-morning-scrape.yml`
  - [ ] Add step after post-processing

### Phase 2: JIT Scraper Updates
- [ ] Update `backend/functions/scraper/main.py`
  - [ ] Add `get_initial_layout()` helper function
  - [ ] Update `save_snapshot()` to calculate audience delta
  - [ ] Add new fields to schema

### Phase 3: Admin Dashboard Updates
- [ ] Update `ShowtimeTable.tsx` to display audience metrics
- [ ] Add breakdown tooltip showing initial vs final
- [ ] Update `PerformanceDetail.tsx` with audience visualization

### Phase 4: Testing & Validation
- [ ] Test initial layout scraper locally
- [ ] Verify token refresh handling
- [ ] Test morning workflow end-to-end
- [ ] Verify JIT scraper with initial layout data
- [ ] Validate audience calculations
