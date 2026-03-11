# Seat Visualization Missing Analysis

## 1. Issue Description

When expanding the accordion for a showtime in the Movie Performance dashboard (e.g., BEKASI TRADE CENTER CGV for 15:00), the UI displayed the message: **"Seat layout visualization not available for this showtime."** 

This occurred despite the showtime having been successfully scraped (e.g., at 02:30 PM), meaning the layout data *should* have been available in the database (either from the JIT scrape or the morning baseline scrape).

## 2. Root Cause Analysis

The root cause of this issue stems from the ongoing migration from our V1 data schema (`movie_performance`) to the V2 data schema (`movie_performance_v2`).

1. **Dashboard Context:**
   The admin user was viewing the V2 Performance Dashboard. In the V2 architecture, movies are grouped by a stable, immutable `metadata_id` rather than the daily shifting `movie_id` (schedule ID) used in V1. 

2. **API Route Hardcoding (The Bug):**
   When the user expanded the showtime accordion, the frontend fired a request to fetch the raw seat layout data via the `/api/showtimes/[showtimeId]/raw` endpoint. 
   It passed the `metadata_id` as the `movieId` query parameter.
   
   However, the backend API route was hardcoded to *only* look in the legacy V1 collection:
   ```typescript
   // Old Code
   const doc = await firestoreRestClient.getDocument(
       `movie_performance/${movieId}/days/${date}/showtimes`,
       showtimeId
   );
   ```

3. **The Result (404 Not Found):**
   Because the API was looking for a `metadata_id` inside the `movie_performance` (V1) collection, it failed to find the document. The API returned a `404 Not Found`, causing the frontend to receive `null` for both `initialLayout` and `finalLayout`, which triggered the fallback "not available" message.

## 3. Data Integrity Verification

Is the data actually missing from Firestore? **No.** 
The data pipeline is working correctly. The morning scraper (`scrape_initial_layouts.py`) and the JIT scraper (`backend/functions/scraper/main.py`) both perform dual-writes. They successfully save `initial_layout_compressed` and `layout_compressed` to *both* the V1 and V2 collections simultaneously using `merge=True`. The layout data has been safely resting in the database all along.

## 4. Resolution

### API Route Update
We updated `admin/src/app/api/showtimes/[showtimeId]/raw/route.ts` to be schema-aware. It now attempts to fetch from the V2 collection first (assuming the ID might be a `metadata_id`). If it fails, it falls back to the V1 collection (assuming the ID might be a legacy `movie_id`).

```typescript
// Try V2 collection first (if movieId is actually a metadataId)
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
```

### UI Enhancements
As requested, we also updated the frontend UI component (`admin/src/features/performances/components/ShowtimeTable.tsx`) to display the actual `showtime_id` directly inside the expanded accordion, next to the scrape phase and time. This will make it significantly easier to cross-reference specific showtimes with the database or logs in the future.

```text
Last updated: [T-20] 02:30 PM    ID: cgv-123456
```

## 5. Summary
The missing visualizations were a frontend/API routing bug related to the V2 migration, not a failure of the scraping infrastructure. The data is intact, and the UI will now render the visualizations correctly regardless of whether the user is browsing V1 or V2 dashboards.