# Studio Layout Baseline Plan

## 1. Problem Statement

Currently, CineRadar relies on a dual-scrape mechanism to calculate ticket sales for a specific showtime:
1. **Initial Scrape (1 AM):** Captures the `initial_layout` of a showtime at the start of the day.
2. **JIT Scrape (T-30, T-20, T-10):** Captures the `final_layout` right before the movie starts.

The ticket sales are calculated as the delta between the `initial_layout` and `final_layout`.

**The Major Flaw:**
If seats for a showtime are already heavily pre-booked (or fully booked) on the previous day, the 1 AM initial scrape will perceive those pre-booked seats as unavailable (either marked as occupied or not part of the "free" pool). Because the system lacks historical context of the *actual* physical studio capacity, the initial capacity is severely undercounted. Consequently, the delta between 1 AM and the JIT scrape evaluates to zero (or near-zero), incorrectly computing zero ticket sales despite the showtime being sold out IRL.

## 2. Proposed Solution

Instead of relying on a moving, time-dependent baseline (the 1 AM scrape), we should establish a **Static Master Baseline** for every physical cinema studio.

1. **Extract Studio ID:** The `movie_showtimes.response` payload contains a `studio` field (e.g., `"11"`, `"100101"`) inside the `show_time` array. We will extract this and associate every showtime with its specific physical studio.
2. **Build a Studio Layouts Database:** We will create a new Firestore database collection (e.g., `studio_layouts`) keyed by a composite ID (e.g., `theatre_id + studio_id`) to store the absolute original layout (max capacity) of that physical room.
3. **Change the Delta Calculation:** Instead of computing `Sales = Initial Layout (1 AM) - Final Layout (JIT)`, the calculation will become `Sales = Master Studio Layout - Final Layout (JIT)`.

## 3. Architecture & Data Flow

### A. Data Modeling
**Collection:** `studio_layouts`
**Document ID:** `{theatre_id}_{studio_id}` (e.g., `cgv-123_100101`)
**Fields:**
- `theatre_id` (string): The merchant's theatre ID.
- `studio_id` (string): The physical studio identifier.
- `total_seats` (int): The absolute maximum number of bookable seats in this room.
- `layout_compressed` (string): The encoded layout map of all physical seats (e.g., `A1#free;A2#free...`).
- `last_updated` (timestamp): When this layout was last validated or updated.

### B. Scraping Pipeline Adjustments
1. **Showtime Parsing:** Update the parsing logic to extract the `studio` field from the API response and attach it to the internal `Showtime` model in our backend.
2. **Studio Layout Discovery:** 
   Since the API does not provide an endpoint to "get layout by studio ID," we can only retrieve layouts via active showtimes. 
   We will implement an opportunistic discovery mechanism. When we scrape showtimes, if we encounter a `{theatre_id}_{studio_id}` that does not exist in our `studio_layouts` database, we scrape its seating layout via that showtime and save it.

### C. Backend Delta Calculation
When calculating ticket sales:
- Retrieve the JIT `final_layout` for the showtime.
- Fetch the `Master Studio Layout` from the `studio_layouts` collection using the showtime's `theatre_id` and `studio_id`.
- Compute the sold seats by cross-referencing the available seats in the `final_layout` against the total physical seats defined in the `Master Studio Layout`.

## 4. Scoring the Plan

**Score: 8.5 / 10**

**Pros:**
- **Solves the Core Bug:** Completely eliminates the zero-delta issue for advanced pre-bookings. A sold-out showtime will correctly show 100% sales against the master studio baseline.
- **Accurate Capacity Metrics:** Provides a true "occupancy percentage" against the physical room size, rather than an arbitrary 1 AM availability.
- **Infrastructure Savings:** Long-term, this removes the need for the heavy 1 AM initial layout scrape, saving significant API calls, infrastructure costs, and database writes.

**Cons:**
- **Discovery Flaw:** If we opportunistically discover a new studio layout *today* using a showtime that is *already partially booked*, our "Master" layout will be flawed from day one. It will assume the occupied seats are hallways/non-existent.
- **Dynamic Studio Changes:** Cinemas sometimes physically remove broken seats or alter layouts. A purely static layout might become outdated over time.

## 5. Suggested Improvements

To address the cons and elevate the plan to a **10/10**, consider these technical refinements:

### Improvement 1: Composite "High-Water Mark" Layouts (Crucial)
Because we can only discover layouts via active showtimes (which might already have sold seats), we cannot blindly trust the first layout we scrape as the perfect "Master."
**Refinement:** We should build the Master Layout cumulatively.
- For a given `{theatre_id}_{studio_id}`, we parse the seat layout string.
- We treat a `free` status as absolute proof that a valid seat *exists* at that coordinate.
- Over time (across multiple scrapes of different showtimes for the same studio), we perform a **Logical OR** on seat existence. If seat `A1` is *ever* seen as `free` in *any* showtime for that studio, it is permanently added to the Master Layout's physical capacity.
- This ensures that even if we discover a studio while it's 50% booked, the system will eventually "learn" the 100% accurate physical layout as we scrape subsequent, emptier showtimes.

### Improvement 2: Advance-Sales Target Scraping
To accelerate the generation of an accurate `studio_layouts` database, we can create a one-off or weekly script that targets showtimes 5-7 days in the future (Advance Sales). These showtimes are almost entirely empty, allowing us to capture near-perfect Master Layouts on the first try without waiting for the composite algorithm to slowly learn the layout.

### Improvement 3: Deprecate the 1 AM Layout Scrape Entirely
Once the `studio_layouts` database reaches a stable state (e.g., the composite layouts stop growing in size because all seats have been discovered), we can completely turn off the 1 AM `scrape_initial_layouts.py` cron job. This transitions CineRadar from a "Daily Delta" model to a true "Absolute Occupancy" model.