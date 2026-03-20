# Implementation Plan: Revenue Quick Count (Phase 1)

## 1. Goal
Enable accurate revenue tracking for Production House (PH) Executives by capturing and storing numeric ticket prices during the initial "baseline" layout scrape and calculating revenue in real-time.

## 2. Technical Strategy: JIT Price Injection
We leverage the TIX.id Seating Layout API to capture exact integer pricing. This data is injected during the "Initial Layout" scrape (1 AM) and verified during JIT scrapes.

## 3. System Trigger & Data Workflow

### A. The JIT (Just-In-Time) Pipeline
This is the primary real-time trigger for performance data.
1.  **Trigger:** A Cloud Function (Scraper) is triggered ~20 minutes before **every** scheduled showtime in Indonesia.
2.  **Frequency:** National scale (approx. **3,000 - 10,000 times per day** depending on the movie's reach).
3.  **Action:** The scraper fetches the current seating layout and calls `PerformanceAggregator.on_showtime_scraped()`.
4.  **Firestore Write:** 
    *   `movie_performance_v2/{movieId}/days/{date}/showtimes/{showtimeId}`: Saves the detailed snapshot (occupancy + price).
    *   `movie_performance_v2/{movieId}/days/{date}`: Overwrites the **Daily Summary** doc with recalculated totals (Total Sold, Total Seats, and now **Total Revenue**).

### B. The Manual Recalculation (CLI)
Used for maintenance or logic updates (like this Phase 1 rollout).
1.  **Trigger:** `uv run python -m backend.cli.movie_performance --recalculate`
2.  **Action:** Iterates through all existing `showtime` documents for today and re-sums them into the `DailyPerformance` summary.
3.  **Use Case:** Populating revenue for today using the prices we just backfilled.

## 4. Firestore Collection Hierarchy
| Collection Level | Document Type | New Field |
| :--- | :--- | :--- |
| `movie_performance_v2/{movieId}` | Root Metadata | N/A |
| `.../days/{date}` | **DailyPerformance** (Summary) | `total_revenue` (int) |
| `.../showtimes/{id}` | **ShowtimeSnapshot** (Atomic) | `price` (int) |

## 5. Implementation Steps

### Step 1: Domain Model Update
*   **File:** `backend/domain/models/movie_performance.py`
*   **Action:** Add `price: int` to `ShowtimeSnapshot` and `total_revenue: int` to `DailyPerformance`.

### Step 2: Scraper Logic Enhancement (COMPLETED)
*   **File:** `backend/scripts/scrape_initial_layouts.py`
*   **Action:** Extract numeric price from API and perform "Surgical Merge" to protect live occupancy data.

### Step 3: Performance Aggregator Integration (PENDING)
*   **File:** `backend/application/services/performance_aggregator.py`
*   **Logic:** `revenue = (final_sold - initial_unavail) * price`
*   **Action:** Sum this into the `total_revenue` field in the daily summary.

## 6. Execution Plan (For Today: 2026-03-20)
1.  **Deploy Schema Change:** Update the Python domain models. (In Progress)
2.  **Deploy Aggregator Update:** Update the `PerformanceAggregator` logic.
3.  **Trigger Recalculation:** Run the CLI with `--recalculate` to populate `total_revenue` across all movies for today.
