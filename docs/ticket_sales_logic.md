# Ticket Sales Data Flow: From Source to Dashboard

> This document explains how CineRadar calculates "Tickets Sold" and "Revenue". It traces the data journey from the raw TIX.id B2B API response, through the scraping and aggregation pipeline, to the final display on the Admin Dashboard.

## 🚀 High-Level Data Pipeline

1.  **Source**: TIX.id B2B API provides a real-time seat map (JSON) for a specific showtime.
2.  **Ingestion (Scraper)**: The `SeatScraper` parses this map, counting "Available" vs "Unavailable" seats based on specific status codes.
3.  **Persistence (Firestore)**: Individual `ShowtimeSnapshot` documents are saved containing these counts.
4.  **Aggregation (Backend)**: The `PerformanceAggregator` sums up all snapshots for a movie on a specific date into a `DailyPerformance` document.
5.  **Presentation (Admin)**: The Admin API reads the `DailyPerformance` stats and calculates revenue (Tickets × Avg Price).

---

## 1. The Source: TIX.id B2B API

**Endpoint**: `GET https://api-b2b.tix.id/v1/movies/{merchant}/layout`

The API returns a JSON object representing the physical layout of the cinema hall.

### Raw JSON Structure (Example)

```json
{
  "code": 1000,
  "data": {
    "seat_map": [
      {
        "row_name": "A",
        "seat_rows": [
          { "seat_row": "A1", "status": 1 },  // Available
          { "seat_row": "A2", "status": 5 },  // Sold/Reserved
          { "seat_row": "A3", "status": 6 }   // Sold/Blocked
        ]
      }
    ]
  }
}
```

### Status Codes (The "Truth")

CineRadar relies on specific integer codes to determine seat status.

| Code | Interpretation | Scraper Logic |
|------|----------------|---------------|
| `1`  | **Available**  | Counted as `available_seats` |
| `5`  | **Sold / Reserved** | Counted as `sold_seats` |
| `6`  | **Sold / Reserved** | Counted as `sold_seats` |
| `0`  | **Aisle / Gap** | Ignored (in some merchants) |
| Other| **Unknown**    | Ignored |

> **⚠️ Limitation**: The API does not distinguish between a seat that was **sold** to a human and a seat that is **blocked** for maintenance or social distancing. Therefore, our "Tickets Sold" metric is technically "Seats Unavailable".

---

## 2. The Ingestion: Seat Scraper Logic

**File**: `backend/infrastructure/core/seat_scraper.py`

The scraper acts as the translator. It iterates through every seat in the layout and maintains three counters:
- `total`
- `available`
- `unavailable` (This becomes "Tickets Sold")

### Algorithm (`_count_seat`)

```python
def _count_seat(self, status: int, counters: dict[str, int]) -> int:
    if status == 1:  # Available
        counters["available"] += 1
        counters["total"] += 1
        return 1
    elif status in (5, 6):  # Unavailable
        counters["unavailable"] += 1  <-- THIS IS THE TICKET COUNT
        counters["total"] += 1
        return 0
    return -1
```

### Handling Merchant Variations
- **XXI / CGV**: Uses a nested structure (`seat_map` -> `seat_rows` -> `status`).
- **Cinépolis**: Often uses a flat structure. The scraper handles a special case where `seat_yn="1"` and `status=0` also implies **Sold**.

---

## 3. The Aggregation: Performance Service

**File**: `backend/application/services/performance_aggregator.py`

Once a single showtime is scraped, it is saved as a `ShowtimeSnapshot`. The system immediately triggers an aggregation step to update the movie's daily statistics.

### Database Schema (Firestore)

**1. Individual Snapshot** (`movie_performance/{id}/days/{date}/showtimes/{showtime_id}`)
```json
{
  "total_seats": 150,
  "sold_seats": 45,       // <-- Derived from counters["unavailable"]
  "occupancy_pct": 30.0,
  "scraped_at": "2025-01-22T10:00:00Z"
}
```

**2. Daily Aggregation** (`movie_performance/{id}/days/{date}`)
The `PerformanceAggregator` queries **all** snapshots for that movie/date and sums them up:

```python
# Pseudo-code logic
total_sold_daily = sum(snapshot.sold_seats for snapshot in daily_showtimes)
total_seats_daily = sum(snapshot.total_seats for snapshot in daily_showtimes)
avg_occupancy = (total_sold_daily / total_seats_daily) * 100
```

This aggregate document is the **Single Source of Truth** for the dashboard.

---

## 4. The Presentation: Admin Dashboard API

**File**: `admin/src/app/api/executive-dashboard/route.ts`

The Admin Dashboard does **not** compute ticket sales from raw data. It simply reads the pre-calculated aggregate from Step 3.

### Computation Logic

```typescript
// 1. Fetch the movie's performance doc
const days = await firestore.getSubCollection(`movie_performance/${id}/days`);

// 2. Find the most recent day with data
const todayStats = days.find(d => d.date === TODAY);

// 3. Extract the pre-calculated total
const ticketsSold = todayStats.total_sold; // <-- Value displayed in UI

// 4. Estimate Revenue (Hardcoded Average Price)
const estimatedRevenue = ticketsSold * 40000; // 40k IDR per ticket
```

---

## 🔍 Debugging: Why is "Tickets Sold" 0?

If you see `0` tickets sold for a movie like **MERCY**, the failure occurred in one of these upstream steps:

### Scenario A: The Scraper Failed (Most Likely)
- **Check**: Is `total_showtimes_scraped` > 0 in the database?
- **Cause**: The scraper crashed, timed out, or authentication failed before it could save any snapshots.
- **Result**: No snapshots = Sum is 0.

### Scenario B: Status Code Mismatch
- **Check**: Look at the `raw_api_response` for a showtime. Are the seats using status codes `5` or `6`?
- **Cause**: TIX.id might have introduced a new code (e.g., `9`) for sold seats that our scraper doesn't recognize.
- **Result**: Scraper counts them as "Unknown/Ignored", so `unavailable` counter stays at 0.

### Scenario C: JIT Pipeline Failure
- **Check**: `scraper_logs` for the day.
- **Cause**: The Cloud Function dispatcher didn't trigger the job, or the worker failed to write to Firestore.
- **Result**: The "Real-time" aggregation never happened.

### Scenario D: Aggregation Lag
- **Cause**: Snapshots exist, but the `PerformanceAggregator` failed to update the parent `DailyPerformance` document.
- **Result**: Individual showtimes show data, but the summary (used by Admin) says 0.

## 🛠 Verification Tool

Use the CLI to inspect a specific showtime's raw data and verify if the scraper "saw" the sold seats:

```bash
# Check raw API response and calculated occupancy
python backend/cli/inspect_showtime.py --showtime-id <ID> --verbose
```

---

## 5. Raw Seating Layout Examples

Below are representative snippets of the raw JSON structure returned by the TIX.id B2B API for each major cinema chain.

### XXI / CGV (Nested Structure)

The standard format uses `seat_map` containing a list of row objects, each having `seat_rows`.

```json
{
  "code": 1000,
  "data": {
    "seat_map": [
      {
        "row_name": "A",
        "seat_rows": [
          {
            "seat_row": "A1",
            "status": 1  // Available
          },
          {
            "seat_row": "A2",
            "status": 5  // Sold
          }
        ]
      },
      {
        "row_name": "B",
        "seat_rows": [ ... ]
      }
    ]
  }
}
```

### Cinépolis (Flat Structure)

Some Cinépolis locations return a flat list of seats directly in `seat_map`, or use different field names.

```json
{
  "code": 1000,
  "data": {
    "seat_map": [
      {
        "row_name": "A",
        "seat_row": "A1",
        "status": 1,
        "seat_yn": "1"
      },
      {
        "row_name": "A",
        "seat_row": "A2",
        "status": 0,      // NOTE: Status 0 with seat_yn="1" means SOLD here
        "seat_yn": "1"
      },
      {
        "row_name": "A",
        "seat_row": "",
        "status": 0,
        "seat_yn": "0"    // Aisle / Gap
      }
    ]
  }
}
```

---

## 6. Actual JSON Data

This section contains real-world examples of raw TIX.id API responses captured from live scrapes on 2026-01-22.

> **Note**: Arrays are truncated for readability.

### XXI (Real Sample)
```json
{
  "data": {
    "max_horizontal_seat": 18,
    "seat_rules": {
      "vertical_lane": [
        {
          "before_seat_column": 5,
          "end": "N",
          "start": "A"
        },
        {
          "before_seat_column": 15,
          "end": "N",
          "start": "A"
        }
      ],
      "horizontal_lane": null
    },
    "seat_rule_config": {
      "type": 1,
      "allowed_adjacent_seat": 0
    },
    "max_vertical_seat": 13,
    "user_seat_purchased": 0,
    "price": 70000,
    "user_seat_transaction_limit": 8,
    "user_seat_daily_limit": 10,
    "seat_map": [
      {
        "seat_code": "A",
        "max_row": 18,
        "seat_rows": [
          {
            "seat_row": "A1",
            "status": 5
          },
          {
            "seat_row": "A2",
            "status": 5
          },
          {
            "seat_row": "A3",
            "status": 6
          },
          {
            "...": "(15 more seats)"
          }
        ]
      },
      {
        "seat_code": "B",
        "max_row": 18,
        "seat_rows": [
          {
            "seat_row": "B1",
            "status": 5
          },
          {
            "seat_row": "B2",
            "status": 5
          },
          {
            "seat_row": "B3",
            "status": 5
          },
          {
            "...": "(15 more seats)"
          }
        ]
      },
      {
        "...": "(11 more rows)"
      }
    ]
  },
  "success": true
}
```

### CGV (Real Sample - Flat Structure)
```json
{
  "data": {
    "max_horizontal_seat": 21,
    "floor_separator_after": "",
    "max_vertical_seat": 9,
    "price_group": [
      {
        "seat_grd_cd": "01",
        "seat_grd_nm": "REGULAR",
        "separator_color": "#fbfbfb",
        "seat_color": "#192C4F",
        "seat_grd_price": 36000
      }
    ],
    "user_seat_purchased": 0,
    "user_seat_transaction_limit": 6,
    "user_seat_daily_limit": 10,
    "seat_map": [
      {
        "row_name": "A",
        "seat_grd_cd": "01",
        "seat_no": "21",
        "seat_yn": "1",
        "seat_group": null,
        "seat_id": "01002201",
        "seat_status": 1
      },
      {
        "row_name": "A",
        "seat_grd_cd": "01",
        "seat_no": "20",
        "seat_yn": "1",
        "seat_group": null,
        "seat_id": "01002101",
        "seat_status": 1
      },
      {
        "...": "(187 more rows)"
      }
    ]
  },
  "success": true
}
```

### Cinépolis (Real Sample)
```json
{
  "data": {
    "max_vertical_seat": 9,
    "user_seat_transaction_limit": 6,
    "seat_map": [
      {
        "row_name": "A",
        "seat_status": 1,
        "seat_yn": "1",
        "seat_id": "1-0-0-0",
        "seat_no": "1",
        "seat_grd_cd": "0000000000",
        "seat_group": null
      },
      {
        "row_name": "A",
        "seat_status": 1,
        "seat_yn": "1",
        "seat_id": "1-0-1-0",
        "seat_no": "2",
        "seat_grd_cd": "0000000000",
        "seat_group": null
      },
      {
        "...": "(133 more rows)"
      }
    ],
    "user_seat_purchased": 0,
    "max_horizontal_seat": 15,
    "price_group": [
      {
        "separator_color": "#fbfbfb",
        "seat_grd_nm": "REGULAR",
        "seat_color": "#192c4f",
        "seat_grd_cd": "0000000000",
        "seat_grd_price": 44000
      }
    ],
    "user_seat_daily_limit": 10
  },
  "success": true
}
```
