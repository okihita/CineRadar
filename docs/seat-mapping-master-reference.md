# CineRadar Seat Mapping: Master Reference Guide

This document serves as the definitive technical standard for how CineRadar translates raw, chain-specific API responses into a unified mathematical and visual model.

---

## 1. The Goal: The Unified Matrix

Regardless of the cinema chain, every seat layout is normalized into a **Matrix** (a 2D array of integers). This ensures the Admin UI and the Business Intelligence engine treat all data identically.

### The Universal Status Codes
| Value | Logical Meaning | Visual Color | Math Calculation |
| :--- | :--- | :--- | :--- |
| **`1`** | **Available** | Green | `total_seats + 1` |
| **`0`** | **Booked** (Sold/Blocked) | Gray/Red | `total_seats + 1`, `sold_seats + 1` |
| **`-1`** | **Aisle** (Physical Gap) | Invisible | **Ignored** (No math impact) |

---

## 2. JIT Scraper: Calculation Logic

The JIT Scraper uses a **Hybrid Denominator** strategy to ensure 100% accurate occupancy metrics, even when cinemas dynamically close sections of a theater.

### The Formula
1. **Numerator**: Count exact "Sold" seats (`status 0`) from the real-time API response.
2. **Denominator**: Prefer the **Master Physical Capacity** (from the Registry). If missing, fallback to current API count.
3. **Calculation**: `Occupancy % = (Sold / Physical Capacity) * 100`.

### Simulation: Row B with Aisle Gap
| API Object | `seat_yn` | `status` | Result | Math Impact |
| :--- | :---: | :---: | :---: | :--- |
| Seat 1 | 1 | 1 | `1` | `Total + 1` |
| Aisle | 0 | 0 | `-1` | **Ignore** |
| Seat 2 | 1 | 0 | `0` | `Total + 1, Sold + 1` |

---

## 3. Logic Type A: Flat Structure (Cinépolis, FLIX, CGV B2B)

These chains return every coordinate in the theater as a flat list. Physical space is represented by "dummy" objects.

### **Actual Data Case: GAJAH MADA PLAZA CINEPOLIS (April 6th, 13:55)**
**Firestore Ref**: `movie_performance_v2/2029814266927857664/days/2026-04-06/showtimes/1-0-0-0`

#### **Raw JSON Segment (Row A)**
```json
[
  {"row_name": "A", "seat_no": "14", "seat_yn": "1", "seat_status": 1}, // Seat
  {"row_name": "A", "seat_no": null, "seat_yn": "0", "seat_status": 0}, // AISLE
  {"row_name": "A", "seat_no": null, "seat_yn": "0", "seat_status": 0}  // AISLE
]
```

#### **The Algorithm**
```python
if item["seat_yn"] == "0":
    return -1  # Mark as Aisle
elif item["seat_status"] == 1:
    return 1   # Mark as Available
else:
    return 0   # Mark as Booked
```

---

## 4. Logic Type B: Nested Structure (XXI, CGV Classic)

These chains return a list of "Rows," each containing its own array of "Seats."

### **Actual Data Case: CIWALK PREMIERE XXI (April 6th, 13:05)**
**Firestore Ref**: `movie_performance_v2/2014634241349992448/days/2026-04-06/showtimes/2040595442604969984`

#### **Raw JSON Segment (Row B)**
```json
{
  "row_name": "B",
  "seat_rows": [
    {"status": 1, "seat_row": "B1"},
    {"status": 6, "seat_row": "B3"}
  ]
}
```

#### **The Algorithm**
```python
for seat in row["seat_rows"]:
    if seat["status"] == 1:
        return 1  # Available
    elif seat["status"] in (5, 6):
        return 0  # Booked
    else:
        return -1 # Aisle (if explicitly marked)
```

---

## 5. Backward Compatibility & Safety

To ensure that deploying the new logic doesn't break historical data:

1. **Frontend Resilience**: The UI renderer checks for `-1`. If not found (legacy data), it defaults to the old collapsed view. If found, it renders gaps.
2. **Mathematical Isolation**: The code `if status != -1: total_seats += 1` ensures that new data matches the old math perfectly.
3. **Registry-First Matching**: The system only uses high-fidelity matching for theaters that have been updated to `version: 3`. Legacy theaters remain on the basic grid math.
