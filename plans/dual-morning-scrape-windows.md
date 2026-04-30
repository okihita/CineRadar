# Plan: Dual Morning Scrape Windows

> **Status**: Draft  
> **Date**: 2026-04-30  
> **Trigger**: 2026-04-30 incident — XXI showtimes were not yet published at 6 AM WIB, causing a full-day gap for all XXI theatres. Discovered at 3 PM, manual rerun required.

---

## 1. Problem Statement

On 2026-04-30, TIX.id had not yet published XXI showtimes by the time the morning scraper ran at ~5:30 AM WIB. This resulted in zero XXI coverage for the entire day. The gap was discovered at ~3 PM and a manual rerun was executed.

Historical data is critical to this ecosystem — even a single day of missing data is unacceptable. The current single-window approach has a single point of failure: if TIX.id is late publishing schedules for *any* merchant (XXI, CGV, Cinépolis), we miss everything until a human notices.

**Root Cause**: We run one scrape window. TIX.id publish times are non-deterministic and vary by merchant.

---

## 2. Proposed Solution

Run **two independent full scrape windows** each morning, spaced ~3.5 hours apart:

| Window | Scrape Time (WIB) | Cron (UTC) | Purpose |
|--------|-------------------|------------|---------|
| **Primary** | ~05:30 AM | `30 22 * * *` | Early catch — picks up CGV/Cinépolis and any early XXI data |
| **Secondary** | ~09:00 AM | `0 2 * * *` | Safety net — catches late-publishing XXI or any merchant that wasn't ready at 5:30 AM |

Both windows run the **exact same pipeline** (full re-scrape). The secondary window is not a delta — it's a full idempotent overwrite. If both windows succeed, the data is simply overwritten with identical content (no corruption risk — all writes use `set()` which is idempotent).

---

## 3. Current Pipeline (As-Is)

### 3.1 `daily-initial-scrape.yml` — Movie Schedules

**Current crons:**
```
'15 18 * * *'  # 01:15 AM WIB (UTC+7) — "avoid top-of-hour congestion"
'30 22 * * *'  # 05:30 AM WIB — "catch late XXI schedule uploads"
```

**Steps (single job, sequential):**
1. `Scrape Now Playing Movies & Showtimes` → `run_national_scrape.py` (~10-15 min)
2. `Link Schedules to Theatres & Cities` → `post_process.py` (snapshots, theatre sync, studio discovery, alerts)
3. `Initialize Performance Data` → `movie_performance --init-only` (creates zero-occupancy placeholder docs)
4. `Scrape Metadata for All New Movies` → `movie-details --all` (enriches new movies with cast/synopsis/ratings)

### 3.2 `daily-initial-layouts.yml` — Baseline Seat Layouts

**Current crons:**
```
'0 19 * * *'    # 02:00 AM WIB — 45 min after the 01:15 scrape
'15 23 * * *'   # 06:15 AM WIB — 45 min after the 05:30 scrape
```

**Steps:**
1. `Scrape Initial Seat Layouts (Baseline)` → `scrape_initial_layouts.py` (uses checkpointing — skips already-scraped showtimes, so a re-run only processes new ones)

**Key behavior**: The script uses **checkpointing** — it checks if `initial_unavailable` already exists on a showtime doc. If it does, that showtime is skipped. This means the secondary run only processes showtimes that were newly added by the secondary scrape window. This is efficient and safe.

### 3.3 `scrape-movie-details.yml` — Movie Metadata Backfill

**Current cron:**
```
'30 18 * * *'  # 01:30 AM WIB
```

**Steps:**
1. `Scrape Movie Details with Daily Rating Updates` → `movie-details --from-performance --update-ratings`

**Note**: This uses `--from-performance` (reads from `movie_performance_v2` collection), not `--all` (reads from snapshot). It also runs `--update-ratings` to refresh ratings for all known movies.

### 3.4 `token-refresh.yml` — Monthly RSA Token

Unchanged. Runs 1st of every month.

---

## 4. Proposed Pipeline (To-Be)

### 4.1 Timing Diagram

All times in WIB (UTC+7). Cron expressions shown in UTC.

```
                            WIB         UTC Cron
─────────────────────────────────────────────────────
TOKEN REFRESH (monthly)     1st 02:50   '50 19 1 * *'         ← UNCHANGED

─── PRIMARY WINDOW ──────────────────────────────────
SCRAPE SCHEDULES             05:30       '30 22 * * *'         ← KEEP (already exists)
SCRAPE LAYOUTS               06:15       '15 23 * * *'         ← KEEP (already exists)
SCRAPE MOVIE DETAILS         06:30       '30 23 * * *'         ← MOVE from 01:30 AM

─── SECONDARY WINDOW ────────────────────────────────
SCRAPE SCHEDULES             09:00       '0 2 * * *'           ← ADD
SCRAPE LAYOUTS               09:45       '45 2 * * *'          ← ADD (45 min after)
SCRAPE MOVIE DETAILS         10:00       '0 3 * * *'           ← ADD (1 hr after)

─────────────────────────────────────────────────────
```

### 4.2 `daily-initial-scrape.yml` — Changes

**Remove** the early 01:15 AM cron (no longer needed — we no longer need a "pre-flight" scrape at 1 AM since we have two solid windows).

**Keep** the 05:30 AM cron as the primary window.

**Add** the 09:00 AM cron as the secondary window.

**No changes to any steps** — the same 4 steps run for both cron triggers. The pipeline is fully idempotent.

```yaml
on:
  schedule:
    - cron: '30 22 * * *'  # 05:30 WIB — Primary window
    - cron: '0 2 * * *'    # 09:00 WIB — Secondary window (safety net)
  workflow_dispatch:
```

### 4.3 `daily-initial-layouts.yml` — Changes

**Keep** the existing 06:15 AM cron (runs 45 min after the primary 05:30 scrape).

**Add** a new 09:45 AM cron (runs 45 min after the secondary 09:00 scrape).

**Remove** the old 02:00 AM cron (was for the now-removed 01:15 scrape).

```yaml
on:
  schedule:
    - cron: '15 23 * * *'  # 06:15 WIB — 45 min after primary scrape
    - cron: '45 2 * * *'   # 09:45 WIB — 45 min after secondary scrape
  workflow_dispatch:
```

**Why the 45-minute gap?** The national scrape takes ~10-15 minutes. The post-processing step takes a few more minutes. 45 minutes provides ample buffer for the scrape to fully complete and Firestore writes to settle before the layout scraper reads the new schedules.

### 4.4 `scrape-movie-details.yml` — Changes

**Move** from 01:30 AM to 06:30 AM (runs after the primary scrape + layout are complete).

**Add** a secondary 10:00 AM cron (runs after the secondary scrape + layout are complete).

**Remove** the old 01:30 AM cron entirely.

```yaml
on:
  schedule:
    - cron: '30 23 * * *'  # 06:30 WIB — After primary scrape & layout
    - cron: '0 3 * * *'    # 10:00 WIB — After secondary scrape & layout
  workflow_dispatch:
```

**Rationale for moving**: The movie details scraper reads from the `movie_performance_v2` collection (via `--from-performance`) and from the `snapshots/latest` document (via `--all`). Both of these are populated by the primary scrape. Running movie-details at 01:30 AM was premature — the data it needs doesn't exist yet. Running it at 06:30 AM ensures it has the primary scrape data available.

**Why run it twice?** The secondary scrape at 09:00 may discover new movies (e.g., late XXI). Running movie-details again at 10:00 ensures these new movies get their metadata (cast, synopsis, trailers) scraped too. Since `--from-performance` with `--update-ratings` is used, the second run is fast — existing movies just get a rating refresh, and new movies get full metadata scraped.

---

## 5. Why This Works

### 5.1 Idempotency — Safe Overwrites

Every step in the pipeline uses Firestore `set()` with `merge=True` or plain `set()` (overwrite). Running the pipeline twice does not corrupt data:

| Step | Write Behavior | Second Run Effect |
|------|---------------|-------------------|
| `run_national_scrape.py` | `doc_ref.set(doc)` — full overwrite | Overwrites with same or updated data |
| `post_process.py` | `set` + `merge=True` for snapshots/theatres | Merges new data, preserves existing |
| `movie_performance --init-only` | `set` + `merge=True` for daily stats | Updates total_showtimes count |
| `scrape_initial_layouts.py` | Checkpointing — skips already-processed showtimes | Only processes new showtimes from secondary scrape |
| `movie-details` | `skip_existing=True` by default | Only scrapes new movies; updates ratings for existing |

### 5.2 Checkpointing in Layout Scraper

The layout scraper (`scrape_initial_layouts.py`) has built-in checkpointing. It checks if a showtime already has `initial_unavailable` in its Firestore document. If so, it skips that showtime. This means:

- **Primary run (06:15)**: Scrapes layouts for all showtimes from the 05:30 scrape
- **Secondary run (09:45)**: Only scrapes layouts for *newly discovered* showtimes from the 09:00 scrape (e.g., late XXI)

This is efficient — the secondary layout run doesn't re-scrape layouts for CGV/Cinépolis that were already captured at 06:15.

### 5.3 JIT Pipeline — No Changes Needed

The JIT pipeline (dispatcher → Pub/Sub → scraper → sweeper) runs independently every 5 minutes. It reads from `schedules` / `schedules_v2` collections. Once the secondary scrape writes new XXI showtimes, the JIT dispatcher will automatically discover them on its next cycle. No configuration changes needed.

---

## 6. What Gets Removed

| What | Why |
|------|-----|
| `daily-initial-scrape.yml` cron: `'15 18 * * *'` (01:15 AM WIB) | No longer needed — replaced by dual 05:30/09:00 windows |
| `daily-initial-layouts.yml` cron: `'0 19 * * *'` (02:00 AM WIB) | Was tied to the 01:15 scrape, now removed |
| `scrape-movie-details.yml` cron: `'30 18 * * *'` (01:30 AM WIB) | Moved to 06:30 AM — data doesn't exist at 01:30 AM |

---

## 7. Risk Analysis

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Both windows fail (API down all morning) | Very Low | Critical — no data for the day | Alert job creates GitHub Issue on failure. Human can manually rerun when API recovers. |
| Secondary window finds no new data (TIX.id was on time) | High (most days) | None — idempotent overwrite wastes ~15 min of GitHub Actions compute | Acceptable cost for data guarantee. |
| GitHub Actions runner queue delays the secondary window | Low | Minor — layout scrape starts a few minutes late | 45-min buffer is generous. |
| Rate limiting from TIX.id (two full scrapes in one morning) | Low | Scrape fails on second run | 4 req/sec rate limit is conservative. 3.5-hour gap between runs is ample cooldown. |
| Token expiration between windows | Very Low | Layout scraper fails | Token refresh is handled by `ensure_valid_token()` with auto-refresh. 30-min TTL, 25-min emergency refresh. |

---

## 8. Files to Modify

| File | Change |
|------|--------|
| `.github/workflows/daily-initial-scrape.yml` | Remove `15 18` cron. Add `0 2` cron (09:00 WIB). |
| `.github/workflows/daily-initial-layouts.yml` | Remove `0 19` cron. Add `45 2` cron (09:45 WIB). |
| `.github/workflows/scrape-movie-details.yml` | Replace `30 18` cron with `30 23` (06:30 WIB) and `0 3` (10:00 WIB). |

**No Python code changes needed.** The existing scripts are already idempotent and checkpoint-aware.

---

## 9. Cost Impact

Each full scrape window costs:
- **GitHub Actions**: ~20 min of `ubuntu-latest` runner time (free tier: 2000 min/month)
  - Scrape: ~15 min
  - Post-process: ~3 min
  - Init performance: ~1 min
  - Movie details: ~1 min

Per-day estimate (2 windows):
- `daily-initial-scrape.yml`: 2 × 20 min = 40 min
- `daily-initial-layouts.yml`: 2 × 30 min (conservative) = 60 min
- `scrape-movie-details.yml`: 2 × 10 min = 20 min
- **Total: ~120 min/day → ~3,600 min/month**

This is within the free tier (2,000 min for free accounts, 3,000 min for Pro). If exceeding free tier, the cost is minimal (~$0.008/min = ~$29/month).

---

## 10. Future Considerations

1. **Observability**: After deploying, monitor for 1-2 weeks whether the secondary window consistently finds new data. If it never finds new data after a month, we could consider downgrading it to a "verification" run that only alerts on discrepancies.

2. **Third window**: If TIX.id ever starts publishing even later (e.g., noon), we can trivially add a third window by adding another cron entry. No architecture changes needed.

3. **Smart detection**: A future enhancement could be to compare the showtime count from the primary and secondary scrapes, and alert if the secondary found significantly more showtimes (indicating the primary was too early). This would give us data to fine-tune the timing.
