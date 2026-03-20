# Impact Analysis: Revenue Quick Count Implementation

This document provides a deep-dive explanation of all changes made to the CineRadar codebase to support Revenue Tracking. 

## 1. Data Model & Firestore Architecture

### A. `ShowtimeSnapshot` (The Atomic Level)
Represents a single cinema showtime instance.
*   **Firestore Path:** `movie_performance_v2/{movieId}/days/{date}/showtimes/{showtimeId}`
*   **New Field:** `price: int` (The cost of a single ticket in IDR).
*   **Admin UI Usage:** 
    *   **Showtime Table:** Populates the new "Price" column in each row.
    *   **Expanded View:** Used to calculate the specific revenue contribution of that single show (Audience × Price) when a user clicks a row to see details.
    *   **Stability:** If this field is missing (legacy data), the UI now uses "Null-Safety" to show a `-` instead of crashing.

### B. `DailyPerformance` (The Summary Level)
Represents the aggregated national performance of a movie for a specific day.
*   **Firestore Path:** `movie_performance_v2/{movieId}/days/{date}`
*   **New Field:** `total_revenue: int` (The national sum of all ticket sales).
*   **Admin UI Usage:** 
    *   **Executive Dashboard:** This is the primary data source for the "Total Revenue" card at the top of the page.
    *   **Performance Trends:** Used to plot revenue growth/decay charts over time.
    *   **Efficiency:** By storing this at the summary level, the UI only performs **one Firestore read** to show the total revenue, rather than calculating thousands of showtimes on the client side.

---

## 2. Core Functional Changes (The "Revenue Engine")

### `backend/domain/models/movie_performance.py`
*   **Action:** Updated Python dataclasses for both models above to include the new fields.
*   **Result:** Ensures Python logic can serialize/deserialize the new Firestore data without errors.

### `backend/scripts/scrape_initial_layouts.py`
*   **Action:** Added "Surgical Merge" logic and price extraction.
*   **Result:** 
    *   **Price Extraction:** Automatically pulls the integer price from the TIX.id API during the 1 AM scrape.
    *   **Surgical Merge:** Ensures that running a backfill during the day **only** updates the price and **preserves** existing live occupancy data.

### `backend/application/services/performance_aggregator.py`
*   **Action:** Implemented the `total_revenue` summation logic.
*   **Result:** Whenever a new showtime is scraped, the Aggregator automatically updates the `DailyPerformance` document with the new total: `total_revenue += (new_audience * price)`.

---

## 3. Maintenance & Formatting (Linter Impact)

The following files show changes purely because I ran the project's standard formatter (`ruff`) to ensure the new code matched the existing style. These changes are **cosmetic** (whitespace, import ordering) and ensure the codebase remains clean:

*   `backend/cli/movie_performance.py`
*   `backend/domain/models/theatre.py`
*   `backend/functions/scraper/main.py`
*   `backend/functions/sweeper/main.py`
*   `backend/infrastructure/core/tix_client.py`
*   `backend/scripts/bootstrap_studio_layouts.py`
*   `backend/scripts/discover_studios.py`

## 4. Summary of Data Flow
1.  **Scraper** captures the numeric price and saves it to the `showtimes` sub-collection.
2.  **Aggregator** triggers, reads the showtime prices, performs the math, and updates the `days` summary document.
3.  **Admin UI** reads the summary for the header and the individual snapshots for the table rows.
