# Strategy: Fixing Movie Performance Miscalculations

## Executive Summary
The CineRadar performance engine currently suffers from significant data inaccuracies due to a failure to differentiate between **physical occupancy** (total unavailable seats) and **organic sales** (tickets actually bought by users). This is compounded by inconsistent aggregation logic between daily and all-time statistics.

## 1. Detailed Issue Analysis

### A. The "Ghost Sales" Problem (The Morning Baseline)
**The Issue:** The JIT Scraper captures a morning baseline (`initial_unavailable`) at 4:15 AM WIB to identify seats blocked by cinemas (broken seats, VIP reserves, or manual blocks). Currently, the scraper sets `audience_count = sold_seats`.
**The Impact:** If a theatre blocks 20 seats for a showtime before sales start, CineRadar reports 20 "sold" tickets. This leads to massive **over-reporting** of sales.
**Technical Evidence:** `backend/functions/scraper/main.py:1183`
```python
audience_count = sold_seats # <--- Error: Should be (sold_seats - initial_unavailable)
```

### B. Inconsistent Aggregation Logic
**The Issue:** The Sweeper uses two different mathematical approaches for occupancy percentages.
*   **Daily Stats:** `Sum(occupancy_pct) / Total Showtimes` (Average of Percentages)
*   **All-Time Stats:** `Total Sold / Total Seats` (Weighted Average)
**The Impact:** Discrepancies between the dashboard and the movie detail page. A single 10-seat studio at 100% occupancy carries as much weight in the Daily view as a 300-seat IMAX at 10%, leading to a reported "55% occupancy" that is mathematically misleading.

### C. Master Capacity vs. JIT Snapshot Mismatch
**The Issue:** The `audience_pct` is calculated using the **Master Physical Capacity** (denormalized studio data), but the `total_seats` stored in the summary is the **JIT Snapshot Capacity** (what the API returned).
**The Impact:** If the JIT API only returns 150/200 seats because a balcony is closed, the percentage will be calculated against 200, but the "Total Seats" column will show 150. This makes the math look "broken" to the end-user.

### D. V1 Multi-ID Sync Bug
**The Issue:** In the V2 schema (`schedules_v2`), one movie (`metadata_id`) can have multiple `schedule_ids`. The Sweeper only updates the V1 performance document for the *first* `schedule_id` found.
**The Impact:** Performance data for the same movie on other platforms or ID variations stops updating in the legacy V1 view.

---

## 2. Proposed Fix Strategy

### Phase 1: The "Organic Sales" Correction
Modify the JIT Scraper to implement **True Delta Calculation**:
1.  Fetch the `initial_unavailable` count from the document (if it exists from the morning scrape).
2.  Calculate `audience_count = max(0, sold_seats - initial_unavailable)`.
3.  Ensure `audience_pct` is recalculated using this new `audience_count`.

### Phase 2: Mathematical Alignment
Standardize all aggregation to use **Weighted Averages**:
1.  Update `aggregate_daily_stats` in the Sweeper to calculate `avg_occupancy_pct` as `(total_sold / total_seats) * 100`.
2.  Ensure `total_seats` in the summary document reflects the **Master Total Seats** (Physical Capacity) if available, to match the denominator used in the percentage.

### Phase 3: Multi-ID V1 Synchronization
Update the Sweeper loop:
1.  When processing a `metadata_id` in V2, iterate through **all** associated `schedule_ids`.
2.  Dual-write the same aggregated statistics to every corresponding V1 `movie_performance/{schedule_id}` document.

---

## 3. Implementation Roadmap

| Task | Component | Impact |
|:---|:---|:---|
| **Surgical Merge Fix** | Scraper | Prevents ghost sales by subtracting 4 AM baseline. |
| **Weighted Aggregation** | Sweeper | Fixes discrepancy between Dashboard and Detail views. |
| **Denominator Sync** | Sweeper | Ensures "Total Seats" matches the physical studio capacity. |
| **V1 Broad Sync** | Sweeper | Fixes missing updates for movies with multiple IDs. |
| **Full Recalculation** | CLI | Triggers a `recalculate_all` to fix historical data for the current day. |

---

## 4. Validation Plan
1.  **Unit Test:** Mock a showtime with 10 `initial_unavailable` and 15 `sold_seats`. Verify `audience_count` is 5.
2.  **Audit Check:** Compare `total_sold / total_seats` manually on a Daily Performance document; it must exactly match the `avg_occupancy_pct` field.
3.  **V1 Integrity:** Check two different `schedule_id` documents in Firestore for the same movie; their numbers must be identical.
