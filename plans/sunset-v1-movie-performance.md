# Plan: Sunset V1 movie_performance Collection

## Executive Summary

**Recommendation:** Yes, it is safe to sunset V1 (`movie_performance`) with proper migration steps. The V2 architecture is complete and functioning correctly.

## Current State Analysis

### V1 Usage Map

```mermaid
graph TD
    subgraph Frontend Admin
        A1[/api/performance/route.ts] -->|V1 only| V1[(movie_performance)]
        A2[/api/performance/movieId/route.ts] -->|V1 only| V1
        A3[/api/performance/movieId/days/date/route.ts] -->|V1 only| V1
        A4[/api/performance/movieId/history/route.ts] -->|V1 only| V1
        A5[/api/showtimes/showtimeId/raw/route.ts] -->|V1 fallback| V1
        A5 -->|V2 primary| V2[(movie_performance_v2)]
    end
    
    subgraph Backend Functions
        B1[scraper/main.py] -->|dual write| V1
        B1 -->|dual write| V2
        B2[sweeper/main.py] -->|dual write| V1
        B2 -->|dual write| V2
    end
    
    subgraph V2 Only
        C1[/api/performance_v2/*] -->|V2 only| V2
        C2[/api/compare/route.ts] -->|V2 only| V2
    end
```

### Files Still Using V1

| File | V1 Usage | Status |
|------|----------|--------|
| `admin/src/app/api/performance/route.ts` | Primary | ❌ To remove |
| `admin/src/app/api/performance/[movieId]/route.ts` | Primary | ❌ To remove |
| `admin/src/app/api/performance/[movieId]/days/[date]/route.ts` | Primary | ❌ To remove |
| `admin/src/app/api/performance/[movieId]/history/route.ts` | Primary | ❌ To remove |
| `admin/src/app/api/showtimes/[showtimeId]/raw/route.ts` | Fallback | ⚠️ Update to remove fallback |
| `backend/functions/scraper/main.py` | Dual write | ⚠️ Remove V1 write |
| `backend/functions/sweeper/main.py` | Dual write | ⚠️ Remove V1 write |

### Files Already Using V2

| File | Status |
|------|--------|
| `admin/src/app/api/performance_v2/*` | ✅ V2 only |
| `admin/src/app/api/compare/route.ts` | ✅ V2 only |
| `admin/src/app/performances_v2/*` | ✅ V2 pages |

---

## Migration Checklist

### Phase 1: Frontend Cleanup (Low Risk)

- [ ] Remove V1 API routes (already hidden from UI)
  - [ ] Delete `admin/src/app/api/performance/route.ts`
  - [ ] Delete `admin/src/app/api/performance/[movieId]/route.ts`
  - [ ] Delete `admin/src/app/api/performance/[movieId]/days/`
  - [ ] Delete `admin/src/app/api/performance/[movieId]/history/`
  
- [ ] Remove V1 pages
  - [ ] Delete `admin/src/app/performances/` directory

- [ ] Update showtimes raw API to remove V1 fallback
  - [ ] Edit `admin/src/app/api/showtimes/[showtimeId]/raw/route.ts`

### Phase 2: Backend Cleanup (Medium Risk)

- [ ] Remove V1 writes from scraper
  - [ ] Edit `backend/functions/scraper/main.py`
  - [ ] Remove lines1103-1110 (V1 doc_ref)
  - [ ] Remove line1229 (V1 write)

- [ ] Remove V1 writes from sweeper
  - [ ] Edit `backend/functions/sweeper/main.py`
  - [ ] Remove lines157-163 (V1 daily write)
  - [ ] Remove lines256-258 (V1 root write)
  - [ ] Remove lines93-100 (V1 fallback read)
  - [ ] Remove lines215-216 (V1 days fallback)

### Phase 3: Rename V2 to V1 (Optional)

After Phase 1 & 2 are stable, consider renaming:
- `movie_performance_v2` → `movie_performance`
- `schedules_v2` → `schedules`
- Update all references

### Phase 4: Firestore Cleanup (Low Risk)

- [ ] Backup V1 data (optional)
- [ ] Delete `movie_performance` collection
- [ ] Delete `schedules` collection (if also sunsetting)

---

## Risk Assessment

### Low Risk Items
- Removing V1 API routes (UI already hidden)
- Removing V1 pages (not accessible)

### Medium Risk Items
- Removing V1 writes from backend functions
  - Ensure V2 is receiving all data
  - Monitor for a few days before Phase 3

### Data Migration Considerations
- Historical data in V1 may not exist in V2
- V2 was likely created fresh, so old records may only exist in V1
- **Recommendation:** Keep V1 collection as read-only archive for historical analysis

---

## Recommended Execution Order

1. **Now:** Remove V1 frontend (API routes, pages) - Safe because UI is hidden
2. **After testing:** Remove V1 fallback from showtimes raw API
3. **After monitoring:** Remove V1 writes from backend functions
4. **Optional later:** Rename V2 → V1 or keep V2 naming

---

## Code Changes Required

### 1. Remove V1 fallback from showtimes raw API

**File:** `admin/src/app/api/showtimes/[showtimeId]/raw/route.ts`

```typescript
// BEFORE
let doc = await firestoreRestClient.getDocument(
    `movie_performance_v2/${movieId}/days/${date}/showtimes`,
    showtimeId
);

// Fallback to V1 collection
if (!doc) {
    doc = await firestoreRestClient.getDocument(
        `movie_performance/${movieId}/days/${date}/showtimes`,
        showtimeId
    );
}

// AFTER
const doc = await firestoreRestClient.getDocument(
    `movie_performance_v2/${movieId}/days/${date}/showtimes`,
    showtimeId
);
```

### 2. Remove V1 writes from scraper

**File:** `backend/functions/scraper/main.py`

Remove:
- Lines1103-1110 (V1 doc_ref creation)
- Line1229 (V1 write)

### 3. Remove V1 writes from sweeper

**File:** `backend/functions/sweeper/main.py`

Remove:
- Lines93-100 (V1 fallback read)
- Lines157-163 (V1 daily write)
- Lines215-216 (V1 days fallback)
- Lines256-258 (V1 root write)

---

## Conclusion

**Yes, it is safe to sunset V1** with the following approach:

1. Keep V1 Firestore collection as read-only archive (don't delete data)
2. Remove all V1 code from frontend and backend
3. V2 is fully functional and already powers the visible UI

The dual-write pattern was a migration strategy that has served its purpose. V2 is now the source of truth.
