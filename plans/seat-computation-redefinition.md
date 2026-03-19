# Seat Computation Redefinition Plan (Revised Analysis)

## 1. Objective
Redefine how CineRadar calculates ticket sales using the newly scraped Master Layouts, moving away from the error-prone "1 AM Delta" model.

## 2. Flaw Analysis of the "Absolute Model" Formula

The initial proposed formula was:
`Audience = Master_Physical_Capacity - JIT_Available`

**Critical Flaw 1: Dynamically Closed Sections (Fake Sales)**
If a cinema decides to close the front two rows for a specific showtime, the TIX API often omits those seats entirely from the `seat_map` payload rather than marking them as "Unavailable".
*   `Master_Capacity` = 150
*   `JIT_Total_Seats` returned = 130 (20 seats omitted).
*   `JIT_Available` = 130 (0 sales).
*   Result: `150 - 130 = 20 Audience`. We would falsely report 20 ticket sales because of a closed section.

**Critical Flaw 2: Permanently Blocked Seats (Inflation)**
Certain seats (like broken chairs or projector lines) are physically present (so they exist in the Master Layout) but are permanently marked as Status 5/6 (Unavailable) by the cinema.
*   The formula `Master - JIT_Available` will **always** count these permanently blocked seats as ticket sales, inflating the daily revenue numbers across every single showtime.

## 3. The Corrected "JIT Occupied" Model

Instead of using the Master Capacity to derive the *numerator* (Sales), we should use the JIT payload to derive the numerator, and the Master Capacity to derive the *denominator* (True Fill Rate).

### The New Math:
*   **Audience Count (Numerator):** `JIT_Unavailable` (Count of seats explicitly marked as Status 5 or 6).
    *   *Why?* This perfectly captures early presales (which broke the 1 AM model) but ignores seats that were dynamically omitted/closed by the cinema. It will still count permanently blocked seats as "occupied", but this is acceptable for a "Fill" metric and much safer than the delta model.
*   **True Capacity (Denominator):** `Master_Physical_Capacity`
    *   *Why?* If a 200-seat studio closes a 50-seat balcony, the JIT API might only return 150 seats. If we sell all 150, the JIT API says it's 100% full. But for business intelligence, we need to know that only 75% of the *physical asset* was monetized.

### Summary of the Shift:
*   **Old Delta:** `JIT_Unavailable - 1AM_Unavailable` (Missed presales)
*   **Initial Plan:** `Master_Capacity - JIT_Available` (Vulnerable to omitted seats = fake sales)
*   **Corrected Plan:** `JIT_Unavailable` (Safe, captures presales, ignores omitted sections)

## 4. Implementation Strategy (`backend/functions/scraper/main.py`)

### Step 1: Update `calculate_occupancy`
Refine the function to clearly return three distinct counts:
1.  `jit_total_seats`: Total seats present in the current API payload.
2.  `jit_available_seats`: Seats with Status 1.
3.  `jit_unavailable_seats`: Seats with Status 5 or 6.

### Step 2: The Logic Switch in `save_snapshot`
Instead of doing delta math, we implement the True Fill Rate logic:

```python
# 1. Fetch Master Capacity (with in-memory caching to prevent Firestore spam)
master_capacity = get_cached_master_capacity(theatre_id, studio_id)

# 2. Determine Denominator
if master_capacity and master_capacity > 0:
    denominator = max(master_capacity, jit_total_seats) # Protect against outdated master
    baseline_source = "master_studio"
else:
    denominator = jit_total_seats
    baseline_source = "jit_fallback"

# 3. Final Metrics
audience_count = jit_unavailable_seats
audience_pct = (audience_count / denominator) * 100
```

### Step 3: Global In-Memory Cache
Because the JIT scraper is a Cloud Function handling hundreds of concurrent messages, querying the `theatres/{tid}/studios/{sid}` document for every message will cause massive Firestore read spikes and latency.
*   **Solution:** We will implement a global `MASTER_CAPACITY_CACHE` dictionary in the Cloud Function's global scope. If a studio's capacity isn't in the cache, it fetches it from Firestore and caches it for the lifetime of that Cloud Function instance.

## 5. Next Steps
1. Review this corrected logic. If approved, it completely solves the pre-sale issue without introducing the "closed section = fake sales" bug.
2. Implement in `functions/scraper/main.py`.
3. Deploy and monitor a high-presale showtime.