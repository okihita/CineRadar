# Historical Studio ID Backfill Plan

## 1. Problem Statement
The Master Studio Layout feature requires a `studio_id` in the performance record to fetch the physical topology template from the `theatres/{theatre_id}/studios` collection. Performance records before **March 20, 2026** (when the 1 AM scraper was patched) mostly lack this field, making historical visualization impossible despite having the master templates mapped.

## 2. Data Availability Analysis
Investigation of Firestore collections reveals three distinct tiers of historical data:

| Era | Dates | Key Availability | Reliability |
| :--- | :--- | :--- | :--- |
| **Direct Mapping** | Mar 18, 2026 – Present | `schedules_v2` contains `showtime_id` -> `studio_id` map. | 100% |
| **Fingerprint** | Mar 15 – Mar 17, 2026 | `initial_layout_compressed` exists in performance docs. | ~95% |
| **Legacy** | Before Mar 15, 2026 | No layout data; only seat counts and categories. | <10% |

## 3. Backfill Strategies

### Strategy A: Schedule Join (For "Direct Mapping" Era)
- **Source:** `schedules_v2/{date}/movies`
- **Logic:**
    1. Scan all movie documents for a given date.
    2. Build a lookup table of `showtime_id` to `studio_id`.
    3. Update matching documents in `movie_performance_v2`.
- **Performance:** Very fast; zero API calls.

### Strategy B: Structural Fingerprinting (For "Fingerprint" Era)
- **Source:** `initial_layout_compressed` field in performance documents.
- **Logic:**
    1. Decompress the layout snapshot from the performance record.
    2. Extract the set of physical coordinates (e.g., `{"A1", "A2", "B1"}`).
    3. Load all known studios for the parent `theatre_id` from the Master Registry.
    4. Perform a set-comparison between the snapshot coordinates and the Master Layout coordinates.
    5. If a match is found (identical seat count and topology), assign the Master `studio_id` to the record.
- **Complexity:** Medium; requires decompression and geometric matching.

## 4. Implementation Recommendation
When the backfill is prioritized, implement a unified script that:
1. Iterates backwards from the current date.
2. Applies **Strategy A** if the schedule document contains `studio_id`.
3. Falls back to **Strategy B** if the performance record contains a layout but the schedule doesn't.
4. Stops once it hits the Legacy Era (pre-March 15) where no deterministic mapping is possible.
