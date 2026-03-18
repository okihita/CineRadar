# Studio Layout Master Plan

## 1. Problem Statement

CineRadar calculates ticket sales using a **delta model**: `Sales = Initial Layout (1 AM) − Final Layout (JIT)`.

This breaks for heavily pre-booked showtimes. If a movie is already 80% sold by midnight, the 1 AM scrape sees only 20% capacity. When the JIT scrape runs and finds 0% free, the delta is near-zero — incorrectly reporting zero ticket sales for a sold-out show.

**Root cause:** The system has no concept of a studio's *physical* capacity. It treats whatever the 1 AM scrape returns as the baseline, which is a moving target.

## 2. Solution: Static Master Baselines

Replace the time-dependent 1 AM baseline with a **permanent, per-studio physical capacity record**.

**New delta:** `Sales = Master Studio Capacity − Final Layout (JIT)`

This gives accurate occupancy regardless of when tickets were sold.

---

## 3. Data Model

### Firestore Path

```
theatres/{theatre_id}/studios/{studio_id}
```

Co-locating under `theatres/` ensures studios move or delete with their parent theatre.

### `StudioLayout` Model

| Field | Type | Description |
| :--- | :--- | :--- |
| `studio_id` | `string` | Physical studio identifier from TIX API (e.g., `"11"`, `"100101"`) |
| `name` | `string` | Human-readable name (e.g., "Studio 1", "IMAX", "Premiere"). Defaults to `"Studio {id}"`, should be manually corrected via Admin. |
| `total_seats` | `int` | Physical seat count. **Invariant:** must equal the count of `"seat"` entries in `layout`. |
| `layout` | `bytes` | Gzip-compressed JSON. Format: see §3.1. |
| `is_locked` | `boolean` | If `true`, automated scrapers must **never** overwrite this document. Admin-verified. Default: `false`. |
| `last_updated` | `string` | ISO 8601 timestamp of last write. |
| `version` | `int` | Monotonically incrementing. Enables audit trail when combined with a `_history` subcollection (see §7.4). |

### 3.1 Layout Format (CineRadar Unified Grid)

The compressed JSON contains a **chain-agnostic** structure:

```json
[
  {
    "row_name": "A",
    "seats": [
      {"id": "A1", "type": "seat"},
      {"id": "",   "type": "aisle"},
      {"id": "A2", "type": "seat", "grade": "S"}
    ]
  },
  {
    "row_name": "B",
    "seats": [
      {"id": "B1", "type": "seat"},
      {"id": "B2", "type": "seat"}
    ]
  }
]
```

**Field definitions:**

| Seat Field | Type | Values |
| :--- | :--- | :--- |
| `id` | `string` | Seat identifier (e.g., `"A1"`). Empty string for aisles. |
| `type` | `string` | `"seat"` = valid physical seat; `"aisle"` = gap/void. |
| `grade` | `string` (optional) | Seat class for price-tier analytics. Values: `"R"` (Regular), `"S"` (Sweetbox), `"D"` (Deluxe/Gold), `"P"` (Premiere). Omit if unknown; defaults to Regular. |

> **Why this format over the existing `[[row_name, [status_codes]]]`?**
> The existing `calculate_occupancy` output uses `[row_name, [1, 0, 5, ...]]` which encodes *availability state* (sold vs free). The master layout needs to encode *physical existence* (seat vs aisle) and *seat grade* — orthogonal to availability. A different structure avoids confusion between "is this seat occupied?" and "does this seat exist?".

---

## 4. Multi-Chain Parsing

The TIX API returns different seat map structures per cinema chain. The bootstrap script must handle both:

### XXI / CGV (Nested)

```json
[
  {
    "seat_code": "A",
    "seat_rows": [
      {"seat_row": "A1", "status": 1},
      {"seat_row": "A2", "status": 5}
    ]
  }
]
```

**Parsing rule:** Every entry in `seat_rows` with a non-empty `seat_row` is a physical seat, regardless of `status`. Status only tells us availability, not existence.

### Cinépolis (Flat)

```json
[
  {"row_name": "A", "seat_no": "A1", "seat_yn": "1", "seat_status": 1},
  {"row_name": "A", "seat_no": "",   "seat_yn": "0", "seat_status": 0},
  {"row_name": "A", "seat_no": "A2", "seat_yn": "1", "seat_status": 0}
]
```

**Parsing rule:** `seat_yn == "0"` → aisle. `seat_yn == "1"` → physical seat (regardless of `seat_status`).

### Unified Parse Function

```python
def parse_to_master_layout(seat_map: list[dict]) -> tuple[int, list[dict]]:
    """Convert any chain's seat_map into CineRadar Unified Grid format.
    
    Returns:
        (total_seats, unified_layout)
        
    Key principle: We care about EXISTENCE, not availability.
    Every node with a valid seat_id is a seat, even if currently sold/blocked.
    """
```

This is the critical difference from `SeatScraper.calculate_occupancy()`, which tracks availability. The master layout parser must treat status 1, 5, and 6 identically — they are all valid physical seats.

---

## 5. Bootstrap Strategy

### 5.1 Data Source

The bootstrap script will **live-scrape** seat layouts via `SeatScraper._fetch_seat_layout_api()` using active showtimes as entry points.

> **Not** a data-join against the 1 AM `initial_layout_compressed`. The 1 AM data encodes availability state, not physical existence. A live scrape returns the full seat map regardless of booking status.

### 5.2 Studio Discovery

```
schedules_v2/{date}/movies/{movie_id}
  → schedules → {city} → [{theatre_id, rooms: [{all_showtimes: [{studio_id, showtime_id}]}]}]
```

Walk today's schedules to build a unique set of `(theatre_id, studio_id)` pairs, each mapped to a `showtime_id` we can use to fetch the layout.

### 5.3 Logical OR Merge (Cumulative Learning)

A single showtime's seat map may already have sold seats, which appear as `status: 5` (unavailable). But **unavailable ≠ non-existent**. Our parser (§4) treats all statuses as valid seats.

However, edge cases exist (maintenance blocks, temporary removals). To handle them:

1. For each `(theatre_id, studio_id)`, scrape **all** available showtimes (not just the first one found).
2. Perform a **Logical OR** on seat existence across all showtimes:
   - If coordinate `A3` appears as a seat in *any* showtime → it is a physical seat.
3. This builds the maximum-known capacity over time.

### 5.4 Advance-Sales Acceleration

For faster bootstrap accuracy, target showtimes **5–7 days in the future**. These are nearly empty, giving near-perfect physical layouts on the first pass.

### 5.5 Implementation: `scripts/bootstrap_studio_layouts.py`

```
Flow:
1. Load auth token via SeatScraper.load_token_from_storage()
2. Query schedules_v2/{today}/movies → extract unique (theatre_id, studio_id, showtime_id)
3. For each studio:
   a. Check if existing doc has is_locked == true → skip
   b. Fetch seat_map via _fetch_seat_layout_api(showtime_id, merchant)
   c. Parse via parse_to_master_layout() → (total_seats, unified_layout)
   d. Gzip compress the unified_layout JSON
   e. Write to theatres/{theatre_id}/studios/{studio_id} with merge=True
   f. Rate limit: 0.5s between requests
4. Log summary: X studios saved, Y skipped (locked), Z failed
```

### 5.6 Error Handling

| Failure Mode | Handling |
| :--- | :--- |
| API returns empty seat_map | Log warning, skip. Do not write empty layouts. |
| API timeout / HTTP error | Retry up to 2× with exponential backoff. Log and skip on 3rd failure. |
| 0 valid seats parsed | Log warning, skip. Likely a parsing bug. |
| Token expired mid-run | Re-call `load_token_from_storage()` and retry. |

---

## 6. Delta Calculation Change

### Current (Flawed)

```
Sales = Initial Layout (1 AM scrape) − Final Layout (JIT scrape)
```

### New (Absolute Occupancy)

```
Sales = Master Studio Capacity − Available Seats (JIT scrape)
```

**Integration point:** The JIT scrape pipeline (`functions/scraper/main.py`) needs to:
1. Look up `theatres/{theatre_id}/studios/{studio_id}` for the showtime's studio.
2. Use `total_seats` from the master layout as the denominator.
3. Fall back to the existing 1 AM baseline if no master layout exists yet (graceful migration).

---

## 7. Admin Dashboard: Cinema Intelligence

### 7.1 Theatre Detail View

Add a **"Studios"** tab/section within `/cinemas/[theatreId]`:
- List all studios with capacity and lock status.
- Color-code: 🔒 Locked (green) vs 🔓 Auto-managed (amber).

### 7.2 Visual Layout Editor

A dedicated page or modal at `/cinemas/[theatreId]/studios/[studioId]`:
- **Grid renderer:** Decompress `layout` → render as a 2D clickable grid.
- **Cell states:** Seat (filled square) · Aisle (empty) · Sweetbox (wider, paired).
- **Toggle on click:** Cycle `seat ↔ aisle`.
- **Grade dropdown:** Right-click or long-press to set seat grade.
- **Save:** Re-serialize → gzip → write to Firestore. Auto-sets `is_locked = true` and increments `version`.

### 7.3 Bulk Name Assignment

Studios default to `"Studio {id}"`. Provide a batch-edit table where the admin can assign real names ("IMAX", "Premiere", "GOLD CLASS") across all studios in a theatre at once.

### 7.4 Version History (Optional, Phase 2)

On each write, save the previous layout to `theatres/{theatre_id}/studios/{studio_id}/_history/{version}`. Enables rollback if an admin makes a mistake.

---

## 8. Monitoring & Completeness

### 8.1 Coverage Dashboard

Track bootstrap progress:

| Metric | Query |
| :--- | :--- |
| Total known studios | Count docs across all `theatres/*/studios/*` |
| Locked (verified) | Count where `is_locked == true` |
| Stale (>30 days) | Count where `last_updated < now - 30d` |
| Missing | Studios seen in today's schedules but absent from the database |

### 8.2 Validation Invariant

On every write (bootstrap or admin save), assert:

```python
assert total_seats == sum(
    1 for row in layout for seat in row["seats"] if seat["type"] == "seat"
)
```

If the assertion fails, log an error and refuse the write. This prevents data drift.

### 8.3 1 AM Scrape Deprecation

Once coverage reaches **≥95%** of active studios and the majority are locked:
1. Disable `scrape_initial_layouts.py` cron.
2. The system transitions from "Daily Delta" to "Absolute Occupancy" mode.
3. Keep the cron definition in code (commented out) for rollback safety.

---

## 9. Implementation Tiers

This 3-tier strategy ensures each layer builds upon the last while delivering immediate, presentable, and verifiable business value.

### Tier 1: Foundation & Discovery (Data & Visual MVP)
**Business Value:** Establishes the database schema, populates a baseline registry of all physical studios, and provides immediate visibility to admins—without needing perfect seat maps yet.
*   **Deliverables:**
    *   **Data Model:** Backend `StudioLayout` dataclass and Firestore schema. *Verification: Code merged and tests pass.*
    *   **Discovery Script:** A one-off script (`scripts/discover_studios.py`) that scans recent schedules and populates `theatres/{theatre_id}/studios/{studio_id}` with basic metadata (IDs, default names), temporarily ignoring exact seat counts or layouts. *Verification: Run script locally, check Firestore Console to confirm studio documents exist under theatres.*
    *   **Visual MVP:** Admin UI list view nested under `/cinemas/[theatreId]` showing the discovered studios. *Verification: Open Admin UI, navigate to a theatre, and visually confirm the list of studios is displayed.*

### Tier 2: Capacity Learning & Dual-Track Metrics (Accuracy MVP)
**Business Value:** Replaces the flawed 1 AM baseline with absolute physical capacity for mapped studios, immediately improving audience accuracy for those studios.
*   **Deliverables:**
    *   **Bootstrap Scraper (`scripts/bootstrap_studio_layouts.py`):**
        *   **Spec:** A background worker script that fetches layout data for showtimes. It uses a "Logical OR" merge strategy to progressively learn the true physical layout over time.
        *   **Implementation Details:**
            *   Fetch available showtimes for a given `theatre_id` and `studio_id`.
            *   Parse seat maps using `parse_to_master_layout()`.
            *   Merge layouts using `merge_layouts_logical_or()`.
            *   Update the `total_seats` and `layout` array fields in the `theatres/{theatre_id}/studios/{studio_id}` document.
            *   Respect the `is_locked` flag: do not overwrite layouts manually locked by admins.
        *   *Verification:* Run the script for a specific theatre. Inspect Firestore to ensure the `layout` array and accurate `total_seats` integer are populated.
    *   **Dual-Track Scraper Integration (`functions/scraper/main.py`):**
        *   **Spec:** Update the JIT scraper to calculate sales using the master baseline when available, falling back to the 1 AM baseline gracefully.
        *   **Implementation Details:**
            *   Before calculating occupancy, attempt to fetch the studio baseline from `theatres/{theatre_id}/studios/{studio_id}`.
            *   Implement an in-memory or Redis cache for the `total_seats` to minimize redundant Firestore reads during high-frequency JIT scrapes.
            *   If a master layout exists and has `total_seats > 0`, calculate delta as `audience_count = master_capacity - seats_available_now`.
            *   If no master layout exists, fallback to `audience_count = seats_sold_now - initial_unavailable_at_1am`.
            *   Store `master_total_seats` and `baseline_source` ('master_studio_locked', 'master_studio_auto', '1am_fallback') in the JIT snapshot.
        *   *Verification:* Trigger a JIT scrape. Check the resulting snapshot in Firestore to ensure `baseline_source` is 'master_studio_auto' or 'master_studio_locked' and `master_total_seats` matches the baseline.
    *   **Admin UI Layout Viewer (Visual Integration):**
        *   **Spec:** When an admin clicks on a studio in the theatres panel, display a visual representation of the studio layout, similar to the seat map view in the movie performance per showtime section.
        *   **Implementation Details:**
            *   Create a React component (e.g., `StudioLayoutViewer`) that takes the `layout` array from the `Studio` model.
            *   Render the grid using a 2D layout structure based on rows and columns.
            *   Represent physical seats with a visual indicator (e.g., a filled square) and aisles as empty spaces.
            *   Handle different seat grades with distinct colors/labels (e.g., Sweetbox, Premiere).
            *   Integrate this viewer as a modal or an inline expandable section triggered by clicking a studio row inside the `TheatreStudiosList`.
        *   *Verification:* Open the Admin UI, navigate to a theatre, click on a mapped studio, and visually confirm the layout grid accurately represents the physical seats and aisles based on the parsed data.

### Tier 3: Visual Management & Cutover (Operational MVP)
**Business Value:** Gives the operational team full control over ticketing topology to handle edge cases manually, and finally deprecates the legacy, error-prone 1 AM delta system.
*   **Deliverables:**
    *   **Layout Editor:** Admin UI interactive grid editor to view layouts, toggle seat ↔ aisle, assign seat grades, and "Lock" layouts to prevent automated overwrites. *Verification: Open Admin UI, edit a studio layout, save, and verify `is_locked` is true and the layout changes are reflected in Firestore.*
    *   **Coverage Dashboard:** Admin UI dashboard to track the percentage of mapped vs. missing active studios. *Verification: Open Admin UI and view the coverage metrics.*
    *   **Absolute Occupancy Cutover:** Once ≥95% coverage is reached, system officially transitions, and the `scrape_initial_layouts.py` 1 AM cron job is disabled. *Verification: Verify cron job is commented out or removed from deployment configuration.*
