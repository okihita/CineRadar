# Performance Aggregation Bug Analysis

## Symptom

Scrapers are running successfully and writing showtime data to Firestore, but the aggregated movie performance numbers (total sold, occupancy, daily stats) are wrong or missing in the admin dashboard.

## Root Cause: V1/V2 Collection Mismatch

The system has **two parallel Firestore collection schemas** for movie performance data:

| Collection | Document ID | Status |
|---|---|---|
| `movie_performance` (V1) | `schedule_id` (mutable, changes when movie switches chains) | Legacy |
| `movie_performance_v2` (V2) | `metadata_id` (immutable TIX.id entity ID) | Current |

**The aggregation pipeline is broken because the read and write paths use different collections.**

---

## Data Flow Map

### Who writes what, where?

| Component | Showtime Snapshots | Daily Aggregates | Root Metadata |
|---|---|---|---|
| **JIT Scraper** (prod) | V1 + V2 | — | — |
| **Initial Layouts** script | V1 + V2 | — | — |
| **CLI `on_showtime_scraped`** | **V1 only** | **V1 only** | **V1 only** |
| **CLI `recalculate_all`** | — | **V2 only** (reads V1) | — |
| **CLI `--init-only`** | — | V1 + V2 | V1 + V2 |
| **Sweeper** (prod, every 30 min) | — | V1 + V2 | V1 + V2 |

### Who reads what?

| Consumer | Reads From |
|---|---|
| **Admin Dashboard** (`admin/`) | `movie_performance_v2` only |
| **`PerformanceAggregator` class** | `movie_performance` (V1) only |
| **`recalculate_all()`** | Lists movies from V2, reads showtimes from V1, writes to V2 |

---

## The 3 Critical Bugs

### Bug 1: `recalculate_all()` reads V1 showtimes using V2 document IDs

```
recalculate_all() flow:
  1. List movie IDs from movie_performance_v2 → gets metadata_ids
  2. Call repo.get_daily_showtimes(metadata_id, date)
     → queries movie_performance/{metadata_id}/days/{date}/showtimes
     → WRONG: V1 uses schedule_id as document ID, not metadata_id
  3. Finds ZERO showtimes (because the document path doesn't exist in V1)
  4. Skips the movie entirely
```

**File:** `backend/application/services/performance_aggregator.py`, lines 169–196

The `FirestoreMoviePerformanceRepository.COLLECTION` is hardcoded to `"movie_performance"` (V1), but `recalculate_all()` passes V2 `metadata_id`s as if they were V1 `schedule_id`s. Since these IDs differ, the lookups return empty results.

**Impact:** `recalculate_all()` silently does nothing for most movies.

### Bug 2: `on_showtime_scraped()` writes only to V1, admin reads only V2

```
on_showtime_scraped() flow:
  1. Saves showtime → movie_performance/{movie_id}/...          (V1 only)
  2. Reads showtimes → movie_performance/{movie_id}/...          (V1 only)
  3. Writes daily stats → movie_performance/{movie_id}/days/...  (V1 only)
  4. Writes metadata → movie_performance/{movie_id}              (V1 only)

Admin dashboard reads from → movie_performance_v2                (V2 only)
```

**File:** `backend/infrastructure/repositories/firestore_movie_performance.py`, line 25 (`COLLECTION = "movie_performance"`)

The `FirestoreMoviePerformanceRepository` is hardcoded to V1. Any data written via `on_showtime_scraped()` is invisible to the admin dashboard, which queries V2 exclusively.

**Impact:** CLI-scraped performance data (`--movie-id`, `--all`) never appears in the dashboard.

### Bug 3: Sweeper's all-time occupancy uses arithmetic mean instead of weighted average

```python
# Sweeper: aggregate_all_time_stats() — line 246
avg_occupancy = (all_time_sold / all_time_seats) * 100 if all_time_seats > 0 else 0.0
```

This is **correct** — it's a true weighted average (`total_sold / total_seats * 100`).

But the **daily** aggregation in the sweeper uses a simple arithmetic mean:

```python
# Sweeper: aggregate_daily_stats() — lines 142-144
avg_occupancy = (occupancy_sum / total_showtimes_scraped)
```

Where `occupancy_sum` accumulates individual showtime occupancy percentages. A showtime with 10 seats at 80% occupancy gets the same weight as one with 300 seats at 50% occupancy. This produces incorrect average occupancy when showtime sizes vary significantly.

Meanwhile, `PerformanceAggregator._aggregate_daily()` does the **same thing** (arithmetic mean of percentages at line 131–136).

**Impact:** Average occupancy is skewed toward small showtimes. A 10-seat VIP room at 90% pulls the average up equally against a 300-seat IMAX at 30%.

---

## Why the Dashboard Shows Wrong Data

The admin dashboard at `/api/performance_v2/route.ts`:

1. Fetches all documents from `movie_performance_v2` (root collection)
2. For each movie, fetches today's stats from `movie_performance_v2/{id}/days/{today}`
3. Also fetches movie metadata from the `movies` collection

The **only** production path that populates V2 aggregated data is the **Sweeper** Cloud Function (every 30 minutes). If the sweeper:

- Is not running → V2 has raw showtime snapshots but no aggregated daily/all-time stats
- Finds no V2 showtime snapshots → falls back to V1, but writes aggregated stats to V1 only (not V2), so the dashboard still sees nothing

The sweeper's V2 write only happens when `metadata_id and use_v2` is true (line 166). If V2 showtime data doesn't exist (e.g., because the JIT scraper didn't populate it for a particular movie), the sweeper falls back to V1, aggregates from V1, writes aggregates to V1, and **never updates V2**. The dashboard sees stale V2 data.

---

## Visual: The Broken Pipeline

```
                        ┌──────────────────────────────────────┐
                        │         JIT SCRAPER (prod)           │
                        │  Writes showtime snapshots to:       │
                        │    movie_performance (V1)            │
                        │    movie_performance_v2 (V2)         │
                        └──────────┬──────────┬────────────────┘
                                   │          │
                    ┌──────────────▼──┐  ┌────▼─────────────────┐
                    │  V1 Collection  │  │  V2 Collection       │
                    │  (schedule_id)  │  │  (metadata_id)       │
                    │                 │  │                      │
                    │  showtimes/ ✓   │  │  showtimes/ ✓        │
                    │  daily stats ?  │  │  daily stats ?       │
                    │  root stats ?   │  │  root stats ?        │
                    └────────┬────────┘  └────────┬─────────────┘
                             │                     │
               ┌─────────────▼──────┐    ┌─────────▼──────────────┐
               │ PerformanceAggr.   │    │  SWEEPER (every 30m)   │
               │ (CLI only)         │    │                        │
               │ Reads: V1 only     │    │ Reads: V2 → V1 fallback│
               │ Writes: V1 only    │    │ Writes: V1 + V2*      │
               │                    │    │ (* only if V2 data)    │
               └────────────────────┘    └─────────┬──────────────┘
                                                   │
                                         ┌─────────▼──────────────┐
                                         │  ADMIN DASHBOARD       │
                                         │  Reads: V2 ONLY        │
                                         │                        │
                                         │  If sweeper didn't     │
                                         │  write to V2 → STALE   │
                                         └────────────────────────┘
```

---

## Fix Summary

| Bug | Fix |
|---|---|
| **1. `recalculate_all()` V1/V2 mismatch** | Add a V2-compatible repository method or make the repo collection configurable. Read showtimes from V2 when using V2 IDs. |
| **2. `on_showtime_scraped()` V1-only writes** | Dual-write to both V1 and V2 (matching what the JIT scraper does), or switch entirely to V2. |
| **3. Unweighted occupancy average** | Use weighted average: `sum(sold) / sum(total_seats) * 100` instead of `sum(pct) / count`. |

The simplest comprehensive fix: **make `FirestoreMoviePerformanceRepository` dual-write to both V1 and V2** (mirroring the JIT scraper's pattern), and update `recalculate_all()` to read from V2 when V2 IDs are provided.

---

## Deployed Fix: What Happens After Push

The following 3 changes were applied to `backend/functions/sweeper/main.py` only:

1. **Daily aggregate V2 write guard relaxed:** `if metadata_id and use_v2:` → `if metadata_id:`
2. **All-time aggregate V2 write guard relaxed:** `if metadata_id and use_v2:` → `if metadata_id:`
3. **Daily occupancy calculation fixed:** `occupancy_sum / total_showtimes_scraped` → `total_sold / total_seats * 100`

### Simulation: Next Sweeper Run (T+0 to T+30 min)

Assume 100 active movies today. The sweeper iterates over all movies from `schedules_v2`.

#### Scenario A: Movie has V2 showtime data (majority of movies)

These movies already had correct data. No behavioral change.

| Step | Before Fix | After Fix |
|---|---|---|
| Read showtimes | V2 (found) | V2 (found) |
| `use_v2` flag | `True` | removed |
| Write daily V1 | ✓ | ✓ (no change) |
| Write daily V2 | ✓ (because `use_v2`) | ✓ (because `metadata_id`) |
| Occupancy calc | Unweighted mean | **Weighted average** |
| Write all-time V1 | ✓ | ✓ (no change) |
| Write all-time V2 | ✓ (because `use_v2`) | ✓ (because `metadata_id`) |

**Result:** Same write targets. Occupancy percentage changes (more accurate).

**Example occupancy shift:**

```
Movie X has 3 showtimes scraped today:
  - Regular: 200 seats, 150 sold, 75.0%
  - IMAX:    300 seats, 90 sold,  30.0%
  - VIP:      10 seats, 9 sold,   90.0%

Before (unweighted): (75.0 + 30.0 + 90.0) / 3 = 65.0%
After  (weighted):   (150 + 90 + 9) / (200 + 300 + 10) * 100 = 41.9%
```

The weighted number (41.9%) reflects actual bums-on-seats. The old number (65.0%) was inflated by the tiny VIP screen.

#### Scenario B: Movie has only V1 showtime data, but has metadata_id

These are the movies that were invisible to the dashboard. The fix directly targets them.

| Step | Before Fix | After Fix |
|---|---|---|
| Read showtimes | V2 check → empty → fallback to V1 | Same |
| `use_v2` flag | `False` | removed |
| Write daily V1 | ✓ | ✓ (no change) |
| Write daily V2 | ✗ (skipped: `use_v2` was `False`) | ✓ (now writes: `metadata_id` exists) |
| Write all-time V1 | ✓ | ✓ (no change) |
| Write all-time V2 | ✗ (skipped) | ✓ (now writes: `metadata_id` exists) |

**Result:** These movies **appear in the dashboard for the first time** after the next sweeper run.

**Example population:**

```
Before deploy:
  Dashboard shows: 72 movies (only those with V2 showtime data)
  Missing:         28 movies (had V1 data only, sweeper never wrote V2 aggregates)

After next sweeper run:
  Dashboard shows: 100 movies (all with metadata_id now get V2 aggregates)
```

#### Scenario C: Movie has no metadata_id (pure V1, no V2 migration)

These movies exist in `schedules` (V1) without a `metadata_id` field.

| Step | Before Fix | After Fix |
|---|---|---|
| `metadata_id` value | `None` | `None` |
| Write daily V2 | ✗ (no `metadata_id`) | ✗ (no `metadata_id`) |
| Write all-time V2 | ✗ (no `metadata_id`) | ✗ (no `metadata_id`) |

**Result:** No change. These movies remain invisible to the V2 dashboard. This is expected — they need to be migrated to V2 schema first.

#### Scenario D: Movie has no showtime data at all

No showtimes were scraped today for this movie.

| Step | Before Fix | After Fix |
|---|---|---|
| Read showtimes | V2 → empty, V1 → empty | Same |
| Returns | `False` early (line 106) | Same |
| Writes | None | None |

**Result:** No change. No writes attempted.

### Cost Impact

| Metric | Before | After | Delta |
|---|---|---|---|
| Firestore reads per sweep | ~200 (2 per movie: V2 check + V1 fallback) | Same | 0 |
| Firestore writes per sweep | ~100-200 (V1 always, V2 only when `use_v2`) | ~200 (V1 + V2 always when `metadata_id`) | +0 to +100 writes |
| Extra daily writes (48 sweeps) | — | — | +0 to +4,800 writes/day |
| Cost at $0.18/100K writes | — | — | **< $0.01/day** |

### Risk Assessment

| Risk | Likelihood | Mitigation |
|---|---|---|
| `merge=True` overwrites valid data | None — only merges the calculated fields | Already using `merge=True` before fix |
| Occupancy percentage jumps alarm users | Medium — some movies shift significantly | The new number is *correct*; old was inflated |
| V2 write fails silently | Low — caught by `try/except` on line 179 | V1 fallback still works |
| Extra writes hit quota | Negligible — Firestore free tier is 20K writes/day | ~4.8K extra is well within limits |

### Expected Timeline After Deploy

```
T+0 min   Deploy pushed
T+0-30    Next sweeper run triggers
T+0-30    All movies with metadata_id get V2 aggregates (daily + all-time)
T+0-30    Dashboard immediately shows updated occupancy + previously missing movies
T+30-60   Second sweeper run confirms stable state
T+60      Steady state: dashboard fully populated, accurate weighted occupancy
```
