# Movie ID Schema Analysis Report

## Executive Summary

The CineRadar codebase has an **ID confusion problem** stemming from the TIX.id API's dual-ID system. This has led to inconsistent naming, unclear document identity, and fragile cross-collection references across Firestore collections and domain models.

### March 5, 2025 Migration Incident

On **March 5, 2025**, the codebase migrated from a browser-based scraper to an API-based scraper. This migration exposed and exacerbated the ID confusion issue:

- **Before**: IDs were relatively stable and consistent
- **After**: The API returns both `id` (Schedule ID) and `movie_id` (Metadata ID), but the codebase wasn't prepared to handle this distinction
- **Result**: Corrupted and duplicated IDs in Firestore collections, as the same movie entity can now appear with different Schedule IDs across cinema chains

---

## 1. The Root Cause: TIX.id Dual-ID System

The TIX.id API provides **two distinct IDs** for each movie:

| ID Type | API Field | Purpose | Example Value |
|---------|-----------|---------|---------------|
| **Schedule ID** | `id` | Fetch showtimes via `/v1/schedules/movies/{id}` | `1996107175268794368` |
| **Metadata ID** | `movie_id` | Fetch movie details, cast, trailers | `1996107160261574656` |

**Key Insight**: These IDs are **different** for the same movie. The Schedule ID changes when a movie moves to a different cinema chain or time slot, while the Metadata ID remains constant for the movie entity.

---

## 2. Current Firestore Collections (Actual from Code)

### 2.1 Collection Overview

| Collection | Source File | Document ID | ID Type Used |
|------------|-------------|-------------|--------------|
| `movies` | [`firestore_movie_details.py`](backend/infrastructure/repositories/firestore_movie_details.py) | `{movie_id}` | **Metadata ID** ✓ |
| `schedules/{date}/movies` | [`tix_client.py`](backend/infrastructure/core/tix_client.py) | `{movie_id}` | **Schedule ID** ✗ |
| `movie_performance` | [`firestore_movie_performance.py`](backend/infrastructure/repositories/firestore_movie_performance.py) | `{movie_id}` | **Schedule ID** ✗ |
| `theatres` | [`firestore_theatre.py`](backend/infrastructure/repositories/firestore_theatre.py) | `{theatre_id}` | Theatre ID ✓ |
| `snapshots` | [`firestore_movie.py`](backend/infrastructure/repositories/firestore_movie.py) | `{date}` | Date ✓ |
| `scraper_logs` | Admin API routes | `{date}` | Date ✓ |
| `seat_snapshots` | Admin API routes | Auto-generated | N/A ✓ |
| `auth_tokens` | [`firestore_token.py`](backend/infrastructure/repositories/firestore_token.py) | `tix_jwt` | Fixed ID ✓ |

---

## 3. Cloud Functions Impact Analysis

### 3.1 Cloud Functions Inventory

| Function | File | Collections Read | Collections Written |
|----------|------|------------------|---------------------|
| **dispatcher** | [`dispatcher/main.py`](backend/functions/dispatcher/main.py) | `schedules/{date}/movies` | `scraper_logs/{date}/dispatches` |
| **scraper** | [`scraper/main.py`](backend/functions/scraper/main.py) | `scraper_logs/{date}/dispatches/jobs`, `auth_tokens` | `movie_performance/{movie_id}/days/{date}/showtimes/{showtime_id}`, `scraper_logs/{date}/dispatches/jobs` |
| **sweeper** | [`sweeper/main.py`](backend/functions/sweeper/main.py) | `schedules/{date}/movies`, `movie_performance/{movie_id}` | `movie_performance/{movie_id}/days/{date}` |

### 3.2 Impact on V2 Migration

#### Phase 1: `schedules_v2` Only (Recommended Starting Point)

| Function | Impact | Action Needed |
|----------|--------|---------------|
| **dispatcher** | ⚠️ Medium | Currently reads V1 `schedules`. Will continue working with V1. No immediate change needed. |
| **scraper** | ✅ None | Writes to `movie_performance` using `movie_id` from Pub/Sub message. Not affected by `schedules_v2`. |
| **sweeper** | ⚠️ Medium | Reads V1 `schedules` to find movies. Will continue working with V1. No immediate change needed. |

**Conclusion**: Creating `schedules_v2` with dual-write has **ZERO impact on Cloud Functions** because:
1. Dispatcher reads from V1 `schedules` - still works
2. Scraper writes to `movie_performance` - not affected
3. Sweeper reads from V1 `schedules` - still works

#### Phase 2: `movie_performance_v2` (Future)

| Function | Impact | Action Needed |
|----------|--------|---------------|
| **dispatcher** | ✅ None | Doesn't interact with `movie_performance` |
| **scraper** | 🔴 High | Must update to write to V2 (or both) |
| **sweeper** | 🔴 High | Must update to read/write V2 |

---

## 4. V2 Strategy Assessment

### Strategy Rating: **8/10 (Recommended)**

#### Strengths (+8)
1. **Zero risk to production** - V1 collections remain untouched during testing
2. **Gradual rollout** - Can validate with real data before committing
3. **Trivial rollback** - Just delete V2 collections if issues arise
4. **Parallel running** - Can compare V1 vs V2 results side-by-side
5. **Time-boxed validation** - Today's shows will prove stability quickly
6. **Incremental migration** - Can migrate historical data at a later time
7. **Low cognitive overhead** - Same codebase (just new collection names)
8. **No Cloud Function changes** - For Phase 1 (`schedules_v2` only)

#### Weaknesses (-2)
1. **Temporary code complexity** - Need dual write paths for transition period
2. **Eventual migration** - Historical data still needs migration at some point

---

## 5. V2 Collection Recommendations

| Collection | V2 Needed? | Rationale |
|------------|-----------|----------|
| `movies` | ❌ No | Already uses Metadata ID correctly |
| `schedules` | ✅ **Yes** | Uses Schedule ID - should use Metadata ID |
| `movie_performance` | ✅ **Yes** (Phase 2) | Uses Schedule ID - should use Metadata ID |
| `theatres` | ❌ No | No ID confusion |
| `snapshots` | ❌ No | Uses date as document ID |
| `scraper_logs` | ❌ No | Uses date as document ID |
| `seat_snapshots` | ❌ No | Auto-generated IDs |
| `auth_tokens` | ❌ No | Fixed document IDs |

---

## 6. Implementation Plan

### Phase 1: `schedules_v2` (Today - Low Traffic Window 11pm-9am, now is 5am)

**Goal**: Prove V2 schema works for today's shows

#### Step 1: Add Collection Constants
```python
# backend/infrastructure/firestore_collections.py
SCHEDULES_V2 = "schedules_v2"
```

#### Step 2: Update Scraper to Dual-Write
Modify [`tix_client.py`](backend/infrastructure/core/tix_client.py) to write to both V1 and V2:

```python
# V2 schema - uses metadata_id as document key
movie_entry_v2 = {
    "metadata_id": metadata_id,      # Document ID = TIX movie_id
    "schedule_id": schedule_id,      # Current TIX schedule allocation ID
    "title": movie_title,
    "merchants": [...],
    "cities": {...},
    ...
}
```

#### Step 3: Add Admin Dashboard V2 Menu
- Add `/admin/schedules_v2/[date]` route
- Create new page component that reads from `schedules_v2`
- Compare V1 vs V2 data throughout the day

#### Step 4: Validate Throughout the Day
- Check document counts match
- Verify metadata_id consistency
- Test frontend with V2 data

### Phase 2: `movie_performance_v2` (After Phase 1 Proven)

**Requires Cloud Function updates** - defer until Phase 1 is stable.

---

## 7. Timeline

| Time | Action |
|------|--------|
| **Now (5am)** | Implement `schedules_v2` dual-write |
| **6am-9am** | Morning scrape writes to both V1 and V2 |
| **10am-10pm** | Monitor V2 data throughout the day |
| **Tomorrow** | If stable, plan historical migration |

---

## 8. Questions Answered

1. **Priority**: Start with `schedules_v2` only - proven by analysis
2. **Timeline**: Now is ideal (5am, low traffic)
3. **Cloud Functions**: No impact for Phase 1 - V2 is write-only initially
4. **Historical Data**: Migrate LATER after V2 is proven stable
5. **Frontend**: Add new admin menus for V2 data validation

---

## Appendix A: Cloud Functions Code References

### dispatcher/main.py
```python
# Line 94: Reads from V1 schedules
movies_ref = db.collection("schedules").document(today).collection("movies")
```

### scraper/main.py
```python
# Line 1080: Writes to movie_performance using movie_id from Pub/Sub
doc_ref = (
    db.collection("movie_performance")
    .document(movie_id)  # This comes from Pub/Sub message
    .collection("days")
    .document(date)
    .collection("showtimes")
    .document(showtime_id)
)
```

### sweeper/main.py
```python
# Line 216: Reads from V1 schedules to find movies
movies_ref = db.collection("schedules").document(today_str).collection("movies")

# Line 63-69: Writes to movie_performance
showtimes_ref = (
    db.collection("movie_performance")
    .document(movie_id)
    .collection("days")
    .document(date_str)
    .collection("showtimes")
)
```

---

## Appendix B: Documentation Update Needed

The [`firestore_collections.py`](backend/infrastructure/firestore_collections.py) docstring is outdated - it's missing:
- `movies` collection
- `seat_snapshots` collection

This should be updated after V2 migration is complete.
