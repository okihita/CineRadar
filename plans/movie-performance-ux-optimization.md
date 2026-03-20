# Deep Analysis: Movie Performance UX & Data Optimization

## 1. Problem Statement
The "Movie Intelligence" dashboard experiences a "Data Cliff" when a movie scales nationally. Loading 80+ cities (1,000 - 3,000 showtimes) currently takes up to 50 seconds because the UI requires the full dataset before rendering high-level insights.

## 2. The "Best Way" Architecture: Triple-Tiered Deferral

We will move from an **Eager Loading** model to a **Just-In-Time (JIT)** model. This ensures the page is useful within 1 second, regardless of how many showtimes exist.

### Tier 1: The Executive Summary (Instant Insight)
*   **Goal:** Render the National Map and Activation Radar immediately.
*   **Data Source:** `movie_performance/{movieId}/days/{date}`
*   **Optimization:** The backend aggregator now stores a pre-calculated `city_performance` map inside this single document.
*   **Result:** 
    - **Firestore Reads:** 1 Document.
    - **Payload:** ~5KB.
    - **UX:** The user sees geographic performance and "High Flyers vs. Needs Attention" lists in **< 800ms**.

### Tier 2: The Metadata Index (Deferred Table)
*   **Goal:** Render the sortable/filterable table of all showtimes.
*   **Trigger:** **Intersection Observer.** Only start fetching when the user scrolls the table into view.
*   **Data Source:** `movie_performance/{movieId}/days/{date}/showtimes`
*   **Optimization:** **Field Masking.** We use the Firestore REST `mask` parameter to strip out `layout_compressed` and `raw_api_response`.
*   **Result:** 
    - **Firestore Reads:** N Documents (Masked).
    - **Payload:** ~200 bytes per row (e.g., 200KB for 1,000 shows).
    - **UX:** The table "pops in" with zero lag once the user scrolls down.

### Tier 3: The Atomic Detail (Granular Inspection)
*   **Goal:** View seat maps and raw logs for a specific theatre.
*   **Trigger:** **User Click.** Only load when a row is expanded.
*   **Data Source:** `movie_performance_v2/{movieId}/days/{date}/showtimes/{showtimeId}`
*   **Optimization:** Atomic fetch for the full unmasked document.
*   **Result:** 
    - **Firestore Reads:** 1 Document.
    - **Payload:** ~50KB - 150KB (Gzipped layout + raw logs).
    - **UX:** A 200ms "skeleton" loader inside the expanded row provides a smooth transition to the granular data.

---

## 3. Technical Implementation Details

### A. Pre-Aggregation (Backend)
Modify `backend/application/services/performance_aggregator.py`:
```python
# New structure for DailyPerformance doc
city_performance = {
    "JAKARTA": {"sold": 4500, "seats": 6000, "shows": 42},
    "SURABAYA": {"sold": 1200, "seats": 2000, "shows": 15},
}
```

### B. Field Masking (API Client)
Update `admin/src/lib/firestore-rest.ts`:
```typescript
// Add support for masking to getSubCollection
async getSubCollection(path: string, maskFields?: string[]) {
    const url = new URL(`${FIRESTORE_BASE_URL}/${path}`);
    if (maskFields) {
        maskFields.forEach(f => url.searchParams.append('mask.fieldPaths', f));
    }
    // ... fetch logic
}
```

### C. Lazy Table Trigger (Frontend)
Wrap `ShowtimesDataFetcher` in a wrapper that uses `react-intersection-observer`.

---

## 4. Comparison: Why this is the "Best Way"

| Metric | Current Approach | The "Best Way" |
| :--- | :--- | :--- |
| **Data Download** | ~50MB (National Movie) | **~15KB** (Initial) / **~300KB** (Scroll) |
| **Main Thread Lock** | ~5-10s (Parsing massive JSON) | **Zero** |
| **Firestore Cost** | 1,001 Reads (Every visit) | **1 Read** (Map only) / 1,001 (If scrolling) |
| **Scalability** | Crashes on blockbusters | Handles 5,000+ shows with ease |

**Final Recommendation:** This approach respects the user's need for speed while fulfilling your preference to defer granular data until the "last possible moment." It is the most cost-effective and performant architecture for Firestore-backed dashboards.
