# CineRadar Seat Mapping & Spatial Awareness Analysis

This document explains the technical implementation of seat mapping in CineRadar, the current limitations regarding spatial gaps (aisles), and the risks involved in refactoring the logic.

---

## 1. Current Architecture: "Metric-First" Mapping

CineRadar currently uses a simplified grid system to save database space and ensure high-speed occupancy calculations.

### The `layout_grid` Structure
In Firestore snapshots, a row is stored like this:
`["A", [1, 1, 0, 1, 1]]`

- `1`: Available Seat (Green in UI)
- `0`: Sold/Blocked Seat (Gray/Red in UI)

### The "Collapse" Bug
In the FLIX/Cinépolis API (`seat_yn` format), the API sends "dummy" objects to represent aisles:
1. Seat A1 (`seat_yn: 1`)
2. Seat A2 (`seat_yn: 1`)
3. Aisle Space (`seat_yn: 0`) <-- **CURRENTLY SKIPPED**
4. Seat A3 (`seat_yn: 1`)

**Result in Database:** `["A", [1, 1, 1]]`
**Result in UI:** Three seats touching each other. The physical gap is lost.

---

## 2. Risk Analysis: Why touching this is dangerous

The user's concern about **miscalculation** is highly valid. Here are the specific risks:

### Risk A: Denominator Inflation (The "Fake Capacity" Problem)
If we simply stop "skipping" the items, the counter might do this:
`total_seats += 1` for every item in the list.
- **Consequence**: The system will think an aisle is a "chair." 
- **Impact**: If a room has 100 seats and 20 aisle spaces, CineRadar will report "120 Seats." This makes your occupancy percentages wrong.

### Risk B: Index Shifting (The "Wrong Seat" Problem)
If the backend starts sending gaps but the frontend isn't updated simultaneously:
- The UI might render the gap as a "Sold Seat."
- Or worse, it might shift the "Sold" status to the wrong coordinate.

### Risk C: Performance Collection Breakdown
We have millions of rows of historical data. If we change the meaning of `0` or `1` in the array, old data will become unreadable or misleading.

---

## 3. The "Safe Path" Forward: The Aisle Constant

To fix the visual gaps without breaking the math, we must move to a **Tri-State Logic**:

1.  **Define a new constant**: `-1` will represent a **Physical Aisle**.
2.  **Update Scraper Logic**:
    ```python
    if seat_yn == "0":
        row_statuses.append(-1) # Do NOT increment total_seats
    ```
3.  **Update UI Logic**:
    ```javascript
    if (seat_status === -1) return <div className="w-4 h-4 invisible" />; // Render empty space
    ```

---

## 4. Verification Checklist

Use this checklist to verify if the system is working correctly after any change.

### ✅ Phase 1: Mathematical Accuracy (The Database)
- [ ] **Total Count**: Open a raw TIX API response. Count all objects where `seat_yn == "1"`. This MUST match the `total_seats` field in Firestore exactly.
- [ ] **Occupancy Sum**: Verify that `Sold Seats` + `Available Seats` = `Total Seats`.
- [ ] **No Aisle Counting**: Ensure that items with `seat_yn == "0"` NEVER increment the `total_seats` counter.

### ✅ Phase 2: Spatial Accuracy (The Admin UI)
- [ ] **Alignment**: Look at a theatre with a "center aisle." Do the seats on the left and right align with the row headers correctly?
- [ ] **Gap Visibility**: Compare the Admin UI visualization with the official TIX.id app. Do the "blank spaces" appear in the same places?
- [ ] **Boundary Check**: Check the last seat of a row. Is it correctly numbered (e.g., A12), or did an aisle "eat" its ID?

### ✅ Phase 3: Historical Regression
- [ ] **Old Data**: Open a movie from 1 week ago. Does the seating layout still render correctly? (This ensures your change didn't break backward compatibility).
