# CineRadar GCP Cost Optimization & Schema Fix Plan

**Date:** June 10, 2026  
**Status:** PROPOSED

---

## 1. Problem Statement
Current GCP operations are generating approximately **IDR 50,000/day** (~$3 USD/day) in charges, leading to project suspension. The costs are distributed as follows:

1.  **IDR 40,000/day (App Engine/Firestore):** Driven by ~1.5 million Firestore writes/day. Every JIT Scraper job performs 8+ lifecycle writes to track progress (Started → Token → API → Validated → Saved).
2.  **IDR 10,000/day (Cloud Run):** Driven by 150,000 Cloud Function executions/day.
3.  **Critical Failure:** Recent logs show `🚨 CRITICAL: Schema validation failed: seat_map is not a list`. The system is spending money on 100% failing scrapes.

---

## 2. Proposed Mitigation Strategy

### Phase 1: Silent Scraper (Cost Reduction: ~80%)
**Action:** Refactor `JobLogger` in `backend/functions/scraper/main.py`.
*   **Current State:** Every checkpoint (8 per job) writes to a unique document in `scraper_logs`.
*   **New State:** All checkpoints will use `logger.info()` or `logger.error()`. Standard logs are free up to 10GB/month and easier to debug via Log Explorer.
*   **Risk:** The Admin UI's "Dispatch Timeline" and real-time job tracking will stop showing progress for individual jobs. However, the final data snapshots and error reports will remain intact.

### Phase 2: V1 Sunset (Cost Reduction: ~10%)
**Action:** Remove legacy dual-writes in `save_snapshot`.
*   **Current State:** Data is saved to both `movie_performance` (V1) and `movie_performance_v2`.
*   **New State:** Write only to `movie_performance_v2`.
*   **Risk:** None. The Admin UI has already moved to V2.

### Phase 3: Schema Fix (Restoring Utility)
**Action:** Update `validate_api_response` and `calculate_occupancy` to handle the new TIX.id API format.
*   **Observation:** The API likely moved from a flat list to a nested structure (e.g., `seat_layout` instead of `seat_map`).
*   **Fix:** Adjust extraction logic to handle the new field structure while maintaining backward compatibility where possible.

---

## 3. Detailed Execution Plan

### Step 1: Refactor `JobLogger`
Replace the `self.job_ref.set(...)` call in `_update` with a consolidated log aggregator.
```python
# Before
def _update(self, data: dict[str, Any]) -> None:
    self.job_ref.set(data, merge=True)

# After
def _update(self, data: dict[str, Any]) -> None:
    # Log to Cloud Logging instead of Firestore
    logger.info(f"[JOB_LOG][{self.showtime_id}] {json.dumps(data)}")
```

### Step 2: Fix Schema Validation
Investigate the `raw_api_response` structure (once billing is restored) and update the `seat_map` extraction logic in `main.py`.

### Step 3: Remove V1 Writes
Delete lines related to `doc_ref` (V1) in `save_snapshot`, keeping only `doc_ref_v2`.

---

## 4. Expected Outcomes
*   **App Engine Charges:** Should drop to near zero (IDR <1,000/day).
*   **Cloud Run Charges:** Will persist but now provide actual, successful data.
*   **Project Health:** Prevents future automated suspensions and allows the trial/low-limit billing account to last indefinitely.

---

## 5. Verification Plan
1.  **Dry Run:** Deploy the scraper function to a `test` prefix or use manual CLI triggers to verify logs appear in GCP Log Explorer.
2.  **Dashboard Check:** Monitor the GCP Billing "Cost Table" 24–48 hours after deployment to confirm the App Engine charge drops.
3.  **Data Integrity:** Verify that `movie_performance_v2` continues to receive updates for new showtimes.
