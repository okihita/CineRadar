# Safe V1 to V2 Performance Migration Guide

This guide outlines a meticulous, step-by-step approach to transition from the legacy `movie_performance` (V1) architecture to the standardized `movie_performance_v2` (V2) architecture.

## 1. Pre-Migration Checklist
Before moving any data, we must ensure the V2 environment is stable.

- [ ] **Dual-Writing Active**: Verify that the `sweeper` Cloud Function is successfully writing today's results to both V1 and V2 collections.
- [ ] **Metadata Integrity**: Ensure the `movies` collection contains all `metadata_id` entries referenced in V2.
- [ ] **UI Parity**: Verify that `/performances_v2` shows the same stats (Total Sold, Occupancy, etc.) as `/performances` for the same date.
- [ ] **Initialization**: Ensure the `movie_performance.py --init-only` script is running daily to populate V2 `total_showtimes`.

---

## 2. Historical Data Backfill (V1 → V2)

Since V1 is keyed by `schedule_id` and V2 is keyed by `metadata_id`, we cannot simply copy documents. We must resolve the identity of each movie during the backfill.

### Step 2.1: Develop the Backfill Script
Create a script (e.g., `backend/scripts/migrate_v1_to_v2.py`) that performs the following logic for each movie in V1:

1. **Scan V1 Root**: Iterate through documents in `movie_performance`.
2. **Resolve Metadata ID**:
   - Check if the V1 doc has `tix_metadata_id`.
   - If not, look up the movie in the `movies` collection by title/id to find the correct `metadata_id`.
3. **Migrate Days**:
   - For each document in `movie_performance/{schedule_id}/days/{date}`:
   - Copy the stats to `movie_performance_v2/{metadata_id}/days/{date}`.
4. **Migrate Showtimes**:
   - For each document in `movie_performance/{schedule_id}/days/{date}/showtimes/{st_id}`:
   - Copy to `movie_performance_v2/{metadata_id}/days/{date}/showtimes/{st_id}`.
   - *Optimization: Only migrate the last 30 days of showtimes to save on Firestore operations if storage costs are a concern.*

### Step 2.2: Dry Run & Sample Validation
1. **Run with `--dry-run`**: Log exactly how many documents will be moved without writing to Firestore.
2. **Sample Migration**: Pick 3 specific movies (one active, one archived, one with many showtimes) and migrate only those.
3. **Manual Verification**: Use the Firebase Console to compare the `total_sold` and `total_seats` in the new V2 documents against the V1 originals.

### Step 2.3: Full Execution
Run the script in batches (e.g., 10 movies at a time) to avoid hitting Firestore rate limits or long-running script timeouts.

---

## 3. UI Transition (The Cutover)

Once the historical data is backfilled and today's data is dual-writing correctly:

1. **Update Sidebar**: Change the "Performance Intelligence" link in `Sidebar.tsx` to point to `/performances_v2`.
2. **Deprecate V1 Link**: Move the V1 link to a "Legacy/Debug" section or remove it entirely.
3. **Monitor**: Watch for 48-72 hours to ensure users are not reporting missing data or rendering errors in the V2 views.

---

## 4. Manual Decommissioning (V1 Deletion)

**CRITICAL: Do not use automated scripts or AI to delete V1 data.** Deletion must be done manually via the Firebase CLI or Console to ensure no accidental data loss in other collections.

### Step 4.1: Disable V1 Writes
1. **Update Sweeper**: Remove the V1 write block from `backend/functions/sweeper/main.py`.
2. **Update Scraper**: Remove the V1 write block from `backend/functions/scraper/main.py`.
3. **Update CLI**: Remove the V1 initialization logic from `backend/cli/movie_performance.py`.

### Step 4.2: Manual Deletion via Firebase CLI
Once writes are disabled and V2 is confirmed as the system of record, use the Firebase CLI to delete the collections. This is safer than the console for large collections as it handles recursive deletion of subcollections.

```bash
# Verify you are in the correct project
firebase use cineradar-prod

# Delete the legacy V1 collections
firebase firestore:delete movie_performance --recursive --yes
```

---

## 5. Code Cleanup
Finally, delete the redundant code to keep the repository clean:

1. Delete `admin/src/app/performances/`
2. Delete `admin/src/app/api/performance/`
3. Delete `admin/src/features/performances/` (keep `performances_v2` and optionally rename it back to `performances` after V1 is gone).
