# Plan: V1 → V2 Migration & V1 Sunset

> **Status**: Phases 2-5 Complete (Code Only)  
> **Date**: 2026-04-30  
> **Updated**: 2026-04-30  
> **Goal**: Migrate all remaining V1 data to V2 collections, then remove all V1 dual-write and fallback code, and finally delete V1 Firestore collections.

---

## 1. Background: The Dual-ID Problem

TIX.id provides **two distinct identifiers** for a film:

| ID Type | Name | Example | Mutability | Used For |
|---------|------|---------|------------|----------|
| **Schedule ID** | `id` / `schedule_id` | `2021094806305984512` | **Changes** when movie moves between cinema chains | Showtime queries, V1 document keys |
| **Metadata ID** | `movie_id` / `metadata_id` | `2021094805467123712` | **Immutable** | Movie entity, V2 document keys |

The same physical movie (e.g., "KOKUHO") can have **multiple schedule IDs** across different cinema chains but only **one metadata ID**. V1 used schedule_id as the document key, causing fragmentation. V2 uses the immutable metadata_id, consolidating all schedule IDs under one document.

---

## 2. Current State: What Exists Today

### 2.1 Firestore Collections

| Collection | Schema | Status |
|------------|--------|--------|
| `schedules/{date}/movies/{schedule_id}` | V1 — keyed by schedule_id | **Dual-write active** |
| `schedules_v2/{date}/movies/{metadata_id}` | V2 — keyed by metadata_id, contains `schedule_ids[]` | **Dual-write active** |
| `movie_performance/{schedule_id}/...` | V1 — keyed by schedule_id | **Dual-write active** |
| `movie_performance_v2/{metadata_id}/...` | V2 — keyed by metadata_id | **Dual-write active** |

### 2.2 Dual-Write Points (Both V1 + V2)

Every write location below writes to **both** V1 and V2 simultaneously:

| # | File | What It Writes | V1 Path | V2 Path |
|---|------|----------------|---------|---------|
| 1 | `infrastructure/core/tix_client.py` | Movie schedules | `schedules/{date}/movies/{schedule_id}` | `schedules_v2/{date}/movies/{metadata_id}` |
| 2 | `functions/scraper/main.py` → `save_snapshot()` | Showtime snapshots | `movie_performance/{schedule_id}/...` | `movie_performance_v2/{metadata_id}/...` |
| 3 | `functions/sweeper/main.py` → `aggregate_daily_stats()` | Daily aggregation | `movie_performance/{schedule_id}/days/{date}` | `movie_performance_v2/{metadata_id}/days/{date}` |
| 4 | `functions/sweeper/main.py` → `aggregate_all_time_stats()` | All-time aggregation | `movie_performance/{schedule_id}` | `movie_performance_v2/{metadata_id}` |
| 5 | `scripts/scrape_initial_layouts.py` → `save_initial_layout_async()` | Initial layouts | `movie_performance/{schedule_id}/...` | `movie_performance_v2/{metadata_id}/...` |
| 6 | `cli/movie_performance.py` → `initialize_performance_data()` | Performance init | `movie_performance/{schedule_id}/...` | `movie_performance_v2/{metadata_id}/...` |

### 2.3 V1-Only Read Points (No V2 Equivalent)

These are the **critical blockers** — code that only reads from V1 and has no V2 path:

| # | File | What It Reads | Collection | Why It's V1-Only |
|---|------|---------------|------------|------------------|
| 1 | **`web/.../MovieBrowser.tsx`** | Movie showtimes for public website | `schedules/{date}/movies/{schedule_id}` | Direct Firestore REST API call, hardcoded V1 path |
| 2 | **`admin/.../scraper/today/route.ts`** | Schedule counts for scraper dashboard | `schedules/{date}/movies` | Uses V1 `schedules/` directly |
| 3 | `cli/utils.py` → `load_movie_data_from_firestore()` | Movie data for CLI commands | `schedules/{date}/movies` | Only reads V1 |
| 4 | `cli/upload_schedules.py` → `upload_schedules_to_firestore()` | Manual schedule upload | `schedules/{date}/movies/{schedule_id}` | Only writes V1 (legacy tool) |
| 5 | `cli/movie_performance.py` → `scrape_movie_performance()` | Detailed schedule for a movie | `schedules/{date}/movies/{movie_id}` | Only reads V1 |
| 6 | `cli/movie_performance.py` → `initialize_performance_data()` | All movies for init | `schedules/{date}/movies` | Reads V1 for showtime counts |
| 7 | `scripts/post_process.py` → `load_schedules_as_movies()` | Post-processing after scrape | `schedules/{date}/movies` | Only reads V1 |

### 2.4 V2-First with V1 Fallback (Safe Pattern)

These already prefer V2 but fall back to V1 if V2 is empty:

| # | File | Pattern |
|---|------|---------|
| 1 | `functions/dispatcher/main.py` | Tries `schedules_v2` first, falls back to `schedules` |
| 2 | `functions/sweeper/main.py` | Tries `schedules_v2` first, falls back to `schedules`; tries `movie_performance_v2` first, falls back to `movie_performance` |
| 3 | `scripts/scrape_initial_layouts.py` | Tries `schedules_v2` first, falls back to `schedules`; tries `movie_performance_v2` first for checkpoints |
| 4 | `scripts/bootstrap_studio_v3.py` | Reads from `schedules_v2` and `movie_performance_v2` only — **already V2-only** |
| 5 | `scripts/discover_studios.py` | Reads from `schedules_v2` only — **already V2-only** |

### 2.5 Already V2-Only (Admin Frontend)

| # | File | Collection |
|---|------|------------|
| 1 | `admin/.../performance/route.ts` | `schedules_v2`, `movie_performance_v2` |
| 2 | `admin/.../performance/[metadataId]/route.ts` | `movie_performance_v2` |
| 3 | `admin/.../performance/[metadataId]/history/route.ts` | `movie_performance_v2` |
| 4 | `admin/.../performance/[metadataId]/days/[date]/route.ts` | `movie_performance_v2` |
| 5 | `admin/.../performance/[metadataId]/days/[date]/showtimes/[showtimeId]/route.ts` | `movie_performance_v2` |
| 6 | `admin/.../showtimes/[showtimeId]/raw/route.ts` | `movie_performance_v2` |
| 7 | `admin/.../compare/route.ts` | `movie_performance_v2`, `schedules_v2` |
| 8 | `admin/.../theatres/[id]/showtimes/route.ts` | `schedules_v2` |
| 9 | `admin/.../movies/route.ts` | `schedules_v2` |
| 10 | `admin/.../schedules/route.ts` | `schedules_v2` |
| 11 | `admin/.../details.py` → `--from-performance` | `movie_performance_v2` |

---

## 3. Migration Strategy

### Phase 1: Historical Data Backfill (One-Time Script)

Before we can remove V1, every historical document in V1 must have a corresponding V2 document. The daily pipeline has been dual-writing since V2 was introduced, so **recent dates should already have V2 data**. But older dates (before V2 was implemented) only exist in V1.

**We need a one-time backfill script that:**

1. **Scans all dates** in `schedules` (V1) that don't exist in `schedules_v2` (V2).
2. For each V1 movie document, **groups by `tix_metadata_id`** and creates a V2 document with `schedule_ids: [...]`.
3. Scans all dates in `movie_performance` (V1) and **copies showtime snapshots, daily stats** to `movie_performance_v2` keyed by `metadata_id`.

**Backfill logic for `schedules` → `schedules_v2`:**
```
For each date in V1:
  For each movie_doc in schedules/{date}/movies:
    metadata_id = movie_doc.tix_metadata_id
    schedule_id = movie_doc.movie_id (or doc.id)

    If metadata_id is null → SKIP (orphan, cannot migrate)

    Check if schedules_v2/{date}/movies/{metadata_id} exists:
      If YES → append schedule_id to schedule_ids[]
      If NO  → create new doc with schedule_ids: [schedule_id], copy all fields
```

**Backfill logic for `movie_performance` → `movie_performance_v2`:**
```
For each schedule_id in movie_performance:
  Read root doc → find metadata_id (may need cross-reference from schedules)

  For each date in days/:
    Copy daily stats doc → movie_performance_v2/{metadata_id}/days/{date}
    For each showtime in showtimes/:
      Copy snapshot doc → movie_performance_v2/{metadata_id}/days/{date}/showtimes/{showtime_id}
```

**Cross-reference challenge**: `movie_performance` docs are keyed by `schedule_id`, but we need `metadata_id` for V2. We can build a lookup map from `schedules/{date}/movies` where each doc has both `movie_id` (schedule_id) and `tix_metadata_id` (metadata_id).

### Phase 2: Update V1-Only Readers to V2

After the backfill, every V1-only reader must be updated to read from V2 instead:

| File | Change |
|------|--------|
| **`web/.../MovieBrowser.tsx`** | Change Firestore REST URL from `schedules/{date}/movies/{movieId}` to `schedules_v2/{date}/movies/{movieId}`. Note: the web app fetches schedules by `movieId` which in V1 was the schedule_id. In V2, the document ID is the metadata_id. The web app's main page (`page.tsx`) passes the movie's `id` field — we need to ensure it passes `tix_metadata_id` instead, or we add a lookup. **This is the most complex migration point.** |
| **`admin/.../scraper/today/route.ts`** | Change `schedules/${dateStr}/movies` to `schedules_v2/${dateStr}/movies`. Update parsing to handle V2 schema (`schedule_ids[]`, document ID = metadata_id). |
| `cli/utils.py` | Change `db.collection(SCHEDULES)` to `db.collection(SCHEDULES_V2)`. Update doc parsing for V2 schema. |
| `cli/upload_schedules.py` | **Delete this file.** It's a legacy manual upload tool that only writes V1. The API scraper (`tix_client.py`) handles all uploads now. |
| `cli/movie_performance.py` → `scrape_movie_performance()` | Change schedule read from `SCHEDULES` to `SCHEDULES_V2`. |
| `cli/movie_performance.py` → `initialize_performance_data()` | Change schedule read from `SCHEDULES` to `SCHEDULES_V2`. |
| `scripts/post_process.py` → `load_schedules_as_movies()` | Change `db.collection(SCHEDULES)` to `db.collection(SCHEDULES_V2)`. Adjust V2 schema parsing (document ID = metadata_id, schedule_ids in array). |

### Phase 3: Remove Dual-Writes (V1 Write Removal)

After all readers are on V2, remove V1 writes from every dual-write location:

| File | What to Remove |
|------|----------------|
| `infrastructure/core/tix_client.py` → `upload_to_firestore()` | Remove the V1 `schedules/{date}/movies/{schedule_id}` write block. Keep only the V2 `schedules_v2` write. |
| `functions/scraper/main.py` → `save_snapshot()` | Remove the V1 `movie_performance/{movie_id}/...` write. Keep only V2 `movie_performance_v2/{metadata_id}/...`. |
| `functions/sweeper/main.py` → `aggregate_daily_stats()` | Remove V1 daily stats write. Keep V2 only. |
| `functions/sweeper/main.py` → `aggregate_all_time_stats()` | Remove V1 root aggregation write. Keep V2 only. |
| `scripts/scrape_initial_layouts.py` → `save_initial_layout_async()` | Remove V1 write. Keep V2 only. |
| `cli/movie_performance.py` → `initialize_performance_data()` | Remove V1 init. Keep V2 only. |

### Phase 4: Remove V1 Fallback Logic

After dual-writes are removed, the "V2-first with V1 fallback" pattern is no longer needed:

| File | Change |
|------|--------|
| `functions/dispatcher/main.py` | Remove V1 fallback. Read only from `schedules_v2`. |
| `functions/sweeper/main.py` | Remove all V1 fallbacks. Read only from `schedules_v2` and `movie_performance_v2`. |
| `scripts/scrape_initial_layouts.py` | Remove V1 fallbacks in both schedule loading and checkpoint checking. |

### Phase 5: Clean Up Constants & Imports

| File | Change |
|------|--------|
| `infrastructure/firestore_collections.py` | Remove `SCHEDULES` and `MOVIE_PERFORMANCE` constants. Remove V1 comments from docstring. |
| All files | Remove imports of `SCHEDULES`, `MOVIE_PERFORMANCE`. |

### Phase 6: Delete V1 Firestore Collections

**⚠️ This is the point of no return. Only execute after Phase 1-5 are verified in production for at least 1 week.**

Delete these collections:
- `schedules/` (entire collection tree)
- `movie_performance/` (entire collection tree)

Keep:
- `schedules_v2/` → rename to `schedules/` (optional, but cleaner)
- `movie_performance_v2/` → rename to `movie_performance/` (optional, but cleaner)

**Note on renaming**: Firestore doesn't support collection renaming natively. To "rename," we'd need to copy all data from `_v2` to the base name and then delete `_v2`. This is optional — we can just keep the `_v2` names permanently if desired.

---

## 4. Detailed Analysis: The Hard Problem — Web App (`MovieBrowser.tsx`)

The public web app (`web/`) reads schedules directly from Firestore via the REST API:

```typescript
// Current (V1):
const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/schedules/${date}/movies/${movieId}`;
```

**Problem**: In V1, `movieId` = schedule_id. In V2, the document ID = metadata_id. The web app's movie list comes from `snapshots/latest` where movies are listed with `id` (schedule_id) and `tix_metadata_id` (metadata_id).

**Solution options:**

| Option | Complexity | Risk |
|--------|-----------|------|
| **A. Pass metadata_id from the snapshot** | Medium — need to update the web app's data flow to use `tix_metadata_id` as the lookup key | Low — metadata_id is always available in snapshots |
| **B. Keep a lightweight lookup map** | High — maintain a mapping collection | Medium — another thing to keep in sync |
| **C. Query V2 by field instead of doc ID** | Low — use Firestore `where` query on `schedule_ids` array | Medium — `array_contains` queries have limitations |

**Recommended: Option A.** The snapshot already contains `tix_metadata_id` for every movie. The web app just needs to:
1. Use `tix_metadata_id` (not `id`/`schedule_id`) as the key when fetching schedule details.
2. Change the Firestore REST URL to `schedules_v2/{date}/movies/{tix_metadata_id}`.

This is the cleanest approach and requires only frontend changes.

---

## 5. Validation Plan

### 5.1 Phase 1 Validation (After Backfill)

Run verification queries to ensure data parity:

```
For each date from V2 launch date to today:
  V1 movie count in schedules/{date}/movies == V2 movie count in schedules_v2/{date}/movies
  V1 showtime count == V2 showtime count
```

Also spot-check individual movies:
- Find a movie in V1 by schedule_id
- Verify the same movie exists in V2 by metadata_id
- Verify all showtimes, daily stats, and snapshots are present

### 5.2 Phase 2 Validation (After Reader Migration)

- **Web app**: Load the public site, navigate to any movie, verify showtimes display correctly. Check historical dates (before V2 launch).
- **Admin dashboard**: Check the scraper dashboard, performance pages, schedule viewer, comparison tool.
- **CLI tools**: Run `movie-details --from-performance`, verify it lists correct movies.

### 5.3 Phase 3-4 Validation (After Write Removal)

- Monitor for 1 week in production.
- Verify no V1 collection writes appear in Firestore usage metrics.
- Verify all JIT pipeline outputs (dispatcher → scraper → sweeper) write to V2 only.
- Check that `movie_performance_v2` daily data continues to populate correctly.

### 5.4 Phase 6 Validation (Before V1 Deletion)

- Confirm zero V1 references in codebase: `grep -r "movie_performance[^_]" --include="*.py" --include="*.ts" --include="*.tsx"`
- Confirm zero V1 references: `grep -r '"schedules"' --include="*.py" --include="*.ts" --include="*.tsx"` (should only find `schedules_v2`)
- Take a final Firestore export backup of V1 collections before deletion.

---

## 6. Execution Order & Risk Matrix

| Phase | Estimated Effort | Risk | Rollback |
|-------|-----------------|------|----------|
| **Phase 1**: Backfill script | 2-3 hours (script + run) | Low — read-only copy | Delete V2 docs, re-run |
| **Phase 2**: Update V1-only readers | 3-4 hours (7 files) | **Medium** — web app is customer-facing | Revert commits |
| **Phase 3**: Remove V1 writes | 2-3 hours (6 files) | **Medium** — pipeline stops writing V1 | Revert commits |
| **Phase 4**: Remove fallback logic | 1-2 hours (3 files) | Low — cleanup only | Revert commits |
| **Phase 5**: Clean up constants | 30 min | Very Low | Revert commits |
| **Phase 6**: Delete V1 collections | 30 min + 1 week monitoring | **High** — irreversible | Restore from backup |

**Recommended approach**: Execute Phases 1-3 together in one PR. Deploy. Monitor for 1 week. Then execute Phases 4-5 in a cleanup PR. Phase 6 after another week of clean monitoring.

---

## 7. Files Inventory

### Files to Create
| File | Purpose |
|------|---------|
| `backend/scripts/backfill_v1_to_v2.py` | One-time backfill script for historical data |

### Files to Modify (Phase 2 — Reader Migration)
| File | Change Summary |
|------|----------------|
| `web/src/components/movie/MovieBrowser.tsx` | Switch Firestore URL to `schedules_v2`, use `tix_metadata_id` as doc key |
| `web/src/app/page.tsx` | Pass `tix_metadata_id` instead of `id` to schedule fetcher |
| `admin/src/app/api/scraper/today/route.ts` | Switch to `schedules_v2` |
| `backend/cli/utils.py` | Switch to `SCHEDULES_V2` |
| `backend/cli/movie_performance.py` | Switch schedule reads to `SCHEDULES_V2` |
| `backend/scripts/post_process.py` | Switch to `SCHEDULES_V2`, adjust schema parsing |

### Files to Modify (Phase 3 — Remove V1 Writes)
| File | Change Summary |
|------|----------------|
| `backend/infrastructure/core/tix_client.py` | Remove V1 schedule upload block |
| `backend/functions/scraper/main.py` | Remove V1 snapshot write |
| `backend/functions/sweeper/main.py` | Remove V1 aggregation writes |
| `backend/scripts/scrape_initial_layouts.py` | Remove V1 layout write |
| `backend/cli/movie_performance.py` | Remove V1 performance init write |

### Files to Modify (Phase 4 — Remove Fallbacks)
| File | Change Summary |
|------|----------------|
| `backend/functions/dispatcher/main.py` | Remove V1 fallback, read V2 only |
| `backend/functions/sweeper/main.py` | Remove V1 fallbacks |
| `backend/scripts/scrape_initial_layouts.py` | Remove V1 fallbacks |

### Files to Delete
| File | Reason |
|------|--------|
| `backend/cli/upload_schedules.py` | Legacy V1-only upload tool, superseded by `tix_client.py` |

### Files to Clean Up (Phase 5)
| File | Change Summary |
|------|----------------|
| `backend/infrastructure/firestore_collections.py` | Remove `SCHEDULES`, `MOVIE_PERFORMANCE` constants |

---

## 8. What NOT to Change

The following are **not** part of this migration — they already use V2 or are collection-agnostic:

- `snapshots/` collection — collection-agnostic, contains movie summaries
- `theatres/` collection — collection-agnostic, keyed by theatre_id
- `auth_tokens/` collection — collection-agnostic
- `scraper_logs/` collection — collection-agnostic
- `movies/` root collection — already keyed by metadata_id
- `admin/` frontend — already V2-only (all 11 routes confirmed)
- `backend/scripts/bootstrap_studio_v3.py` — already V2-only
- `backend/scripts/discover_studios.py` — already V2-only
- `backend/cli/commands/details.py` — already reads from `movie_performance_v2`

---

## 9. Open Questions

1. **How far back does V2 data go?** If V2 dual-writing started recently, the backfill needs to cover all historical dates with V1 data. We should query Firestore to find the earliest date in both V1 and V2 collections to determine the gap.

2. **Should we rename `_v2` collections?** After V1 deletion, keeping `_v2` suffixes is technically fine but aesthetically unpleasant. Renaming requires a data copy operation. We can decide this later.

3. **`movie_performance` V1 has some movies without `metadata_id`.** The backfill script needs to handle orphan V1 docs where `tix_metadata_id` is null — these cannot be migrated and should be logged for manual review.

4. **Web app cache invalidation.** The web app may cache movie IDs in the browser. After switching from schedule_id to metadata_id, users with cached pages may get 404s. We should ensure the web app always fetches fresh snapshot data.
