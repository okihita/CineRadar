# Technical Specification: Studio Layout & Occupancy Engine

## 1. Introduction
This document serves as the architectural "Ground Truth" for CineRadar's studio layout visualization and real-time occupancy calculation engine. It defines how raw API responses from TIX ID (XXI, CGV, Cinépolis, FLIX) are normalized into a unified virtual grid.

---

## 2. Source Architecture Analysis
Based on empirical audits of the TIX ID API, two primary structural patterns exist.

### 2.1 Pattern A: The "Nested" Model (XXI / CGV)
Used by XXI (Regular, IMAX, Premiere) and some CGV locations.
- **Specimens:** 
  - `docs/00_scraping_tixid/raw_payloads/11_studio_layout_xxi_imax.response`
  - `docs/00_scraping_tixid/raw_payloads/11_studio_layout_xxi_premiere.response`
- **Data Structure:** A nested list of `seat_rows`, where each row object contains its own `seat_rows` (seats).
- **Coordinate System:** Independent of array index. Spacing is defined by:
  - `vertical_lane`: Metadata describing where "aisles" should be inserted between columns (e.g., "before column 5").
  - `null` entries in the `seat_rows` array.
- **Seat Grading:** Usually a single global `price` field at the studio level.

### 2.2 Pattern B: The "Flat-Modulo" Model (Cinépolis / CGV / FLIX)
Used by Cinépolis, most CGV, and FLIX.
- **Specimens:**
  - `docs/00_scraping_tixid/raw_payloads/09_studio_layout_cinepolis.response`
  - `docs/00_scraping_tixid/raw_payloads/09_studio_layout_cinepolis_2.response`
  - `docs/00_scraping_tixid/raw_payloads/10_studio_layout_cgv_regular.response`
  - `docs/00_scraping_tixid/raw_payloads/08_studio_layout_flix.response`
- **Data Structure:** A 1D flattened array (`seat_map`) of all coordinates (seats and aisles).
- **Coordinate System:** **Index-Dependent**. The frontend must wrap the 1D array into 2D rows based on:
  - `max_horizontal_seat`: The fixed "modulo" or width of the theater.
  - `max_vertical_seat`: The total height.
- **Anomalies:** Non-contiguous rows. The same `row_name` (e.g., "A") may appear in index 0-8 and then again in index 18-26, separated by a row of empty spacers.
- **Seat Grading:** Managed via `price_group` metadata and `seat_grd_cd` on each seat object.

### 2.3 Inferred Provider Context
The bifurcation of these patterns is likely due to the underlying Cinema Management System (CMS) used by each chain.

#### 2.3.1 The "VISTA" Pattern (Flat / Boolean)
Most international chains (Cinépolis, CGV) use **Vista Entertainment Solutions**. 
- **Philosophy:** Data is treated as a **Coordinate Grid**. 
- **Logic:** Status is a **Boolean Availability Flag**. `1` (True) means "Available for Sale", while `0` (False) means "Not Available/Taken".
- **Export:** Typically exported as a linear stream that requires "Modulo-Wrapping" based on a fixed width (`max_horizontal_seat`).

#### 2.3.2 The "Legacy/Proprietary" Pattern (Nested / Additive)
Local or independent chains like XXI often use proprietary or older systems (e.g., NCR/Retalix).
- **Philosophy:** Data is structured around **Physical Rows**.
- **Logic:** Status is an **Additive Event Flag**. `0` is the neutral "Ready" state, and `1` is the "Sold" flag added to the seat record.
- **Export:** Naturally hierarchical (Row -> Seats), making it easier to parse but harder to map to a strict geometric grid without `vertical_lane` metadata.

---

## 3. Unified CineRadar Schema (V3)

To unify these patterns, CineRadar uses a **Virtual Grid** abstraction.

### 3.1 `UnifiedSeat` Object
Standardized representation of a single coordinate point.
```typescript
interface UnifiedSeat {
  id: string;        // Display ID (e.g., "A1"). Empty string if type is "aisle".
  type: "seat" | "aisle";
  grade?: string;    // Label (e.g., "REGULAR", "GOLD", "SWEETBOX")
  price_code?: string; // Original 'seat_grd_cd' for lookup
}
```

### 3.2 `Studio` Firestore Document
Stored at `theatres/{theatreId}/studios/{studioId}`.
```json
{
  "studio_id": "34",
  "version": 3,
  "max_columns": 9,
  "layout": [
    {
      "row_name": "A",
      "seats": [
        { "id": "A1", "type": "seat", "grade": "REGULAR" },
        { "id": "", "type": "aisle" }
      ]
    }
  ],
  "raw_initial_layout": { ... } // Most complete raw TIX ID payload
}
```

---

## 4. Visualization & Normalization Logic

### 4.1 Modulo-Aware Parsing (Flat Layouts)
For Cinépolis/FLIX/CGV, the parser MUST follow these rules:
1. **Chunking:** Slice the 1D `seat_map` into arrays of size `max_horizontal_seat`.
2. **Row Inheritance:** The `row_name` for a chunk is derived from the first non-empty `row_name` found within those 9 (or X) items.
3. **Ghost Filtering:** Completely empty chunks (9 aisles in a row) are preserved as vertical spacers to maintain the theater's physical aspect ratio.

### 4.2 Vertical Lane Injection (Nested Layouts)
For XXI, the parser MUST:
1. Iterate through `seat_rows`.
2. For each seat index, check against `vertical_lane` config.
3. Inject a `type: "aisle"` object into the `UnifiedSeat` array if the index matches a lane boundary.

---

## 5. Real-Time Occupancy Engine

Calculations are performed "Just-In-Time" by comparing the **Live Performance Payload** against the **Master Virtual Grid**.

### 5.1 Standardized Status Mapping
| CineRadar Status | TIX ID Code (XXI) | TIX ID Code (Cinépolis) | Description |
| :--- | :--- | :--- | :--- |
| **Available** | `1` | `1` | For sale / Vacant |
| **Sold / Booked** | `6` | `0` | Occupied or in Checkout |
| **Aisle / Blocked**| `5` | `N/A` | Physical gap or Maintenance |

### 5.2 The Calculation Algorithm
1. **Total Capacity:** Count of all `type: "seat"` items in the Master Virtual Grid.
2. **Sold Count:** Count of items in the live payload matching the "Sold" status code for that merchant.
3. **Occupancy %:** `(Sold Count / Total Capacity) * 100`.

---

## 7. Appendix: Predicted TIX ID Internal Database Schema

Based on the response patterns, TIX ID likely operates as a "Pass-Through Aggregator" with two distinct internal schemas for their providers.

### 7.1 Provider Schema 1 (Nested / XXI)
*Likely an older, row-centric relational model.*

**Table: `Studio_Master`**
- `studio_id`: PK
- `max_columns`: Integer
- `layout_json`: [ { `row_label`, `seats`: [ { `id`, `default_status` } ] } ]

**Table: `Showtime_Performance`**
- `session_id`: PK
- `studio_id`: FK
- `realtime_map`: (Overlay of `status` codes onto the `Studio_Master` template)
- **Logic:** "Status 1" is an additive flag (Sold).

### 7.2 Provider Schema 2 (Flat / Cinépolis / Vista-based)
*Likely a modern, coordinate-based grid model.*

**Table: `Studio_Grid`**
- `studio_id`: PK
- `width` (`max_horizontal_seat`): Integer
- `height` (`max_vertical_seat`): Integer

**Table: `Studio_Seats` (The 1D Stream)**
- `id`: Unique coordinate (e.g., `row-col-index`)
- `row_name`: String (Floating label)
- `seat_no`: String
- `is_physical` (`seat_yn`): Boolean
- `grade_code`: String (FK to `Price_Groups`)

**Table: `Showtime_Availability`**
- `session_id`: PK
- `seat_id`: FK
- `is_available` (`seat_status`): Boolean
- **Logic:** "Status 1" is a boolean "True" (Available), "Status 0" is "False" (Taken).

---

## 8. Known Edge Cases
- **The "Split Row A" (Cinépolis):** Row A may be physically split by an aisle. The Modulo-Aware parser handles this by keeping them in separate chunks but preserving their "A" label.
- **Asymmetric Grids:** Some TIX responses provide a `max_horizontal_seat` that does not perfectly divide the `seat_map` length. In these cases, the final chunk is padded with virtual aisles to complete the grid.
- **Alphabetical Skips (Missing Row I/O):** Many theaters skip letters like "I" or "O" to avoid confusion with numbers (1 or 0). Our Modulo-Aware parser is immune to this because it relies on index-based chunking rather than alphabetical sequence. (Specimen: `docs/00_scraping_tixid/raw_payloads/10_studio_layout_cgv_grand_indonesia_anomaly.response`)
