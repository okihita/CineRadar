# Studio Layout Admin Editor & Backfill Plan

## 1. Goal & Context
With `studio_id` now flowing into the showtimes dataset, we have the necessary identifiers to build a static **Master Studio Database**. The user strategy dictates:
1. Extract master layouts using today's `initial_layout_compressed` combined with the new `studio_id` field.
2. Store these master layouts inside the existing `theatres` Firestore collection.
3. Build a visual admin dashboard (under "Cinema Intelligence") to view and manually edit the layout of each studio.

## 2. Strategy Review & Scoring

**Score: 9 / 10**

**Why this is a great strategy:**
- **Co-location:** Storing layouts inside the `theatres` collection (as a subcollection) is hierarchically correct. A physical studio belongs to a theatre. 
- **Escape Hatch (Manual Editing):** Sometimes API scraping gets confused, or a cinema permanently removes a broken seat. Allowing admin staff to visually inspect and override layouts ensures 100% data integrity without waiting for the automated scraper to figure it out.
- **Immediate Value:** By combining today's 1 AM scrape data with today's 11 AM `studio_id` scrape, we can bootstrap the majority of the master layouts without waiting for a new scraping cycle.

**Vulnerabilities in the Proposed Strategy:**
- **Automated Overwrites:** If an admin manually edits a layout (e.g., deleting a non-existent seat), but the backend scraping system continuously updates the master layout (via the opportunistic discovery mechanism), the backend might overwrite the human's manual correction.
- **Seat Mapping Complexity:** Layouts are currently compressed strings (e.g., `A1#free;A2#free|B1...`). Rendering these into a visual, clickable UI requires a robust parsing and re-encoding algorithm in the frontend.

## 3. Recommended Improvements

To address the vulnerabilities, I suggest the following architectural enhancements:

### Improvement 1: The "Manual Override Lock" Flag
Add an `is_locked` boolean field to the studio layout document.
- If `is_locked == false` (default), the backend scraper can continuously update/expand the layout if it discovers new valid seats via the "Logical OR" technique.
- If `is_locked == true`, it means a human has verified and edited this layout via the Admin Dashboard. The backend scraper must **never** modify this document again. The system trusts the human baseline over the API.

### Improvement 2: Intelligent Backfill Script
Since the 1 AM scrape *didn't* have `studio_id`, and the 11 AM scrape *does* have `studio_id`, we need a one-off backfill script that:
1. Queries all showtimes for today that have a `studio_id`.
2. Cross-references the `showtime_id` against the `movie_performance_v2` (or V1) collection to retrieve the `initial_layout_compressed` captured at 1 AM.
3. Performs a "Logical OR" merge of the seats to find the maximum physical capacity.
4. Saves it to `theatres/{theatre_id}/studios/{studio_id}`.

## 4. Architecture & Implementation Steps

### A. Database Schema
**Path:** `theatres/{theatre_id}/studios/{studio_id}`
**Fields:**
- `studio_id` (string): e.g., "11", "100101"
- `name` (string): Optional human-readable name, e.g., "Studio 1" or "IMAX" (can be inferred or manually inputted).
- `total_seats` (int): Total valid seats in the room.
- `layout_compressed` (string): The master string (e.g. `A1#free;A2#free...`). Note: "free" in this context just means "Valid Physical Seat". We might want to rename states to `seat` vs `empty/hallway` to avoid confusion with ticket availability.
- `is_locked` (boolean): Default `false`. Set to `true` when edited via Admin.
- `last_updated` (timestamp)

### B. The Backfill Script (`scripts/bootstrap_studio_layouts.py`)
1. Fetch all showtimes from today's active schedules where `studio_id != None`.
2. For each showtime, fetch its performance snapshot (`movie_performance_v2`) to get `initial_layout_compressed` (or `layout_compressed` if initial isn't available).
3. Decompress the layout, map every seat coordinate.
4. Update the Firestore `theatres/.../studios/...` document, merging the seat maps.

### C. Admin Dashboard (Cinema Intelligence)
**Location:** `/admin/src/app/cinemas/[theatreId]/studios/[studioId]` or a modal within the Theatre Detail page.
**Features:**
1. **List Studios:** In the Theatre Detail view, query the `/studios` subcollection and list them in a table.
2. **Visual Editor Component:**
   - Decompress `layout_compressed` into a 2D grid.
   - Render grid cells as squares.
   - **Click Action:** Toggle cell state between `Seat` (active) and `Empty/Hallway` (inactive).
   - **Save Button:** Re-compresses the 2D grid back into the `A1#seat;A2#empty|...` string format.
   - **Save Action:** Updates Firestore, recalculates `total_seats`, and sets `is_locked = true`.

## 5. Summary
This strategy is excellent and perfectly utilizes the new `studio_id` data. By implementing an `is_locked` flag and a robust backend script to bridge the gap between the 1 AM and 11 AM data sets, we will have a highly accurate, human-verifiable master layout system within a day.