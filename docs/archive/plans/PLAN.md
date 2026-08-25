# CinePoint Daily Box Office Backfill Plan

## Goal

Backfill daily box office data (admissions, showtimes, scores, rankings) for all CinePoint movies using the **Top Box Office Daily** endpoint. No auth required. Date-by-date iteration.

---

## The Endpoint

```
GET /movies/top-box-office/daily/detail
  ?date_start=YYYY-MM-DD
  &date_end=YYYY-MM-DD       (same as start = daily granularity)
  &type=all
  &limit=100
  &order=desc
  &sort=admission
  &page=0
```

**No auth. No subscription. No Bearer token.** Just `x-app-request: true`.

Returns per movie: `admission` (daily), `total_admission` (lifetime), `showtimes`, `score`, `change`, `rank`, plus all catalog fields.

### Historical coverage

From **early 2023** to present. ~14-50 movies per day. Data available for ~900+ days.

---

## New Firestore Collections

### `cinepoint_daily_boxoffice`

One document per movie per date. Primary data store.

```typescript
export interface CinePointDailyBoxOffice {
  id: string;                // "{date}_{movie_id}" e.g. "2026-05-06_3965"
  date: string;              // "2026-05-06"
  movie_id: number;          // CinePoint movie ID
  title: string;             // denormalized for query convenience
  type: CinePointMovieType;  // "local" | "international"

  // ── Daily metrics ──
  admission: number;         // daily admissions for this date
  total_admission: number;   // lifetime cumulative as of this date
  showtimes: number;         // total showtime count
  score: number;             // user rating
  change: number;            // day-over-day % change
  current_rank: number;      // daily rank
  last_rank?: number;        // previous rank (absent if new entry)

  // ── Catalog fields (denormalized) ──
  movie_genre: string[];
  duration: number;
  release_date: string;

  scraped_at: string;        // ISO timestamp
}
```

### `cinepoint_boxoffice_meta`

Sync state — one document:

```typescript
export interface CinePointBoxOfficeMeta {
  id: string;                // always "current"
  status: 'idle' | 'running' | 'paused' | 'complete' | 'error';
  last_scraped_date: string; // "2026-05-06" — resume checkpoint
  earliest_date: string;     // "2023-01-01" — start of backfill range
  target_date: string;       // "2026-05-08" — end (today)
  dates_scraped: number;     // running count
  total_dates: number;       // estimated total days in range
  movies_saved: number;      // total movie-date records saved
  started_at: string | null;
  completed_at: string | null;
  error_message: string | null;
}
```

### Update `cinepoint_movies` with latest snapshot

On each daily scrape, also update the movie's `cinepoint_movies` doc with the latest metrics:

```typescript
// Fields to update on cinepoint_movies from latest box office data
total_admission: number;     // latest lifetime total
showtimes: number;           // latest showtime count
score: number;               // latest user rating
last_boxoffice_date: string; // "2026-05-06"
```

---

## SSE Endpoint

```
POST /api/competitors/cinepoint/sync-boxoffice
Body: { date_start?: string, date_end?: string }
Response: SSE stream
```

**No token needed in body** — endpoint is unauthenticated.

### Query params (optional)

| Param | Default | Description |
|---|---|---|
| `date_start` | Meta's `last_scraped_date + 1` (resume) or `2023-01-01` | Start of backfill range |
| `date_end` | Today (`YYYY-MM-DD`) | End of range |

### Algorithm

```
1. Load or create meta doc
2. Determine date range:
   - start: date_start param, or resume from meta.last_scraped_date + 1
   - end: date_end param, or today
3. For each date in [start, end]:
   a. GET /movies/top-box-office/daily/detail?date_start={d}&date_end={d}&type=all&limit=100&sort=admission&order=desc
   b. If pagination.total > limit: fetch additional pages
   c. For each movie in response:
      - Upsert into cinepoint_daily_boxoffice (doc id: "{date}_{movie_id}")
      - Update cinepoint_movies doc with latest metrics (total_admission, score, etc.)
      - If movie not in cinepoint_movies: create stub (auto-discovery!)
   d. Update meta: last_scraped_date, dates_scraped, movies_saved
   e. Send SSE progress event
   f. 3s delay
4. Handle client disconnect → pause (resume from last_scraped_date)
5. Handle rate limit (429) → wait 10s, retry
```

### Auto-discovery

Movies appearing in box office data but not in `cinepoint_movies` are auto-created as stubs. This catches movies that might be missing from the directory endpoint or added after the last catalog sync.

---

## Time Estimate

| Range | Days | Requests | Time (3s delay) |
|---|---|---|---|
| Last 30 days | 30 | 30 | **~1.5 min** |
| Last 90 days | 90 | 90 | **~4.5 min** |
| Last 365 days | 365 | 365 | **~18 min** |
| Full history (2023-01-01) | ~860 | ~860 | **~43 min** |

Compare to old plan: 4,000 movies × 3s = 3.3 hours. **This is 5× faster** and gives DAILY admissions instead of just lifetime totals.

---

## Implementation Order

```
1. Types
   - CinePointDailyBoxOffice
   - CinePointBoxOfficeMeta
   - Collection constants
   - Update CinePointMovie with optional box office fields

2. SSE sync endpoint
   - POST /api/competitors/cinepoint/sync-boxoffice
   - Date iteration, pagination, upsert, auto-discovery
   - Resume from checkpoint, rate limit handling

3. Browse endpoint
   - GET /api/competitors/cinepoint/boxoffice?date=YYYY-MM-DD
   - Returns daily box office data for a given date
   - With movie-level detail

4. UI
   - Add "Sync Box Office" button to /competitors/cinepoint page
   - Show daily box office table/grid view
   - SSE progress indicator (reuse existing pattern from catalog sync)

5. Ongoing sync (future)
   - Scheduled daily sync (cron job or manual trigger)
   - Only scrapes yesterday + today (2 requests, ~6s)
```

---

## Why This Replaces the Old Plan

| Old Plan | New Plan |
|---|---|
| Phase 1: `/movies/detail` for 4,000 movies (3.3h, requires subscription) | ❌ Eliminated — box office has `total_admission`, `score`, `showtimes` |
| Phase 2: `/daily-showtime/graph` per movie (showtimes only, needs token) | ❌ Eliminated — box office has daily admissions + showtimes |
| Phase 3: `/compare-movies/graph/admission` weekly (needs token) | ❌ Eliminated — box office has daily granularity |
| Token refresh infrastructure | ❌ Eliminated — no auth needed |
| Subscription renewal | ❌ Eliminated — no subscription needed |
| ~4000 requests, 3+ hours | ✅ ~860 requests, ~43 min for full history |
| Per-movie iteration | ✅ Per-date iteration (1 req = all movies for that day) |

### What we lose

- `casts`, `language`, `description`, `trailer_url` — not in box office response (cosmetic only)
- `comparison` (7/14-day vs benchmark) — nice-to-have
- `playing_at` (theater list) — available from other sources

### What we gain

- **Daily admissions** (the holy grail — previously thought unavailable)
- **Ranking data** (`current_rank`, `last_rank`)
- **Day-over-day change** (`change` %)
- **No auth complexity** at all
- **Auto-discovery** of movies not in directory
- **5× faster** backfill

---

## Firestore Collections Summary

| Collection | Purpose | Est. doc count |
|---|---|---|
| `cinepoint_movies` | Catalog + latest box office metrics | ~4,000 |
| `cinepoint_sync_meta` | Catalog sync state | 1 |
| `cinepoint_daily_boxoffice` | Daily box office records | ~25,000 (860 days × ~30 movies/day avg) |
| `cinepoint_boxoffice_meta` | Box office sync state | 1 |
