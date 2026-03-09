# Scraper vs Sweeper: Merge Analysis

## Current Architecture

### Three Cloud Functions

| Function | Trigger | Frequency | Purpose |
|----------|---------|-----------|---------|
| **Dispatcher** | HTTP (Scheduler) | Every 5 min | Find showtimes in [T+30, T+35) window, publish to Pub/Sub |
| **Scraper** | Pub/Sub | Per-showtime | Call TIX API, save seat snapshot to Firestore |
| **Sweeper** | HTTP (Scheduler) | Every 30 min | Read snapshots, aggregate daily/all-time stats |

### Data Flow

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Scheduler  │────▶│  Dispatcher │────▶│   Pub/Sub   │
└─────────────┘     └─────────────┘     └──────┬──────┘
                                               │
                                               ▼
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Firestore  │◀────│   Scraper   │◀────│  (parallel) │
│  showtimes  │     │ (max 5 inst)│     │  N messages │
└──────┬──────┘     └─────────────┘     └─────────────┘
       │
       ▼
┌─────────────┐     ┌─────────────┐
│   Sweeper   │────▶│  Firestore  │
│ (aggregate) │     │ daily stats │
└─────────────┘     └─────────────┘
```

### Responsibilities

#### Scraper (Pub/Sub triggered)
- Receives single showtime job from Pub/Sub
- Loads auth token from Firestore
- Calls TIX.id API to get seat layout
- Saves compressed snapshot to `movie_performance/{movie_id}/days/{date}/showtimes/{showtime_id}`
- Handles token refresh on-demand
- Logs success/errors to `scraper_logs`

#### Sweeper (HTTP triggered)
- Lists all movies for today from `schedules`
- For each movie:
  - Reads all showtime snapshots from Firestore
  - Aggregates DAILY stats (total sold, occupancy, cities)
  - Updates `DailyPerformance` document
  - Aggregates ALL-TIME stats to root `MovieMetadata`

---

## Merge Analysis

### Option A: Keep Separate (Current)

#### Pros (+5)
1. **Pub/Sub parallelism** - N scraper instances run in parallel (up to max_instances=5)
2. **Automatic retry** - Pub/Sub retries failed messages with exponential backoff
3. **Dead letter queue** - Failed jobs can be routed for inspection
4. **Independent scaling** - Scraper can scale without affecting sweeper
5. **Failure isolation** - If sweeper fails, scraper continues collecting data

#### Cons (-2)
1. **Code duplication** - Constants, utils duplicated per self-contained constraint
2. **Multiple deployments** - Three functions to deploy and monitor

### Option B: Merge Scraper + Sweeper

#### How it would work:
```
┌─────────────┐     ┌─────────────────────────┐
│  Scheduler  │────▶│  Unified Scraper        │
└─────────────┘     │  (HTTP triggered)       │
                    │  - Iterate showtimes    │
                    │  - Call API (sequential)│
                    │  - Aggregate stats      │
                    └─────────────────────────┘
```

#### Pros (+2)
1. **Single deployment** - One function to manage
2. **No code duplication** - Shared constants/utils

#### Cons (-5)
1. **Loses parallelism** - Must iterate showtimes sequentially
2. **No automatic retry** - Must implement own retry logic
3. **Rate limiting risk** - TIX API has rate limits; parallel helps avoid hitting them per-instance
4. **Timeout risk** - HTTP functions have 9 min timeout; sequential processing may exceed
5. **Single point of failure** - One error crashes entire job

### Option C: Merge Dispatcher + Sweeper (Keep Scraper Separate)

This makes more sense! Dispatcher and Sweeper are both HTTP-triggered batch jobs.

```
┌─────────────┐     ┌─────────────────────────┐     ┌─────────────┐
│  Scheduler  │────▶│  Dispatcher+Sweeper     │────▶│   Pub/Sub   │
│  (5 min)    │     │  - Dispatch showtimes   │     └──────┬──────┘
│  (30 min)   │     │  - Aggregate stats      │            │
└─────────────┘     └─────────────────────────┘            ▼
                                                   ┌─────────────┐
                                                   │   Scraper   │
                                                   │ (Pub/Sub)   │
                                                   └─────────────┘
```

#### Pros (+3)
1. **Reduced function count** - 2 instead of 3
2. **Logical grouping** - Both are "orchestration" functions
3. **Scraper keeps parallelism** - Pub/Sub still works

#### Cons (-2)
1. **Different schedules** - Dispatcher runs every 5 min, Sweeper every 30 min
2. **Mixed responsibilities** - Dispatching and aggregating are different concerns

---

## Verdict: **Keep Separate (Option A)**

### Rationale

1. **Pub/Sub is the key architectural advantage**
   - Parallel processing with automatic retry
   - Rate limit distribution across instances
   - Dead letter queue for debugging failures

2. **Self-contained constraint is intentional**
   - Code duplication exists for deployment isolation
   - Each function can be updated independently
   - Cold start performance is optimized

3. **Separation of concerns is clean**
   - **Dispatcher**: Orchestration (find jobs, distribute work)
   - **Scraper**: Data collection (API calls, write snapshots)
   - **Sweeper**: Data aggregation (read snapshots, compute stats)

4. **The current design handles failure gracefully**
   - If scraper fails on one showtime, others continue
   - If sweeper fails, data is still collected (just not aggregated)
   - Pub/Sub retries individual failures automatically

### When to Reconsider

Merge might make sense if:
- TIX API rate limits become per-account (not per-IP)
- Showtime count drops significantly (< 50/day)
- Cold start latency becomes problematic
- Cloud Functions cost becomes a concern (but they're cheap)

---

## Summary Table

| Aspect | Separate | Merged |
|--------|----------|--------|
| Parallelism | ✅ Yes (Pub/Sub) | ❌ No (sequential) |
| Retry logic | ✅ Automatic | ❌ Manual |
| Failure isolation | ✅ Per-showtime | ❌ All-or-nothing |
| Rate limit handling | ✅ Distributed | ⚠️ Concentrated |
| Timeout risk | ✅ Low (per-job) | ⚠️ High (batch) |
| Deployment complexity | ⚠️ 3 functions | ✅ 1-2 functions |
| Code duplication | ⚠️ Yes (intentional) | ✅ No |

**Recommendation**: Keep the current three-function architecture. The operational benefits of Pub/Sub parallelism and failure isolation outweigh the minor inconvenience of code duplication.
