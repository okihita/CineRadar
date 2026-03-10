# T-15 Scraper & Daily Pipeline Implementation Plan

This document outlines the meticulous plan to adjust our daily pipeline schedules, improve the semantics of our GitHub Actions, and implement the T-15 JIT seat scraper to capture highly accurate final occupancy data.

## 1. Schedule Adjustments for Morning Pipeline

We want to tighten the morning scrape schedule so that initial layouts are captured shortly after the movies and showtimes are discovered.

### Current Schedule
* **1:15 AM WIB** (`18:15 UTC`): Daily Initial Scrape (Movies & Showtimes)
* **4:00 AM WIB** (`21:00 UTC`): Metadata Backfill
* **4:15 AM WIB** (`21:15 UTC`): Initial Layouts

### Target Schedule
* **1:15 AM WIB** (`18:15 UTC`): Daily Initial Scrape (Movies & Showtimes)
* **1:30 AM WIB** (`18:30 UTC`): Scrape Movie Details (previously "Metadata Backfill") - captures metadata for newly discovered movies.
* **1:45 AM WIB** (`18:45 UTC`): Scrape Initial Layouts - captures the baseline blocked seats 30 mins after movies are populated.

**Action Items:**
1. Update `.github/workflows/scrape_movie_details.yml` cron to `30 18 * * *`.
2. Update `.github/workflows/daily-initial-layouts.yml` cron to `45 18 * * *`.

---

## 2. Semantic Renaming of GitHub Actions

The current action names and job steps in `.github/workflows/scrape_movie_details.yml` and others use terms like "Metadata Backfill" which are not instantly semantic when scanning GitHub Action logs.

**Action Items for `.github/workflows/scrape_movie_details.yml`:**
- **File Name:** Keep or rename slightly for consistency, e.g., `scrape-movie-details.yml`.
- **Workflow Name:** Change `name: Daily Metadata Backfill` to `name: Scrape Movie Details`.
- **Job Name:** Change `job: backfill` to `job: scrape-details`.
- **Step Name:** Change `name: Backfill Movie Details` to `name: Scrape Missing Movie Details`.

**Action Items for `.github/workflows/daily-initial-scrape.yml`:**
- Ensure steps are clearly named (e.g., "Scrape National Movies & Showtimes").

**Action Items for `.github/workflows/daily-initial-layouts.yml`:**
- Ensure steps are clearly named (e.g., "Scrape Morning Baseline Seat Layouts").

---

## 3. Implementation of the T-15 JIT Scraper

### Objective
Capture seat layouts twice before the showtime:
1. **Morning Baseline (1:45 AM)**: To detect cinema-blocked seats.
2. **T-30 Update**: Scrape at 30 minutes before showtime to update audience numbers.
3. **T-15 Update**: Scrape at 15 minutes before showtime for the final update. 
   - *Graceful Fallback:* If the showtime is already closed at T-15 (TIX.id returns an error or empty seats), we do **not** overwrite the T-30 data with zeros. We assume the T-30 snapshot is the final audience count.

### 3.1. Infrastructure Load & Capacity Analysis
* **Volume:** Will double the JIT jobs from ~8,240/day to ~16,480/day.
* **Peak Load:** ~42 jobs/minute.
* **Capacity:** Our Scraper function (`max-instances=5`) can handle ~76 jobs/minute.
* **API Rate Limit:** ~0.7 requests/sec, which is well below the TIX.id safe limit of 1-2 req/sec.
* **Conclusion:** The system can safely handle the T-15 scrape without infrastructure scaling.

### 3.2. Modifying the Dispatcher
File: `backend/functions/dispatcher/main.py`
Currently, the dispatcher evaluates a single window: `[T+30, T+35)`.
We will update it to evaluate two distinct windows during every 5-minute execution:
- **Window 1 (T-30):** `[T+30, T+35)`
- **Window 2 (T-15):** `[T+15, T+20)`

The dispatcher will add a new field to the Pub/Sub payload: `scrape_phase: "T-30" | "T-15"`.

### 3.3. Modifying the Scraper
File: `backend/functions/scraper/main.py`
The scraper reads the Pub/Sub message. It fetches the layout from the TIX.id API.

**Logic Update:**
1. Execute the API call.
2. Check the result. 
   - If success: Process the layout and calculate occupancy.
   - If HTTP 400 (`EXPIRED_EVENT_DETAIL`) or similar: The showtime is closed.
3. **Handling T-15 Closure:**
   - If `scrape_phase == "T-15"` and the API indicates the showtime is closed (or returns an empty/unusable layout), we **abort the write operation** or log a "skipped" status. We explicitly do *not* overwrite the existing Firestore document so that the T-30 data is preserved as the final state.
   - If `scrape_phase == "T-15"` and the API succeeds, we overwrite the Firestore document. The document will now reflect the T-15 accuracy.

### 3.4. Execution Steps

1. **GitHub Actions Updates:** Update the chron schedules and semantic names in the `.github/workflows/` YAML files.
2. **Dispatcher Update:** Modify `find_upcoming_showtimes` in `backend/functions/dispatcher/main.py` to evaluate both the 30-min and 15-min windows and tag the payloads. Deploy via `./deploy.sh dispatcher`.
3. **Scraper Update:** Modify `scrape_seat` in `backend/functions/scraper/main.py` to respect the `scrape_phase`. Add logic to gracefully ignore closed showtimes during the T-15 phase rather than writing an error state over good T-30 data. Deploy via `./deploy.sh scraper`.
4. **Monitor:** Observe the `scraper_logs` in the Admin Dashboard for the next few hours to ensure T-15 jobs are dispatching and T-30 data is not being inadvertently zeroed out.