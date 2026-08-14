# CinePoint Box Office Backfill — Implementation Plan

## Scope

Backfill daily box office data from CinePoint's `/movies/top-box-office/daily/detail` endpoint
from **2024-01-01** to **present** (~860 days), storing every raw field in Firestore.

---

## 1. Domain Model

### 1.1 Raw API Response (per movie per day)

This is the exact shape returned by CinePoint. Every field must be stored as-is.

```typescript
/** Exactly what CinePoint returns per movie in the top-box-office response. */
interface CinePointBoxOfficeRaw {
  id: number;                           // CinePoint movie ID
  title: string;
  image_title: string | null;           // S3 poster URL
  movie_genre: string[];                // ["Horror", "Comedy"]
  duration: number;                     // minutes
  release_date: string;                 // "2026-04-16" (sometimes "2026-04-15T17:00:00.000Z")
  type: 'local' | 'international';
  admission: number;                    // daily admissions for this date
  total_admission: number;              // lifetime cumulative as of this date
  change: number;                       // day-over-day % change
  showtimes: number;                    // total showtime count
  score: number;                        // user rating 0-10
  rank: {
    current_rank: number;
    last_rank?: number;                 // absent for new entries
  };
}
```

### 1.2 Firestore Document: `cinepoint_box_office/{date}_{movieId}`

One document per movie per day. Stores the raw API response verbatim plus metadata.

```typescript
interface CinePointBoxOfficeDoc {
  // ── Composite key components (for querying) ──
  date: string;                         // "2026-05-01" (partition key)
  movie_id: number;                     // CinePoint movie ID

  // ── Raw CinePoint fields (stored as-is, never transformed) ──
  title: string;
  image_title: string | null;
  movie_genre: string[];
  duration: number;
  release_date: string;
  type: 'local' | 'international';
  admission: number;                    // daily
  total_admission: number;              // lifetime cumulative
  change: number;                       // day-over-day %
  showtimes: number;
  score: number;
  current_rank: number;
  last_rank: number | null;             // null if absent in API response

  // ── Metadata (our side) ──
  scraped_at: string;                   // ISO timestamp when we fetched this
  batch_id: string;                     // which scrape run produced this
}
```

**Document ID**: `{date}_{movieId}` — e.g. `"2026-05-01_3687"`
- Deterministic: same doc ID for same date+movie → natural deduplication
- Updatable: re-scraping a day just overwrites existing docs

### 1.3 Firestore Document: `cinepoint_bo_sync_meta/current`

Single document tracking sync state.

```typescript
interface CinePointBOSyncMeta {
  id: 'current';
  status: 'idle' | 'running' | 'paused' | 'complete' | 'error';
  date_start: string;                   // "2024-01-01" — beginning of range
  date_end: string;                     // today — end of range
  last_scraped_date: string | null;     // resume checkpoint
  dates_scraped: number;
  dates_skipped: number;                // days with 0 movies (e.g. future dates)
  docs_written: number;
  started_at: string | null;
  completed_at: string | null;
  error_message: string | null;
  batch_id: string;                     // UUID for this run
}
```

### 1.4 Side Effect: Update `cinepoint_movies` Catalog

On each scrape day, if a movie isn't in `cinepoint_movies` yet, create a stub.
If it exists, update with latest snapshot data:

```typescript
// Fields to update on existing cinepoint_movies docs:
{
  latest_admission: number;             // from most recent day's data
  latest_total_admission: number;
  latest_showtimes: number;
  latest_score: number;
  latest_rank: number | null;
  latest_boxoffice_date: string;        // "2026-05-06"
}
```

This is a **denormalized cache** — the source of truth is always `cinepoint_box_office`.

---

## 2. Firestore Collection Summary

| Collection | Doc ID | Purpose | Est. Count |
|---|---|---|---|
| `cinepoint_box_office` | `{date}_{movieId}` | Raw daily box office per movie | ~25,000 (860d × ~30 avg) |
| `cinepoint_bo_sync_meta` | `current` | Sync state checkpoint | 1 |
| `cinepoint_movies` | `{movieId}` | Catalog (updated as side effect) | ~4,000 (existing) |

**Indexing**: Firestore auto-indexes `date` and `movie_id` as top-level fields.
For compound queries (e.g. "all dates for movie X"), we may need:
- Composite index: `date` ASC, `movie_id` ASC
- Composite index: `movie_id` ASC, `date` ASC

These will be auto-created by Firestore on first query attempt.

---

## 3. Scraper Design

### 3.1 Script: `admin/scripts/scrape-cinepoint-backfill.ts`

Standalone TypeScript script. Run by the user manually.

```
Usage:
  npx tsx scripts/scrape-cinepoint-backfill.ts [--from 2024-01-01] [--to 2026-05-08] [--delay 3000] [--resume]
```

### 3.2 Politeness Rules

| Rule | Value | Rationale |
|---|---|---|
| Inter-request delay | **5 seconds** (not 3) | Full backfill = ~860 requests. 5s = 72 min. Tolerable. |
| Rate limit backoff | **30 seconds** on 429 | Generous cool-down to avoid getting IP-banned |
| Max retries per date | **3** | Then skip and log |
| Retry delay | **10 seconds** | Between retries |
| Request timeout | **15 seconds** | Abort stuck requests |
| No parallel requests | Sequential only | One request at a time |
| User-Agent | Include a descriptive one | `CineRadar-Bot/1.0 (research)` |
| Total daily limit | **None** (we're polite enough) | At 5s/req, 860 req = 72 min, well within reason |

### 3.3 Resume Mechanism

- Before each date: check if `cinepoint_bo_sync_meta.last_scraped_date >= date`
- If yes, skip (already scraped)
- After each successful date: write checkpoint
- `--resume` flag: automatically picks up from last checkpoint
- Can also `--from` to override start date

### 3.4 Algorithm (pseudocode)

```
1. Parse args (--from, --to, --delay, --resume)
2. Load sync meta from Firestore
3. Determine date range:
   a. If --resume: start from meta.last_scraped_date + 1
   b. Else: start from --from (default 2024-01-01)
   c. End: --to (default today)
4. Generate date list [start..end]
5. Filter: skip dates where we already have data (query Firestore for any doc with that date)
6. For each date:
   a. GET /movies/top-box-office/daily/detail?date_start={d}&date_end={d}&type=all&limit=100&sort=admission&order=desc
   b. Handle pagination: if total > limit, fetch pages 1..N
   c. For each movie:
      - Build CinePointBoxOfficeDoc
      - Upsert into cinepoint_box_office (doc ID: {date}_{movieId})
      - Upsert stub/update into cinepoint_movies
   d. Update sync meta checkpoint
   e. Log progress: [n/total] date: X movies, Y admissions
   f. Sleep(delay)
   g. On 429: sleep(30000), retry up to 3 times
7. Final: update sync meta status = complete
```

### 3.5 Firestore Write Strategy

Batch writes for each day (all movies in a day = 1 batch).

```typescript
// Firestore REST API batch write
// Up to 500 docs per batch (we'll have ~15-50 per day, well within limit)
const batch = movies.map(m => ({
  write: {
    update: {
      name: `projects/${PROJECT}/databases/(default)/documents/cinepoint_box_office/${date}_${m.id}`,
      fields: { /* ... */ }
    },
    // Use update with upsert semantics (createIfMissing)
    currentDocument: { exists: false } // or just always update
  }
}));
```

Actually: use individual `updateDocument` with create fallback (same pattern as existing catalog sync).

### 3.6 Time Estimates

| Scenario | Days | Delay | Total Time |
|---|---|---|---|
| Full backfill (2024-01-01 → today) | ~860 | 5s | **~72 min** |
| Resume from checkpoint (partial) | varies | 5s | depends |
| Incremental daily (1-2 days) | 2 | 5s | **~10 sec** |

---

## 4. Types File Changes

Add to `admin/src/features/competitors/types.ts`:

```typescript
// ─── CinePoint Box Office (Daily) ────────────────────────────

export const CINEPOINT_BOX_OFFICE = 'cinepoint_box_office';
export const CINEPOINT_BO_SYNC_META = 'cinepoint_bo_sync_meta';

export interface CinePointBoxOfficeDoc {
  date: string;
  movie_id: number;
  title: string;
  image_title: string | null;
  movie_genre: string[];
  duration: number;
  release_date: string;
  type: CinePointMovieType;
  admission: number;
  total_admission: number;
  change: number;
  showtimes: number;
  score: number;
  current_rank: number;
  last_rank: number | null;
  scraped_at: string;
  batch_id: string;
}

export interface CinePointBOSyncMeta {
  id: 'current';
  status: 'idle' | 'running' | 'paused' | 'complete' | 'error';
  date_start: string;
  date_end: string;
  last_scraped_date: string | null;
  dates_scraped: number;
  dates_skipped: number;
  docs_written: number;
  started_at: string | null;
  completed_at: string | null;
  error_message: string | null;
  batch_id: string;
}
```

Update `CinePointMovie` with optional box office cache fields:

```typescript
export interface CinePointMovie {
  // ... existing fields ...
  
  // ── Denormalized latest box office snapshot ──
  latest_admission?: number | null;
  latest_total_admission?: number | null;
  latest_showtimes?: number | null;
  latest_score?: number | null;
  latest_rank?: number | null;
  latest_boxoffice_date?: string | null;
}
```

---

## 5. File Structure

```
admin/
  scripts/
    scrape-cinepoint-backfill.ts    ← NEW: the scraper script
  src/
    features/competitors/
      types.ts                       ← MODIFIED: add box office types
    app/
      api/competitors/cinepoint/
        boxoffice/
          route.ts                   ← NEW: GET endpoint to query stored data
        pilot-data/
          route.ts                   ← MODIFIED: read from Firestore instead of JSON
        pilot-scrape/
          route.ts                   ← KEEP: useful for quick browser-based scrape
      competitors/cinepoint/
        insights/
          page.tsx                   ← MODIFIED: read from Firestore API
```

---

## 6. SOLID Principles Applied

### Single Responsibility
- `scrape-cinepoint-backfill.ts` — **only** scrapes and writes to Firestore
- `boxoffice/route.ts` — **only** reads and serves stored data
- `CinePointBoxOfficeDoc` — raw data, no business logic
- `CinePointMovie` updates — separate concern from box office writes

### Open/Closed
- The scraper writes raw data. New analytics are built on top of stored data (queries), not by modifying the scraper.
- Adding weekly/monthly aggregations = new read endpoints, zero scraper changes.

### Liskov Substitution
- `CinePointBoxOfficeDoc` stores the raw API response fields. Any consumer expecting "box office data" can work with this shape.

### Interface Segregation
- `CinePointBoxOfficeDoc` — the raw daily record (what the scraper writes)
- `CinePointBOSyncMeta` — the sync state (what the checkpoint needs)
- `CinePointMovie` — the catalog record (what the matcher needs)
- Each interface has only the fields its consumer needs.

### Dependency Inversion
- The scraper depends on Firestore's REST client abstraction (`firestoreRestClient`), not Firestore directly.
- The insights page depends on the API endpoint (`/api/.../boxoffice`), not Firestore directly.
- The API endpoint depends on the Firestore client, not on the scraper.

---

## 7. Backfill Execution Plan

### Pre-flight Checklist
1. Deploy types changes to `types.ts`
2. Ensure Firestore collections don't have conflicting security rules
3. Run scraper: `cd admin && npx tsx scripts/scrape-cinepoint-backfill.ts --from 2024-01-01 --resume`
4. Monitor console output for errors
5. If interrupted: re-run with `--resume` to pick up from checkpoint

### Post-backfill
1. Update `pilot-data/route.ts` to read from Firestore instead of local JSON
2. Update insights page to use the Firestore-backed endpoint
3. Verify data integrity: spot-check a few dates against known values
4. Set up incremental daily sync (future: scheduled or manual trigger)

---

## 8. Data Integrity Notes

### Idempotency
- Doc ID = `{date}_{movieId}` → re-scraping the same day overwrites existing data
- Safe to run multiple times, safe to resume after interruption

### Known edge cases
- **May 7 returns 0 movies**: CinePoint may not have processed today's data yet. The scraper should still write the checkpoint but log 0 movies.
- **Date range snap**: When `date_start ≠ date_end`, the API snaps to weekly boundaries. The scraper MUST use `date_start === date_end` for daily granularity.
- **`release_date` format varies**: Sometimes `"2026-04-16"`, sometimes `"2026-04-15T17:00:00.000Z"`. Store as-is.
- **`last_rank` absent**: For new entries or rank 1. Store as `null`.
- **Pagination**: Most days have 13-18 movies, well under limit=100. But some dates (holidays, new releases) could exceed 100. The scraper must handle multi-page responses.
