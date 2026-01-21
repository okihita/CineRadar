# Raw API Response Documentation

> This document describes the full TIX.id B2B API response stored in `movie_performance` collection for debugging and audit purposes.

## Overview

Every JIT scrape stores the complete TIX.id API response in the `raw_api_response` field of showtime documents. This enables:

- **Debugging**: Investigate seat calculation discrepancies
- **Audit Trail**: Track API changes over time
- **Schema Validation**: Detect structure changes before they break scrapers
- **Forensic Analysis**: Reconstruct seat availability from historical data

## Storage Location

```
movie_performance
├─ {movie_id}
│  ├─ {date}
│  │  ├─ showtimes
│  │  │  └─ {showtime_id}
│  │  │     ├─ showtime_id
│  │  │     ├─ movie_id
│  │  │     ├─ theatre_name
│  │  │     ├─ occupancy_pct
│  │  │     ├─ layout_compressed (bytes)
│  │  │     └─ raw_api_response (object)  ← FULL API RESPONSE HERE
```

## API Endpoint

The raw response comes from:

```http
GET https://api-b2b.tix.id/v1/movies/{merchant}/layout
    ?show_time_id={id}
    &tz=7
Authorization: Bearer {JWT_TOKEN}
```

## Response Structure

### Top Level

```json
{
  "success": true,
  "data": { ... }
}
```

| Field | Type | Description |
|-------|-------|-------------|
| `success` | boolean | API call succeeded |
| `data` | object | Contains seat layout and metadata |

### Data Object

```json
{
  "user_seat_purchased": 0,
  "user_seat_daily_limit": 10,
  "user_seat_transaction_limit": 8,
  "max_horizontal_seat": 15,
  "max_vertical_seat": 9,
  "seat_rule_config": { ... },
  "seat_rules": { ... },
  "price": 45000,
  "seat_map": [ ... ]
}
```

| Field | Type | Description |
|-------|-------|-------------|
| `user_seat_purchased` | int | Number of seats current user has purchased (for API rate limiting) |
| `user_seat_daily_limit` | int | Max seats user can purchase daily |
| `user_seat_transaction_limit` | int | Max seats per transaction |
| `max_horizontal_seat` | int | Max number of seats per row |
| `max_vertical_seat` | int | Max number of rows in theatre |
| `seat_rule_config` | object | Seating rules (e.g., adjacent seat restrictions) |
| `seat_rules` | object | Lane/aisle configuration |
| `price` | int | Ticket price in IDR |
| `seat_map` | array | Array of seat sections/rows |

### Seat Map Structure

XXI uses a **nested structure** with sections per row:

```json
{
  "seat_map": [
    {
      "seat_code": "A",
      "max_row": 15,
      "seat_rows": [
        {
          "seat_row": "A1",
          "status": 1
        },
        {
          "seat_row": "A2",
          "status": 1
        }
      ]
    }
  ]
}
```

| Field | Type | Description |
|-------|-------|-------------|
| `seat_code` | string | Row identifier (A, B, C, etc.) |
| `max_row` | int | Maximum seat number in this row |
| `seat_rows` | array | Array of individual seats in this row |

#### Individual Seat Object

```json
{
  "seat_row": "A1",
  "status": 1
}
```

| Field | Type | Description |
|-------|-------|-------------|
| `seat_row` | string | Seat identifier (e.g., "A1", "B15") |
| `status` | int | Seat status code (see below) |

### Merchant-Specific Variations

| Merchant | Structure | Key Differences |
|----------|-----------|-----------------|
| **XXI** | Nested (`seat_code` → `seat_rows`) | Most detailed, section-based |
| **CGV** | Nested | Similar to XXI |
| **Cinépolis** | Flat | May use `seat_yn`, `seat_status`, different field names |

## Status Codes

| Code | Status | Meaning |
|------|--------|---------|
| `1` | **Available** | Seat can be purchased |
| `5` | **Unavailable** | Sold or blocked (cannot distinguish) |
| `6` | **Unavailable** | Sold or blocked (cannot distinguish) |

**Important:** The API does not distinguish between "sold" and "under maintenance/blocked". Occupancy should be treated as **maximum upper bounds**.

## Complete Example

```json
{
  "success": true,
  "data": {
    "user_seat_purchased": 0,
    "user_seat_daily_limit": 10,
    "user_seat_transaction_limit": 8,
    "max_horizontal_seat": 15,
    "max_vertical_seat": 9,
    "seat_rule_config": {
      "type": 1,
      "allowed_adjacent_seat": 0
    },
    "seat_rules": {
      "horizontal_lane": null,
      "vertical_lane": [
        {
          "start": "A",
          "end": "J",
          "before_seat_column": 9
        }
      ]
    },
    "price": 45000,
    "seat_map": [
      {
        "seat_code": "A",
        "max_row": 15,
        "seat_rows": [
          {
            "seat_row": "A1",
            "status": 1
          },
          {
            "seat_row": "A2",
            "status": 1
          },
          {
            "seat_row": "A3",
            "status": 6
          },
          {
            "seat_row": "A4",
            "status": 1
          }
        ]
      },
      {
        "seat_code": "B",
        "max_row": 15,
        "seat_rows": [ ... ]
      }
    ]
  }
}
```

## Access Methods

### 1. CLI Tool (Recommended)

```bash
python backend/cli/inspect_showtime.py \
  --showtime-id <SHOWTIME_ID> \
  --movie-id <MOVIE_ID> \
  --date YYYY-MM-DD \
  --verbose
```

Outputs:
- Metadata summary
- Seat status codes found
- Seat types detected
- Full raw JSON (with `--verbose`)

### 2. Admin API

```http
GET /api/showtimes/[showtimeId]/raw?movieId=X&date=Y
```

### 3. Firestore Console

Navigate to:
```
movie_performance/{movie_id}/days/{date}/showtimes/{showtime_id}
```

## Debugging Use Cases

### 1. Investigate 0% Occupancy

If a showtime shows 0% occupancy but you know seats are sold:

1. Use CLI tool: `python backend/cli/inspect_showtime.py ... --verbose`
2. Check if `raw_api_response` exists
3. Look for status codes in the response
4. Verify our scraper is interpreting codes correctly (1 = available, 5/6 = sold)

### 2. Detect Schema Changes

If scraper starts failing:

1. Look for CRITICAL logs with "schema changed" messages
2. Inspect `raw_api_response` for new fields
3. Compare with working examples in this document
4. Update scraper logic if structure changed

### 3. Audit Historical Data

To verify past data:

1. Query Firestore for specific showtimes
2. Extract `raw_api_response`
3. Re-calculate occupancy manually
4. Compare with stored values

### 4. Seat Type Analysis

Some merchants have multiple seat types (Standard, VIP, Couple):

1. Use CLI tool to see all detected seat types
2. Check if status codes vary by seat type
3. Verify calculation logic handles different types correctly

## Common Issues

| Issue | Symptom | Root Cause | Fix |
|--------|-----------|--------------|------|
| Legacy data | `raw_api_response` field missing | Scraped before feature implemented | Re-scrape showtime |
| Wrong status codes | All seats show as sold | Code interpretation bug | Update `calculate_occupancy()` |
| Structure changed | Scraper fails | API added new fields | Update schema validation |
| Wrong merchant | Unknown seat layout | Merchant path mismatch | Check `MERCHANT_PATHS` mapping |

## Sample Data

A complete sample with real data is available in:
```
data/raw_seat_layout_sample.json
```

Generated by:
```bash
python scrape_showtime_sample.py
```

Sample showtime:
- Theatre: AGORA MALL XXI
- Movie: PRIMATE
- Date: 2026-01-22
- Showtime: 20:30
- Occupancy: 16.3% (22/135 seats)
