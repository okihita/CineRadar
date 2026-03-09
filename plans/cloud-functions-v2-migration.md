# Cloud Functions V2 Migration Plan

## Overview

This plan updates the three Cloud Functions (dispatcher, scraper, sweeper) to support the V2 collection schema that uses `metadata_id` as the document key instead of `schedule_id`.

## Current State (V1)

### Data Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ V1 Collections (uses schedule_id - changes per cinema chain)                │
├─────────────────────────────────────────────────────────────────────────────┤
│ schedules/{date}/movies/{schedule_id}                                        │
│ movie_performance/{schedule_id}/days/{date}/showtimes/{showtime_id}         │
└─────────────────────────────────────────────────────────────────────────────┘

Dispatcher (every 5 min)                Scraper (Pub/Sub)                Sweeper (every 30 min)
       │                                      │                                  │
       ▼                                      ▼                                  ▼
┌──────────────────┐    Pub/Sub        ┌──────────────────┐           ┌──────────────────┐
│ Read schedules/  │─────────────────▶ │ Write to         │           │ Read schedules/  │
│ {date}/movies    │    message:       │ movie_performance│           │ {date}/movies    │
│                  │    {movie_id,     │ /{movie_id}/...  │           │                  │
└──────────────────┘     showtime_id}  └──────────────────┘           └──────────────────┘
```

### Problem

The `movie_id` passed through Pub/Sub is actually `schedule_id`, which:
- Changes when a movie moves to a different cinema chain
- Causes duplicate documents for the same movie entity
- Breaks cross-collection references

## Target State (V2)

### Data Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ V2 Collections (uses metadata_id - immutable movie entity identifier)       │
├─────────────────────────────────────────────────────────────────────────────┤
│ schedules_v2/{date}/movies/{metadata_id}                                     │
│ movie_performance_v2/{metadata_id}/days/{date}/showtimes/{showtime_id}      │
└─────────────────────────────────────────────────────────────────────────────┘

Dispatcher (every 5 min)                Scraper (Pub/Sub)                Sweeper (every 30 min)
       │                                      │                                  │
       ▼                                      ▼                                  ▼
┌──────────────────┐    Pub/Sub        ┌──────────────────┐           ┌──────────────────┐
│ Read schedules_v2│─────────────────▶ │ Write to         │           │ Read schedules_v2│
│ /{date}/movies   │    message:       │ movie_performance│           │ /{date}/movies   │
│                  │    {metadata_id,  │ _v2/{metadata_id}│           │                  │
│                  │     schedule_id,  │ /...             │           │                  │
│                  │     showtime_id}  └──────────────────┘           └──────────────────┘
```

## Migration Strategy: Dual-Write

### Phase 1: Dual-Write (Zero Risk)

Both V1 and V2 collections are written to simultaneously. V1 remains the source of truth.

### Phase 2: Read from V2 (After Validation)

Switch readers to V2 while maintaining V1 writes as backup.

### Phase 3: V1 Deprecation (After Stability)

Stop writing to V1, delete V1 collections.

---

## Implementation Details

### 1. Dispatcher Changes

**File**: [`backend/functions/dispatcher/main.py`](backend/functions/dispatcher/main.py)

**Current code** (line 94-99):
```python
movies_ref = db.collection("schedules").document(today).collection("movies")

for movie_doc in movies_ref.stream():
    movie = movie_doc.to_dict()
    movie_id = movie.get("movie_id", movie_doc.id)  # This is schedule_id
```

**Changes needed**:
```python
# Dual-read: V2 first, fallback to V1
movies_ref_v2 = db.collection("schedules_v2").document(today).collection("movies")
movies_ref_v1 = db.collection("schedules").document(today).collection("movies")

# Try V2 first
movie_docs = list(movies_ref_v2.stream())
if not movie_docs:
    # Fallback to V1
    movie_docs = list(movies_ref_v1.stream())
    use_v1_schema = True
else:
    use_v1_schema = False

for movie_doc in movie_docs.stream():
    movie = movie_doc.to_dict()
    
    if use_v1_schema:
        # V1 schema: movie_id is schedule_id
        schedule_id = movie.get("movie_id", movie_doc.id)
        metadata_id = movie.get("tix_metadata_id")  # May not exist
    else:
        # V2 schema: document ID is metadata_id
        metadata_id = movie_doc.id
        schedule_ids = movie.get("schedule_ids", [])
        schedule_id = schedule_ids[0] if schedule_ids else None
```

**Pub/Sub message enhancement**:
```python
showtimes_to_scrape.append({
    "showtime_id": showtime_id,
    "movie_id": schedule_id,        # Keep for V1 compatibility
    "metadata_id": metadata_id,     # NEW: For V2 writes
    "movie_title": movie_title,
    # ... rest of fields
})
```

### 2. Scraper Changes

**File**: [`backend/functions/scraper/main.py`](backend/functions/scraper/main.py)

**Current code** (line ~1000):
```python
doc_ref = (
    db.collection("movie_performance")
    .document(movie_id)  # This is schedule_id
    .collection("days")
    .document(date)
    .collection("showtimes")
    .document(showtime_id)
)
```

**Changes needed**:
```python
# Dual-write to both V1 and V2
schedule_id = job_data.get("movie_id")
metadata_id = job_data.get("metadata_id")

# V1 write (existing - keep for backward compatibility)
v1_doc_ref = (
    db.collection("movie_performance")
    .document(schedule_id)
    .collection("days")
    .document(date)
    .collection("showtimes")
    .document(showtime_id)
)
v1_doc_ref.set(snapshot_data)

# V2 write (new - only if metadata_id available)
if metadata_id:
    v2_doc_ref = (
        db.collection("movie_performance_v2")
        .document(metadata_id)
        .collection("days")
        .document(date)
        .collection("showtimes")
        .document(showtime_id)
    )
    # Include schedule_id in the document for reference
    v2_data = {**snapshot_data, "schedule_id": schedule_id}
    v2_doc_ref.set(v2_data)
```

### 3. Sweeper Changes

**File**: [`backend/functions/sweeper/main.py`](backend/functions/sweeper/main.py)

**Current code** (line 216):
```python
movies_ref = db.collection("schedules").document(today_str).collection("movies")
```

**Changes needed**:
```python
# Dual-read: V2 first, fallback to V1
movies_ref_v2 = db.collection("schedules_v2").document(today_str).collection("movies")
movies_ref_v1 = db.collection("schedules").document(today_str).collection("movies")

movie_docs = list(movies_ref_v2.stream())
use_v1_schema = False
if not movie_docs:
    movie_docs = list(movies_ref_v1.stream())
    use_v1_schema = True
```

**Aggregation changes**:
```python
# In aggregate_daily_stats:
if use_v1_schema:
    # V1: Use schedule_id
    showtimes_ref = (
        db.collection("movie_performance")
        .document(movie_id)
        .collection("days")
        .document(date_str)
        .collection("showtimes")
    )
else:
    # V2: Use metadata_id
    showtimes_ref = (
        db.collection("movie_performance_v2")
        .document(metadata_id)
        .collection("days")
        .document(date_str)
        .collection("showtimes")
    )
```

---

## Migration Phases

### Phase 1: Dual-Write (Implement Now)

| Component | Change | Risk |
|-----------|--------|------|
| Dispatcher | Add `metadata_id` to Pub/Sub message | Low - additive only |
| Scraper | Dual-write to `movie_performance_v2` | Low - V1 still works |
| Sweeper | Dual-read from `schedules_v2` with V1 fallback | Low - graceful fallback |

**Deployment order**:
1. Deploy dispatcher (adds metadata_id to messages)
2. Deploy scraper (starts dual-write)
3. Deploy sweeper (reads from V2 when available)

### Phase 2: V2 Primary (After 1 Week Stability)

| Component | Change | Risk |
|-----------|--------|------|
| Dispatcher | Read V2 primary, V1 fallback | Low - already tested |
| Sweeper | Read V2 primary, V1 fallback | Low - already tested |

### Phase 3: V1 Deprecation (After 1 Month Stability)

| Component | Change | Risk |
|-----------|--------|------|
| All | Remove V1 code paths | Medium - requires testing |
| Firestore | Delete V1 collections | High - irreversible |

---

## Testing Checklist

### Pre-Deployment

- [ ] Verify `schedules_v2` has data with correct `metadata_id` keys
- [ ] Verify Pub/Sub message includes both `movie_id` and `metadata_id`
- [ ] Test scraper dual-write locally

### Post-Deployment

- [ ] Check `movie_performance_v2` has documents with correct `metadata_id`
- [ ] Verify sweeper reads from V2 successfully
- [ ] Compare V1 vs V2 aggregation results
- [ ] Monitor Cloud Function logs for errors

---

## Rollback Plan

If issues arise:

1. **Dispatcher**: Revert to previous version (reads V1 only)
2. **Scraper**: Revert to previous version (writes V1 only)
3. **Sweeper**: Already has V1 fallback, no action needed

V2 collections can be safely deleted and rebuilt from fresh scrapes.

---

## Estimated Effort

| Task | Complexity |
|------|------------|
| Dispatcher changes | Low - additive only |
| Scraper dual-write | Medium - new collection path |
| Sweeper dual-read | Medium - conditional logic |
| Testing | Medium - dual-path validation |
| Deployment | Low - standard gcloud deploy |

## Next Steps

1. Switch to Code mode
2. Implement dispatcher changes (add metadata_id to Pub/Sub)
3. Implement scraper dual-write
4. Implement sweeper dual-read
5. Deploy and test
