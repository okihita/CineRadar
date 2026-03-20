# Metadata Gap Analysis: Missing Titles & Posters

## 1. Problem Statement
Despite the successful consolidation of rating history and the removal of "ghost" documents, the Admin UI at `/movies` (specifically the **Past Movies** section) shows many entries with missing titles and posters. 

The UI correctly identifies these as movies that once existed (via `movie_performance_v2`), but it cannot find their enrichment data in the root `movies` collection.

---

## 2. Root Cause Analysis

### A. The "Ghost" Deletion Side Effect
In the early days of the project, the system incorrectly saved movie data using the `schedule_id` as the primary key. 
*   For many movies, the **only** record that contained a title and poster was the "Ghost" document (the one with the `schedule_id`).
*   The "Correct" document (indexed by `metadata_id`) was often created as an empty shell during a backfill or performance sweep.
*   **Action taken:** When we surgically deleted the 86 ghosts, we successfully migrated their **Rating History**, but we did not migrate their **static metadata** (title/poster) because we assumed the correct document would eventually be re-scraped.

### B. The Scraper Window Problem
The `movie-details` scraper is designed to only fetch data for **Now Playing** movies. 
*   If a movie had a short theatrical run (e.g., a special 2-day screening), it may have been "Archived" before the metadata scraper had a chance to visit it.
*   **The TIX.id Limitation:** Once a movie is no longer showing in any theatre, the TIX Metadata API often returns an empty object. We cannot "re-scrape" metadata for past movies from the source.

### C. Architectural Evolution (V1 vs V2)
*   **V1 Logic:** Movie titles were stored "inline" inside every performance document.
*   **V2 Logic:** Performance documents are lightweight (IDs only), and the UI must "Join" them with the root `movies` collection to get titles.
*   If that "Join" fails because the root document is missing, the movie becomes anonymous.

---

## 3. Why a Backfill is Required
We cannot rely on the daily scraper to fix this because it only looks at current movies. We must perform a one-time **Internal Metadata Restoration** to populate the root `movies` collection using data we already have stored in other formats.

---

## 4. Restoration Strategy (The Plan)

We will develop a script that repairs the `movies` collection by mining three internal sources:

### Source 1: The Legacy V1 Performance Index
The `movie_performance` (V1) collection is a goldmine for titles. Even if the ID is a `schedule_id`, it is often mapped to the `metadata_id` inside our audit logs.
*   **Action:** Lookup the missing Metadata ID in the V1 collection.

### Source 2: Historical Schedule Snapshots
The `schedules_v2/{date}/movies` subcollections contain the title and poster for every movie that was active on that date. 
*   **Action:** Iterate backward through recent dates (e.g., the last 30 days) and find the most recent snapshot containing the Metadata ID. Extract the title and poster from there.

### Source 3: Internal "Ghost" Data (Prior to Deletion)
If we have logs of the deleted documents (which we do in `plans/movie-audit.md`), we can correlate which Schedule ID belonged to which Metadata ID and recover the name from the V1 performance record.

---

## 5. Expected Outcome
1.  **UI Integrity**: All rows in the "Past Movies" table will show correct titles and grayscale posters.
2.  **Stable ID System**: The root `movies` collection will be fully populated with stable IDs, serving as a reliable Master Data Management (MDM) layer for the frontend.
3.  **No New Gaps**: The patches already applied to the CLI ensure that future movies will always have their metadata fetched while they are still "active."

---

## 6. Next Steps
1.  [ ] Develop the `restoration_backfill.py` script.
2.  [ ] Run in `--dry-run` to see how many titles can be recovered.
3.  [ ] Execute restoration.
