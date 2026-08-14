# 🕵️ Forensic Analysis: Seating Performance & Delta Calculation

**Date:** April 14, 2026
**Subject:** Technical Audit of "Tickets Sold" and "Blocked Seats" Inaccuracies.
**Status:** 🚩 CRITICAL MISCALCULATION IDENTIFIED

---

## 1. The Data Pipeline Visualization

The following diagram traces how a single seat status flows through our system and where the "Ghost Sale" is born.

```text
TIME: 02:00 AM WIB (Baseline Scrape)
+-------------------------------------------------------+
| TIX ID API Response: [Row A, Seat 1] Status = 6       |
+-------------------------------------------------------+
           |
           v
+-------------------------------------------------------+
| SCRIP: scrape_initial_layouts.py                      |
| Logic: status in (5, 6) -> initial_unavailable += 1   |
| Store: Firestore -> { initial_unavailable: 1 }        |
+-------------------------------------------------------+

TIME: 06:30 PM WIB (JIT Scrape T-30)
+-------------------------------------------------------+
| TIX ID API Response: [Row A, Seat 1] Status = 6       |
+-------------------------------------------------------+
           |
           v
+-------------------------------------------------------+
| CLOUD FUNCTION: scraper/main.py                       |
| Logic: status in (5, 6) -> sold_seats += 1            |
| ERROR LINE 1186: audience_count = sold_seats          | <--- 🚩 THE BUG
| Result: { audience_count: 1 }                         | (Should be 0)
+-------------------------------------------------------+

TIME: 07:00 PM WIB (Sweeper Aggregation)
+-------------------------------------------------------+
| Aggregator: total_sold += audience_count (1)          |
| National Report: "1 Ticket Sold"                      | <--- 👻 GHOST SALE
+-------------------------------------------------------+
```

---

## 2. Visual Proof: The "Tri-Panel" Collision

The **Tri-Panel Audit** tool proves that our UI logic is smarter than our Backend logic. Here is a visualization of how the numbers and maps disagree.

### Scenario: A 4-Seat Row with 1 Static Block and 1 Real Sale

| Panel | Map Visualization | Numerical Count (Firestore) | Status Logic |
| :--- | :--- | :--- | :--- |
| **1. Baseline (2 AM)** | `[B] [.] [.] [.]` | `initial_unavailable: 1` | Correct |
| **2. Showtime (JIT)** | `[B] [S] [.] [.]` | `audience_count: 2` | **🚩 INFLATED** |
| **3. Digital Twin** | `[P] [P] [P] [P]` | `master_total_seats: 4` | Correct |

**Legend:**
*   `[B]` = Blocked (Red)
*   `[S]` = Sold (Green)
*   `[.]` = Available (Gray)
*   `[P]` = Physical Slot (Purple)

**The Conflict:**
*   **The Map (UI):** Calculates `Showtime - Baseline` and correctly identifies **1 Green Seat**.
*   **The Summary (Backend):** Simply counts all non-gray seats and reports **2 Tickets Sold**.

---

## 3. Mathematical Discrepancies

Our aggregation logic currently uses two different formulas, leading to the "Disappearing Occupancy" bug on the dashboard.

| Metric | Current Backend Formula | Formula Impact |
| :--- | :--- | :--- |
| **Daily Occupancy** | `Average(occupancy_pct)` | **High Distortion.** A small studio at 100% outweighs a massive IMAX at 10%. |
| **All-Time Occupancy** | `Sum(Sold) / Sum(Total)` | **Accurate.** Weighted average reflects true asset monetization. |

---

## 4. Remediation Strategy

To fix this systemically, we must implement **Atomic Delta Processing**.

### Phase A: Scraper Logic Update
```python
# PROPOSED CHANGE in backend/functions/scraper/main.py
current_snap = doc_ref.get()
initial_blocked = current_snap.get("initial_unavailable") or 0

# True Delta: Subtract what was already blocked before sales started
audience_count = max(0, sold_seats - initial_blocked)
```

### Phase B: Denominator Alignment
We must force the **Physical Registry (V3.3)** to be the source of truth for "Total Seats" in every calculation.
*   If `master_total_seats` exists, it MUST override the API's `total_seats` in the aggregation denominator.

### Phase C: Historical Recovery
We will deploy a CLI script to "Re-Calculate the Truth":
1.  Iterate through all showtimes for the last 14 days.
2.  Perform the `sold_seats - initial_unavailable` subtraction.
3.  Update the `audience_count` and `audience_pct` fields.
4.  Trigger a full re-sweep of Daily/All-Time stats.

---

## 5. Summary Table

| Problem | Root Cause | Fix |
| :--- | :--- | :--- |
| **Inflated Sales** | Ignoring 2AM Baseline | Implement `Current - Initial` Delta |
| **Math Mismatch** | Unweighted Averaging | Switch to `Total Sold / Total Capacity` |
| **Broken % Labels**| Dynamic API Capacities | Lock Denominator to Physical Master |
| **Visual Dissonance**| UI/API Logic Split | Unify on the Scraper Logic |

---
**Report compiled by Gemini CLI Engine.**
*Verified against codebase on 2026-04-14.*
