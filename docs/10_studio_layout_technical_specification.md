# Technical Specification: Studio Layout & Occupancy Engine

## 1. Introduction
This document serves as the architectural "Ground Truth" for CineRadar's studio layout visualization and real-time occupancy calculation engine. It defines the **"Theater Digital Twin"** model, where raw API responses are normalized into a physical template with a separate metadata registry for pricing and styling.

---

## 2. The Theater Digital Twin Model (V3.3)
To ensure maximum maintainability, CineRadar separates the **Physical Structure** from its **Metadata Registry** and its **Real-time Occupancy**.

### 2.1 The Master Template (`physical_layout`)
Every studio has a permanent physical template derived via 5-day multi-showtime consensus. 

#### 2.1.1 `UnifiedSeat` Object (Normalized)
The seat object contains only the immutable physical properties and a reference to its category.
```typescript
interface UnifiedSeat {
  id: string;        // Coordinate-based ID (e.g., "A1", "B2")
  type: "seat" | "aisle";
  grade: string;     // Primary Key: Must match 'seat_grd_cd' in the metadata registry.
}
```

#### 2.1.2 Metadata Registry (`price_groups`)
A lookup table keyed by `seat_grd_cd` that maps grade IDs to their visual and financial properties.
```typescript
interface PriceGroups {
  [seat_grd_cd: string]: {
    name: string;      // Label (e.g., "SWEETBOX", "GOLD")
    color: string;     // Official HEX code from provider
    prices: {          // Temporal Price Cycle Map
      mon_thu: number; // Weekday price
      fri: number;     // Friday premium
      sat_sun: number; // Weekend/Holiday peak
    }
  }
}
```

#### 2.1.3 `Studio` Firestore Schema (V3.3.3 Atomic)
```json
{
  "id": "34",
  "version": 3.3,
  "price_groups": {
    "01": { "name": "REGULAR", "color": "#71717a" }
  },
  "evidence": [
    { "date": "2026-04-09", "movie_title": "...", "showtime_id": "..." }
  ],
  "physical_layout": {
    "total_capacity": 150,
    "grid": [...]
  }
}
```

---

### 3. The Evidence-Based Verification Standard
To ensure the "Ever-Available" rule is auditable, every studio promotion MUST record its **Temporal Proof**. 

- **Implicit Verification:** A studio is considered **"VERIFIED"** if it contains a root-level `evidence` array. Manual "Confirmation" booleans and `last_updated` timestamps are deprecated and removed.
- **The 7-Day Contiguous Ideal:** The gold standard for consensus is **7 consecutive days** scanning backwards from Yesterday.
- **The Robustness Rule:** The engine MUST accept **any number of available days** (Best Effort).
- **The Freshness Rule:** Freshness is derived **exclusively** from the `date` of the latest object in the `evidence` array. Consensus SHOULD be refreshed every **90 days**.
- **Schema Versioning:** The root-level `version` field tracks the document structure version (e.g., 3.3). Nested `version` fields (e.g., inside `physical_layout`) are prohibited and MUST be removed during promotion.
- **Metadata Purity:** The `price_groups` registry MUST only store temporal pricing via the `prices` object. Legacy single-value `price` fields are deprecated and removed.
- **Storage Strategy (Lean Audit):** To prevent Firestore document bloat, the `evidence` array MUST only store metadata (IDs, Date, Time, Price). The full raw layout for an evidence sample MUST be fetched on-demand.
- **Audit Fields:** Showtime ID (`showtime_id`), Movie ID (`movie_id`), Date, Exact Time, Movie Title, Price.

---

## 4. Source Architecture & Normalization logic
The **Consensus Engine** and **Frontend Visualizer** use a unified normalization logic to handle data across different cinema chains:

- **Clean Room Specimen Priority:** The engine MUST prioritize the **`initial_raw_layout` (2 AM Snapshot)** as the primary source for establishing the Physical Master Template. This ensures the template is built before operational seat-blocking or dynamic row hiding occurs. The `raw_api_response` (Just-In-Time) SHOULD only be used as a fallback if the 2 AM snapshot is missing.
- **Automatic Wrapper Detection (Smart Parsing):** To ensure forensic compatibility, the parsing engine MUST intelligently detect and "dig" into Firestore document wrappers. It should look for core seating data within `initial_raw_layout.data`, `raw_api_response.data`, or root-level `.data` fields automatically.
- **Identity Integrity:** The `studio_id` used in the path MUST be verified against the internal `studio_id` (or `id`) within the document. Discrepancies should be flagged as anomalies.

### 4.1 Pattern A: The "Nested" Model (XXI / Legacy)
- **Physicality:** A coordinate is a seat only if it is found with **Status 1 (Available)** in at least one sample. Consistently "Blocked" (Status 6) nodes are converted to aisles.
- **Spacing:** Injected via `seat_rules.vertical_lane` metadata.
- **Pricing:** XXI uses a global **`price`** field at the studio root level (e.g., `data.price`). Individual seats lack `price_group` metadata. 
- **Weekend Awareness:** The consensus MUST scan 7 days to record both **Weekday** and **Weekend/Holiday** price points. The metadata registry SHOULD store these as distinct values (e.g., `price_weekday`, `price_weekend`) if variations are detected.
- **Strict Normalization:** The consensus engine MUST extract the price from the sampled showtime. If no price metadata is found, the engine MUST record an error state in the registry. "Default" or "Fallback" price groups are strictly prohibited.
- **Graceful Degradation:** In cases of missing metadata, the UI MUST still render the physical layout but should display a warning banner and use neutral styling for affected seats.

### 4.2 Pattern B: The "Flat-Modulo" Model (Cinépolis / CGV / FLIX / VISTA)
- **Logic:** Sliced into rows using `max_horizontal_seat` (The Modulo Rule).
- **Consensus:** Identifies "Ghost Rows" and "Split Rows" by observing patterns over the 7-day window.
- **Pricing:** Price groups are extracted from the `price_group` array. Similar to Pattern A, the engine MUST capture the price variation across the 7-day week.

---

## 5. Real-Time Occupancy Engine
Calculations are performed by **overlaying** live status codes onto the template.

### 5.1 Standardized Status Map
| CineRadar Status | VISTA (Ciné/CGV/FLIX) | Legacy (XXI) | Description |
| :--- | :--- | :--- | :--- |
| **Available** | `1` | `1` | For sale / Vacant |
| **Booked** | `N/A` | `5` | Reserved / Pending Payment (Physically Real) |
| **Sold / Dead** | `0` | `6` | Paid or Structural/Aisle/Maintenance |

---

## 6. Visualization Rules (Semi-Smart UI)
The Frontend Visualizer uses a simple hash-map lookup for rendering:
1. It loops through `physical_layout.grid`.
2. It looks up styling via `price_groups[seat.grade]`.
3. It draws the square using the retrieved `color` and `name`.
4. It overlays the live occupancy state.

### 6.1 Audit Legend (Proof Mode)
- **Green (Status 1):** Available for purchase.
- **Amber (Status 5):** Reserved/Booked (Physical seat confirmed).
- **Red (Status 6):** Occupied or blocked (Ambiguous until consensus).
- **Gray:** Structural aisle or consistently blocked node.

---

## 7. Known Anomaly Handling
- **Alphabetical Skips:** Many theaters skip letters like "I" or "O" to avoid confusion with numbers. Our Modulo-Aware parser handles this via index-based chunking.
- **Dead Seat Consensus:** Solves the XXI "Aisle vs Sold" ambiguity by empirically observing seat availability across multiple movies.
- **Split Rows:** Some VISTA layouts split a single row name across physical lines (e.g., Row A separated by an aisle). These are preserved as vertical gaps in the grid.
- **Theatre-Studio Collision Anomaly:** When scanning performance data, the engine MUST verify BOTH `theatre_id` AND `studio_id`. Because Studio IDs (e.g., "1", "IMAX") are not globally unique across a movie's showtimes, failing to verify the theatre ID will result in data corruption from unrelated locations (e.g., using Ambon layouts for a Jakarta theater). This was discovered during the Cijantung XXI pilot.

---

## 8. Financial & Revenue Logic
To ensure accuracy in multi-chain environments where pricing can be dynamic per movie or showtime, CineRadar implements a strict **Financial Separation of Concerns**:

- **The Studio Registry (Market Guide):** The `price_groups` object in the Studio document represents the **Typical Market Guide** (Peak Potential). The `prices` temporal map (`mon_thu`, `fri`, `sat_sun`) stores the maximum observed price for those tiers. It serves as a reference for UI labels and room categorization.
- **The Performance Document (Actual Transaction):** The individual showtime performance document (`movie_performance_v2`) is the **Exclusive Source of Truth** for financial auditing. 
- **Revenue Calculation:** All revenue and occupancy value engines MUST use the `price` found in the specific showtime's payload. The Studio template's price MUST NOT be used for revenue calculations as it may not reflect movie-specific discounts or premium surges.
