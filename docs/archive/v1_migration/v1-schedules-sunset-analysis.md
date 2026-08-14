# Sunset Analysis: V1 `schedules` Collection

## Executive Summary
This document provides a comprehensive end-to-end analysis of the read and write paths for the V1 `schedules` collection. The goal is to determine if it is safe to remove the collection and stop dual-writes in the morning GitHub Actions script.

**Conclusion:** It is **100% safe** to delete the V1 `schedules` collection immediately. Furthermore, the dual-write functionality has **already been removed** from the codebase, though some outdated comments may suggest otherwise.

---

## 1. Write Path Analysis (Morning Script)

The morning script is orchestrated by `.github/workflows/daily-initial-scrape.yml`, which executes `backend/scripts/run_national_scrape.py`.
This script instantiates the `CineRadarScraper` (from `backend/infrastructure/core/tix_client.py`) and calls `scraper.scrape_and_upload()`.

### Current State
If we examine `upload_to_firestore` within `tix_client.py`:

```python
def upload_to_firestore(self, movies: list[dict[str, Any]], date: str) -> int:
    """Upload movie schedules to Firestore schedules collection.

    Implements dual-write to both V1 (schedules) and V2 (schedules_v2) collections:
    - V1: Uses schedule_id as document ID (backward compatible)
    - V2: Uses metadata_id as document ID (immutable, consolidates schedule_ids)
    ...
    """
    ...
    for movie in movies:
        schedule_id = movie.get("movie_id")
        metadata_id = movie.get("tix_metadata_id")
        
        # Write to schedules_v2/{date}/movies/{metadata_id}
        if metadata_id:
            v2_doc_ref = db.collection(SCHEDULES_V2)
                .document(date)
                .collection(MOVIES)
                .document(metadata_id)
            ...
            v2_doc_ref.set(v2_doc)
            v2_uploaded += 1
```

### Finding
Despite the docstring explicitly claiming that it implements a dual-write to V1 (`schedules`) and V2 (`schedules_v2`), **the actual implementation only writes to V2 (`SCHEDULES_V2`)**. 

The V1 write logic was silently removed in a previous phase, but the docstring was left untouched. Therefore, **you do not need to stop the dual-write, because it is already stopped.**

---

## 2. Read Path Analysis

To safely delete the V1 collection, we must guarantee that no system components rely on it for reads.

### A. The Backend (Cloud Functions & CLI)
*   **Dispatcher** (`backend/functions/dispatcher/main.py`): Explicitly reads from `schedules_v2` (`db.collection("schedules_v2").document(today).collection("movies")`).
*   **Sweeper** (`backend/functions/sweeper/main.py`): Explicitly reads from `schedules_v2` to determine active movies for the day.
*   **Movie Performance CLI** (`backend/cli/movie_performance.py`): Uses `SCHEDULES_V2` when initializing performance data (`--init-only`) and fetching detailed schedules.

### B. The Public Web App (`web/`)
*   **Movie Browser** (`web/src/components/movie/MovieBrowser.tsx`): Makes a direct REST API call to `https://firestore.googleapis.com/v1/projects/.../databases/(default)/documents/schedules_v2/${date}/movies/${movieId}`.
*   **Homepage** (`web/src/app/page.tsx`): Reads from `snapshots/latest`, which is generated directly from `schedules_v2` by the `post_process.py` script.

### C. The Admin Dashboard (`admin/`)
*   The admin dashboard's migration page recently contained a technical reference stating: `⚠️ Public web app (MovieBrowser.tsx): Reads V1 only via Firestore REST API`. 
*   **Finding:** This warning is **outdated**. `MovieBrowser.tsx` has been migrated to use `schedules_v2`. The admin dashboard itself exclusively queries `schedules_v2` for all schedule and performance routes.

---

## 3. Migration Roadmap & Next Steps

Because V1 reads and writes have completely ceased across the entire stack, V1 `schedules` is now "dead weight."

### Recommended Actions:

1. **Delete the Collection:** You can safely delete all documents under the `schedules` collection in Firestore. This will save storage costs and clean up the database.
2. **Clean up Documentation/Comments:**
   * Update the docstring in `backend/infrastructure/core/tix_client.py -> upload_to_firestore` to remove references to V1 dual-writes.
   * Remove the outdated warning in `admin/src/app/migration/page.tsx` (line 1056) regarding `MovieBrowser.tsx` reading V1.
3. **Clean up Constants:** The `SCHEDULES` constant has already been removed from `backend/infrastructure/firestore_collections.py`, ensuring no new code can easily use it.

## Verdict
**Status:** GREEN
**Action:** Proceed with immediate deletion of the V1 `schedules` collection and cleanup of related documentation.
