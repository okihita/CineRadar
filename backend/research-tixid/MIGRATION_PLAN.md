# TIX ID Scraper API Migration Plan

This document outlines the step-by-step, atomic deployment strategy for migrating the CineRadar TIX ID scraper from a Playwright headless browser implementation to a fast, direct HTTP API implementation.

**Philosophy:** Make minimal, isolated changes. Deploy, manually test, verify production data (e.g., Firestore checks), and monitor before proceeding to the next step.

---

## FAQ: Untangling the Confusing "Refresh" Terminology

Because this project evolved over time, several scripts share very similar names but perform entirely different jobs. Let's break down the terminology clearly:

### The Two Types of Tokens
To understand the architecture, you first need to understand that TIX ID uses two different tokens:
1. **The "Short-Term Access Token" (expires every 30 mins):** This is the token the scrapers actually use in the HTTP headers (`Authorization: Bearer ...`) to fetch movie data.
2. **The "Long-Term Refresh Token" (expires every 91 days):** This token is *only* used to ask TIX ID to generate a new Short-Term Access Token without having to type in a phone number and password again.

### The Three Confusingly Named Scripts
*(Here is what each script actually does)*

1. **`token-refresh.yml` (The 60-Day GitHub Action)** 
   - **What it does:** Once every two months, this GitHub Action wakes up and runs `refresh_token.py`.
2. **`refresh_token.py` (The Heavy Playwright Login Script)**
   - **What it does:** It launches a headless Chrome browser, types in your phone/password, clicks the login button, and steals a brand new **Long-Term Refresh Token** (91 days) from the browser's storage. It saves this long-term token into Firestore.
3. **`token_refresher.py` (The Fast 30-Minute Internal Utility)**
   - **What it does:** Right before a scraper runs daily, it checks if the **Short-Term Access Token** has expired. If it has, this utility reads the long-term token from Firestore and sends a fast API ping to TIX ID (`POST /v1/users/refresh`) to instantly spawn a fresh 30-minute Short-Term Access Token so the scraper can do its job.

### Why this Migration Plan radically simplifies everything:
Instead of completely throwing away the Long-Term Refresh Token, we are going to adopt a **"Polite & Secure Hybrid"** approach. Corporate backends (Web Application Firewalls) treat frequent, repetitive `/login` requests as suspicious credential stuffing. 

To mimic a natural user who logs in once and stays logged in, **we will keep the 30-Minute `/refresh` loop exactly as it is today during daily scraping.** 

The monumental difference is how we get that initial Long-Term Refresh Token! 
- **Before:** We needed a heavy, fragile Playwright GitHub Action running every 60 days just to steal a token out of `localStorage`.
- **After:** We simply use our new 0.5-second RSA Encrypted `/login` API call once a month to natively generate the Long-Term token, store it in Firestore, and then happily use `/refresh` endpoints all day long.

**Playwright is 100% dead.** The scary 15-second Playwright GitHub Action is replaced by a safe, instant Python script. 

### Token Architecture: Before vs After

```mermaid
graph TD
    %% Styling
    classDef obsolete fill:#ffe0e0,stroke:#d32f2f,stroke-width:2px;
    classDef new fill:#e8f5e9,stroke:#2e7d32,stroke-width:2px;
    classDef neutral fill:#f5f5f5,stroke:#9e9e9e,stroke-width:1px;

    subgraph Before [Legacy Playwright Architecture]
        direction TB
        A1[GitHub Action: token-refresh.yml]:::obsolete -. Every 60 Days .-> B1
        B1["refresh_token.py (Playwright Headless Chrome)"]:::obsolete --> C1
        C1[(Firestore)]:::neutral -. 91-Day Refresh Token .-> D1
        D1["token_refresher.py (Internal Util)"]:::neutral -->|POST /v1/users/refresh Every 30 mins| E1[TIX ID API]
        E1 -->|30-Min Access Token| F1[Movie/Seat Scrapers]
    end

    subgraph After [New Polite API Architecture]
        direction TB
        D2[GitHub Action: token-refresh.yml]:::obsolete ---|DELETED| D2
        
        A2["RSA API Login (Instant Python Script)"]:::new -->|POST /v1/users/login Once a Month| C2
        C2[(Firestore)]:::neutral -. 91-Day Refresh Token .-> D2_new
        
        D2_new["token_refresher.py (Internal Util)"]:::neutral -->|POST /v1/users/refresh Every 30 mins| E2[TIX ID API]
        E2 -->|Brand New 30-Min Access Token| F2[Movie/Seat Scrapers]
    end
```

---

## Phase 1: The Authentication Backbone (DONE)

### Step 1: Replace `TokenRefresher.refresh_token()` (COMPLETED)
**Goal:** Prove that the RSA encrypted API login generates a valid JWT token that can be securely stored.
**Implementation Details:**
1. **[x] Direct API Login**: Replaced Playwright with a 0.5s `httpx` POST to `/v1/users/login`.
2. **[x] RSA-2048 Encryption**: Implemented native Python encryption to match TIX ID's security requirements.
3. **[x] Anti-Bot Bypass**: Discovered and implemented the mandatory 30-minute "Guest Token" handshake via `/v1/auth`.
4. **[x] Permanent Virtual Device**: Replaced random UUIDs with a stable, phone-derived `device_id` (MD5 hash) to look like a persistent device to TIX ID's firewall.

**Verification Results:**
- **Local:** Verified successful login and Firestore storage on ARM machine.
- **Security:** Confirmed that stable Device IDs prevent "Account Sharing" alerts.
- **Maintenance:** Added local `.env` loading and full lint/type coverage.

---

## Phase 2: Bypassing Login for Daily Scraping

### Context: The Strange History of `BaseScraper._login()`
You might be wondering: *"Wait, why was `BaseScraper._login()` logging in with Playwright if `TokenRefresher` already existed to get tokens?"*

This is a remnant of the **original architecture**. Early on, the scrapers was designed to be totally standalone and isolated. 
Later, when you implemented the fast 30-minute API `TokenRefresher`, that utility was built to store and fetch from Firestore. **But `BaseScraper` was never updated to use it yet!** 

### Do we even need to login for daily scrapes? (NO!)
Recent API analysis revealed a massive simplification: **The `/v1/movies` and `/v1/schedules/movies` endpoints do NOT require a full user login token!** They only require the 30-minute **Guest Token** (acquired via `POST /v1/auth`).

This means for our daily morning scrape—which focuses exclusively on building the catalog of movies and showtimes (Showtime IDs, prices, room types)—we don't need to read from Firestore, refresh a long-term token, or use Playwright to log in. We just ask `/v1/auth` for a fresh Guest Token.

**⚠️ CRITICAL DISTINCTION:** This Guest Token bypass *only* applies to the daily catalog scrape. The real-time JIT Seat Scrapers (which fetch the actual theatre seating layouts/JSON) **still strictly require a full User Access Token**. Those seat scrapers will continue to use the `TokenRefresher` API login we built in Phase 1.

### Step 2: Replace `BaseScraper._login()` with Guest Token (IN PROGRESS)
**Goal:** Stop using Playwright UI login for daily scrapes. Update the core base class so that all scrapers simply fetch a fresh Guest Token via API.

**Atomic Implementation Steps:**

#### Step 2.1: Create Guest Token Fetcher Module ✅ DONE
**File:** `backend/infrastructure/core/guest_token.py`
- Create standalone module with `fetch_guest_token()` async function
- Returns `GuestToken` dataclass with token and expiry metadata
- Zero risk - new file, doesn't modify existing code

**Verification:** ✅ PASSED (2026-03-01)
```bash
uv run python -m backend.scripts.test_guest_token
# Results: ✅ Guest token acquired (30 min validity)
#          ✅ Valid JWT structure (3 parts)
#          ✅ Fetched 33 movies from Jakarta
```

#### Step 2.2: Add Guest Token Method to BaseScraper ✅ DONE
**File:** `backend/infrastructure/core/guest_token.py`

**Changes Made:**
- Added import: `from backend.infrastructure.core.guest_token import GuestToken, fetch_guest_token`
- Added new method `_get_guest_token()` after `__init__()` - **additive only, no modifications to existing code**

| Aspect | Before | After |
|--------|--------|-------|
| Methods | 5 methods | 6 methods (additive) |
| `_login()` | Unchanged | Unchanged |
| Risk | N/A | **Zero** - additive only |
| Time | ~15s for login | ~0.5s for guest token |

**Verification:** ✅ PASSED (2026-03-01)
```bash
uv run python -c "
import asyncio
from backend.infrastructure.scrapers.base import BaseScraper
async def test():
    scraper = BaseScraper()
    guest = await scraper._get_guest_token()
    print(f'✅ Works: {guest is not None}')
    print(f'   auth_token set: {scraper.auth_token is not None}')
asyncio.run(test())
"
```

#### Step 2.3: Create API-only Scraper V2 ✅ DONE
**File:** `backend/infrastructure/core/tix_client_v2.py`
- New `CineRadarScraperV2` class using pure HTTP API
- Zero risk - new file, can run in parallel with V1 for comparison
- **Includes bug fix:** Checks `/v1/schedules/date` before fetching showtimes

**Bug Fix During Implementation:**
- Issue: Used `movie.get("movie_id")` but API requires `movie.get("id")` for schedule endpoints
- Symptom: All movies reported as "skipped" even when they had shows
- Fix: Changed to `movie.get("id") or movie.get("movie_id", "")`
- Test: BAUBAU city - KUYANK movie now correctly shows 4 showtimes

**Verification:** ✅ PASSED (2026-03-02)
```bash
uv run python -c "
import asyncio
from backend.infrastructure.core.tix_client_v2 import CineRadarScraperV2
async def test():
    scraper = CineRadarScraperV2()
    result = await scraper.scrape(specific_city='BAUBAU')
    print('Stats:', result.get('stats'))
asyncio.run(test())
"
# Results: movies_with_shows=7, movies_skipped=0, total_showtimes=12
```

#### Step 2.4: Add Firestore Integration ✅ DONE
**File:** `backend/infrastructure/core/tix_client_v2.py`

**Changes Made:**
- Added `SCHEDULES_V2` constant to `firestore_collections.py`
- Added `transform_for_firestore()` method - converts city-based results to movie-based documents
- Added `upload_to_firestore()` method - writes to `schedules_v2/{date}/movies/{movie_id}`
- Added `scrape_and_upload()` convenience method with `dry_run` option

**Document Structure (identical to V1):**
```typescript
// schedules_v2/{date}/movies/{movie_id}
{
  movie_id: string,
  title: string,
  poster: string,
  genres: string[],
  age_category: string,
  merchants: string[],
  is_presale: boolean,
  date: string,
  uploaded_at: string,
  source: "v2_api",
  cities: {
    [cityName: string]: Theatre[]
  }
}
```

**Verification:** ✅ PASSED (2026-03-02)
```bash
uv run python -c "
import asyncio
from backend.infrastructure.core.tix_client_v2 import CineRadarScraperV2
async def test():
    scraper = CineRadarScraperV2()
    result = await scraper.scrape_and_upload(specific_city='BAUBAU')
    print('Uploaded:', result.get('uploaded'))
asyncio.run(test())
"
# Results: Uploaded 7 movies to schedules_v2/2026-03-02/movies/
```

#### Step 2.5: Run V1 and V2 Comparison for SURABAYA ✅ DONE

**Test Date:** 2026-03-02

**V2 Scraper Results:**
```
City: SURABAYA
  Movies with shows: 25
  Movies skipped (no shows today): 4

SKIPPED MOVIES (upcoming/presale with no shows today):
  - THE BRIDE! [PRESALE]
  - SETAN ALAS! [PRESALE]
  - ENHYPEN [WALK THE LINE SUMMER EDITION] IN CINEMAS [PRESALE]
  - BRING ME THE HORIZON: L.I.V.E. IN SÃO PAULO [PRESALE]

MOVIES WITH SHOWS TODAY: 25 movies (311 total showtimes)
```

**Key Findings:**
1. ✅ V2 correctly skips 4 presale movies with no shows today
2. ✅ V2 includes 25 movies with actual showtimes
3. ✅ All skipped movies are marked as PRESALE
4. ✅ Uploaded to `schedules_v2/2026-03-02/movies/` for comparison

**Manual Verification Needed:**
- Compare V2 data in `schedules_v2` with V1 data in `schedules`
- Verify presale movies are correctly excluded
- Check showtime counts match between V1 and V2

#### Step 2.6: Admin Dashboard "Showtime Intelligence V2" Menu ✅ DONE

**Goal:** Add monitoring dashboard for V2 scraper results.

**Files Created/Modified:**
- `admin/src/components/Sidebar.tsx` - Added "Showtime Intelligence V2" menu item with `CalendarCheck` icon
- `admin/src/app/schedules_v2/page.tsx` - New page (created)
- `admin/src/app/api/schedules_v2/route.ts` - New API endpoint (created)

**Features:**
- Reads from `schedules_v2` collection
- Displays V2 info card explaining improvements
- Shows same schedule data format as V1

**Verification:** ✅ PASSED (2026-03-02)
- Menu item visible in sidebar
- Page loads at `/schedules_v2`
- API endpoint returns data from `schedules_v2` collection

#### Step 2.7: Add Rate Limiting to V2 Scraper ✅ DONE

**Goal:** Enforce max 4 requests/second to avoid triggering TIX.id WAF.

**Implementation:**
- Added `_rate_limit()` async method with `asyncio.sleep()` based timing
- Added `_request_count` counter for monitoring
- Default rate limit: 4 req/sec (configurable via constructor)

**Verification:** ✅ PASSED (2026-03-02)
```bash
# SURABAYA test: 60 requests in 15.2s = 3.9 req/sec effective
```

#### Step 2.8: Run National Scrape with V2 ✅ DONE

**Goal:** Scrape all cities with V2 scraper and upload to `schedules_v2`.

**Command:**
```bash
PYTHONPATH=. uv run python backend/scripts/run_national_scrape.py
```

**Results (2026-03-02):**
```
============================================================
National Scrape Complete!
============================================================
Date: 2026-03-02
Cities: 83
Stats: {
    'total_movies': 1129,
    'movies_with_shows': 966,
    'movies_skipped': 163,
    'total_showtimes': 8290
}
API requests: 2247
Movies uploaded: 50
Elapsed: 10.1 minutes
Effective rate: 3.7 req/sec
============================================================
```

**Key Findings:**
1. ✅ **83 cities** scraped successfully
2. ✅ **1,129 movies** checked across all cities
3. ✅ **966 (movie, city) pairs** had shows today
4. ✅ **163 pairs skipped** - presale/upcoming movies with no shows
5. ✅ **8,290 total showtimes** captured
6. ✅ **2,247 API requests** at 3.7 req/sec (within 4 req/sec limit)
7. ✅ **50 unique movies** uploaded to Firestore
8. ✅ **10.1 minutes** total time (faster than estimated 23 min)

**Post-Scrape Verification:**
- [x] Firestore `schedules_v2/2026-03-02/movies/` has 50 documents
- [x] Rate limiting worked (3.7 req/sec effective)
- [x] No API errors or timeouts
- [x] All 83 cities processed

---

## Phase 2.5: Data Migration (V2 → V1) ✅ DONE

**Goal:** Replace V1 data with V2 data and make V2 the new production scraper.

### Migration Results (2026-03-02)

```
============================================================
MIGRATION COMPLETE
============================================================
Deleted: 57 documents from schedules/2026-03-02/movies/
Copied:  50 documents to schedules/2026-03-02/movies/

Verification:
- V1 (schedules/2026-03-02/movies/): 50 documents
- V2 (schedules_v2/2026-03-02/movies/): 50 documents
- Historical data (2026-03-01): 57 documents (UNCHANGED)
============================================================
```

### Code Changes Made

| File | Change |
|------|--------|
| `backend/infrastructure/core/tix_client_v2.py` | Changed `SCHEDULES_V2` → `SCHEDULES` |
| `backend/infrastructure/firestore_collections.py` | Removed `SCHEDULES_V2` constant |
| `admin/src/components/Sidebar.tsx` | Removed V2 menu item |
| `admin/src/app/schedules_v2/page.tsx` | Deleted |
| `admin/src/app/api/schedules_v2/route.ts` | Deleted |

### Migration Script

Created `backend/scripts/migrate_v2_to_v1.py` with safety guards:
- Only operates on TODAY's date (hardcoded)
- Never touches historical data
- Requires manual confirmation
- Has dry-run mode

### Current State

- **V2 scraper now writes to `schedules` collection** (same as V1)
- **V2 data has 7 fewer movies** (presale movies correctly excluded)
- **Historical data preserved** (2026-03-01 and earlier untouched)
- **Admin dashboard simplified** (single Showtime Intelligence menu)

---

## V1 Playwright Scraper Status

**Will V1 still work tomorrow morning?** ✅ YES

**Reasons:**
- V2 scraper is a **new file** (`tix_client_v2.py`) - doesn't modify existing code
- `BaseScraper._login()` method is **unchanged**
- Existing GitHub Actions / Cloud Scheduler jobs still reference the old code
- No breaking changes to existing scrapers

**Files NOT modified (V1 remains functional):**
- `backend/infrastructure/core/tix_client.py` - Original Playwright scraper
- `backend/infrastructure/scrapers/base.py` - Only added `_get_guest_token()` method (additive)

```
1. GET /v1/auth → Guest Token
2. For each city:
   a. GET /v1/movies?city_id=X → List of movies
   b. For each movie:
      i. GET /v1/schedules/date?schedule_id=M&city_id=C
      ii. Check if TODAY has is_any_schedule: true
      iii. If false: SKIP this movie in THIS city
      iv. If true: GET /v1/schedules/movies/M?city_id=C&date=TODAY
```

**Critical: Per-City Schedule Check**

The `is_any_schedule` check is **per (movie, city) pair**, not per movie globally:
- Same movie may have shows TODAY in Jakarta but not in Bandung
- API: `GET /v1/schedules/date?schedule_id={movie_id}&city_id={city_id}`
- Decision to skip/scrape is made independently for each city

**Example:**
```
Movie: "Captain America"
├── Jakarta:    is_any_schedule=true  → SCRAPE showtimes
├── Bandung:    is_any_schedule=false → SKIP (no shows today)
└── Surabaya:   is_any_schedule=true  → SCRAPE showtimes
```

**JIT Queue Integration:**
Only showtimes from (movie, city) pairs with `is_any_schedule=true` are queued for JIT seat scraping. This prevents:
- Wasted JIT API calls for movies not playing today
- Missing seat data for cities where movie IS playing today

**Firestore Collection: schedules_v2**

V2 scraper writes to a NEW collection `schedules_v2` with identical structure to `schedules`:

```
### Firestore Collection Structure

**Note:** There is NO root-level `movies` collection. All schedule data is stored as subcollections under `schedules/{date}/movies/{movie_id}`.

**Document Structure (both V1 and V2 use identical schema):**
```typescript
// schedules/{date}/movies/{movie_id} or schedules_v2/{date}/movies/{movie_id}
{
  "movie_id": "1899679775128117248",
  "title": "TITIP BUNDA DI SURGA-MU",
  "poster": "https://...",
  "genres": ["Drama", "Action"],
  "age_category": "17+",
  "merchants": ["CGV", "XXI"],
  "is_presale": false,
  "date": "2026-03-02",
  "uploaded_at": "2026-03-02T00:13:00Z",
  "cities": {                          // <-- Per-city schedules
    "JAKARTA": [
      {
        "theatre_id": "123",
        "theatre_name": "CGV Grand Indonesia",
        "merchant": "CGV",
        "address": "Jl. Harsono No.1...",
        "rooms": [
          {
            "category": "Regular",
            "price": "Rp 75.000",
            "showtimes": ["10:00", "12:30"],      // Available times
            "all_showtimes": [...],              // All times with status
            "past_showtimes": ["08:00"]          // Past/unavailable times
          }
        ]
      }
    ],
    "BANDUNG": [...]  // <-- Empty if is_any_schedule=false for today
  }
}
```

**Collection Comparison:**
```
schedules/                          # V1 (current - includes upcoming movies)
├── 2026-03-02/
│   └── movies/
│       ├── 1899679775128117248    # Movie playing TODAY
│       ├── 1973311976000012288    # Movie playing TODAY
│       └── 2098765432109876543    # UPCOMING movie (no shows today - BUG!)

schedules_v2/                       # V2 (new - excludes upcoming movies)
├── 2026-03-02/
│   └── movies/
│       ├── 1899679775128117248    # Same content as V1
│       └── 1973311976000012288    # Same content as V1
│       # 2098765432109876543 NOT HERE - skipped (is_any_schedule=false)
```

| Aspect | V1 (`schedules`) | V2 (`schedules_v2`) |
|--------|------------------|---------------------|
| Document Schema | Same | Same |
| Movies with shows TODAY | ✅ Included | ✅ Included (same content) |
| Upcoming movies | ✅ Included (bug!) | ❌ NOT included |
| Per-city check | No | Yes (`is_any_schedule`) |
| Document count | More | Fewer (filtered) |

**Migration Path:**
1. V2 scraper runs in parallel with V1
2. Compare `schedules` vs `schedules_v2` for same date
3. Verify V2 has correct subset (no upcoming movies)
4. Switch JIT dispatcher to read from `schedules_v2`
5. Deprecate V1 collection

**Final Changes (after atomic steps verified):**
1. Modify `_login` in `backend/infrastructure/scrapers/base.py` to delete the Playwright form-filling logic entirely.
2. Replace it with a direct `httpx.post("https://api-b2b.tix.id/v1/auth")` call to fetch a newly minted Guest Token.
3. Assign the returned token to `self.auth_token` for the legacy `CineRadarScraper` to inherit.
*(Playwright will still be initialized, but only for navigating the movie schedules, not for logging in).*

**Verification:**
- **Local:** Run a limited local scrape (e.g., `uv run python -m backend.cli --schedules --city "JAKARTA"`). Watch the logs to confirm the "Logging in via direct API" message appears and scraping continues flawlessly.
- **Data Check:** Verify that the daily scrape output still correctly pushes data to Firestore. The scraping should take exactly the same amount of time, except the initial 15-second UI login delay will be gone.

---

## Bug Fix: The "Wrong Date" Issue

### Problem Description
The current `_fetch_movie_schedule()` implementation has a critical bug:

**Current (Wrong) Behavior:**
1. Navigate to movie page: `app.tix.id/movies/{slug}-{movie_id}/{today_date}`
2. Scrape whatever showtimes appear on the page

**The Bug:** For presale/upcoming movies, the TIX.id website shows the FIRST available date, not today's date. If a movie opens tomorrow, the page shows tomorrow's showtimes even though we requested today.

**Impact:**
- Wasted resources scraping movies with no shows today
- Wrong data: storing future showtimes as if they were today
- Slower scraping: unnecessary page loads for movies not playing today

### The Fix: Check `/v1/schedules/date` First

**Correct (New) Behavior:**
```
For each movie in city:
1. GET /v1/schedules/date?schedule_id={movie_id}&city_id={city_id}
2. Check if TODAY has is_any_schedule: true
3. If false: SKIP this movie (no shows today)
4. If true: GET /v1/schedules/movies/{movie_id}?date={today}
```

**Example API Response:**
```json
{
  "data": [
    {"date": "2026-02-26", "is_any_schedule": true},   ← Has shows
    {"date": "2026-02-27", "is_any_schedule": false},
    {"date": "2026-03-01", "is_any_schedule": false},  ← TODAY - no shows!
    ...
  ]
}
```

This fix will be implemented in Step 2.3 (V2 Scraper) as part of the pure API approach.

---

## Phase 3: Moving to Full API Scraping

### Step 3: Replace `/v1/movies` Fetching
**Goal:** Migrate the scraping of the main "NOW PLAYING" movies list from Playwright interception to a direct `httpx` API call.
**Changes:**
1. In `tix_client.py` (`CineRadarScraper.scrape`), remove the logic that uses Playwright to navigate to `app.tix.id/cities` and intercept the `/v1/movies` route.
2. Replace it with a direct `httpx.AsyncClient` GET request to `https://api-b2b.tix.id/v1/movies?city_id={id}&movie_type=NOW_PLAYING&timezone=7`, utilizing the token fetched in Phase 2.
3. *Note: Keep Playwright initialized in this step because `_fetch_movie_schedule` still relies on it.*

**Verification:**
- **Local:** Run the scraper locally. Verify it successfully hits the API and parses the first layer of movie data (title, genres, poster).
- **Deployment:** Deploy the branch. Let the daily scraper run.
- **Data Check:** Verify the exact same number of movies are being scraped across the cities as before.

### Hypothesis: API Rate Limiting & Scrape Duration
You are absolutely correct about the $O(C \times M \times P)$ complexity. To get all the showtime IDs, the nested looping structure demands proportional API hits:
$O(\text{Cities}) \times O(\text{Movies\_Per\_City}) \times O(\text{Pages\_Per\_Movie})$

**Theoretical Calculation per Scrape (National):**
1. **Fetch Guest Token:** 1 hit
2. **Fetch Cities:** 1 hit (or hardcoded)
3. **Fetch Movies per City:** 85 active cities = 85 hits
4. **Fetch Schedules:** 
   - *Assumptions:* An average city has ~15 movies playing. 
   - *Base Combinations:* $85 \text{ cities} \times 15 \text{ movies} \approx 1,275$ schedule page 1 hits.
   - *Pagination Multiplier:* Only blockbuster movies in massive metropolitan cities (Jakarta, Bandung, Surabaya) span multiple pages. Let's assume a 10-15% pagination overhead $\approx 150$ extra hits.
   
**Total National API Hits** $\approx 1 + 1 + 85 + 1275 + 150 \approx \textbf{1,512 hits}$

**Duration at Gentle Speeds (Single Thread):**
- At **2 requests/second:** $\approx 756\text{ sec}$ (12.6 minutes)
- At **1 request/second:** $\approx 1512\text{ sec}$ (25.2 minutes)

Wait, remember the **GitHub Actions Matrix Strategy**! 
Your `daily-morning-scrape.yml` uses parallel workers (`Batch 0-8`). That means 9 parallel servers are running `cli.py` simultaneously! 
If each of the 9 workers is scanning $\approx 10$ cities:
- Each worker makes $\approx 160$ API hits.
- If we set the internal `aiolimiter` to **1 req/sec** per worker, each worker finishes in $\approx 2.6 \text{ minutes}$.
- **Warning:** However, 9 concurrent workers hitting at 1 req/sec means your global load on TIX ID's firewall is actually **9 req/sec**. 

To be extremely safe and gentle to their WAF, we should calculate the rate limit setting based on the matrix concurrency.

### Step 4: Replace `/v1/schedules/movies` Fetching
**Goal:** Migrate the highly intensive schedule fetching logic away from Playwright routing.
**Changes:**
1. In `tix_client.py` (`_fetch_movie_schedule`), remove the Playwright `page.route` interception.
2. Replace it with direct rate-limited `httpx` GET requests to `v1/schedules/movies/{movie_id}`.
3. Apply `aiolimiter.AsyncLimiter(max_rate=1, time_period=1)` around the API calls to enforce a strict local 1 req/sec limit per worker.

**Verification:**
- **Local:** Run the scraper locally with the `--schedules` flag. Watch the output to ensure the rate limiter smoothly spaces out the API calls without throwing HTTP 429 Too Many Requests errors.
- **Deployment:** Deploy the branch. Trigger the daily scraper manually or let the cron job run.
- **Data Check:** Review Firestore to ensure theatre rooms, showtimes, and `is_available` flags are correctly populated for the movies. Wait and monitor over a 24-48 hour window to ensure stability.

---

## Phase 4: The Cleanup

### Step 5: Complete Playwright Eradication
**Goal:** Entirely delete Playwright from the codebase and build pipelines now that it is functionally dead code.
**Changes:**
1. Remove all `playwright.async_api` imports and initializations (`start()`, `browser.launch()`, `new_context()`, `new_page()`) from `tix_client.py`, `base.py`, and `refresh_token.py`.
2. Delete `uv run playwright install chromium` and `uv run playwright install-deps chromium` commands from ALL GitHub Actions workflow `.yml` files.
3. Run `uv remove playwright` to remove the package dependency permanently.

**Verification:**
- **Local:** `uv sync` to simulate the clean environment, then run the scraper tests. Ensure the script runs instantly.
- **Deployment:** Deploy the PR. Observe the GitHub Action build logs. The "Install dependencies" step, which used to take minutes downloading Chromium, should now finish in a few seconds. The entire Action execution time should drop drastically.
