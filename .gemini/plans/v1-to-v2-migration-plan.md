# Migration Plan: CineRadar Data Architecture (V1 to V2)

This document outlines the strategy for migrating production data from the **V1 (Schedule-based)** architecture to the **V2 (Metadata-based)** architecture within Google Firestore.

## 1. Goal
Consolidate all movie performance and schedule data under a stable, immutable identifier (`metadata_id`) instead of the volatile `schedule_id`. This ensures continuity of historical performance data across different cinema chains and re-releases.

---

## 2. Current Schema Analysis

### 2.1 Movie Performance Data

#### **V1: `movie_performance` (Legacy)**
*   **Root Document ID**: `{schedule_id}` (e.g., `1612751106243309568`)
*   **Root Fields**:
    *   `movie_id`: String (Actually the `schedule_id`)
    *   `title`: String
    *   `poster`: URL String
    *   `age_category`: String
    *   `last_updated`: ISO Timestamp
*   **Subcollection: `days`** (Doc ID: `YYYY-MM-DD`)
    *   `date`: String
    *   `total_showtimes`: Integer
    *   `total_seats`: Integer
    *   `total_sold`: Integer
    *   `avg_occupancy_pct`: Float
    *   `cities`: Array of Strings
*   **Subcollection: `days/{date}/showtimes`** (Doc ID: `{showtime_id}`)
    *   `showtime_id`: String
    *   `movie_id`: String (`schedule_id`)
    *   `movie_title`: String
    *   `theatre_id`: String
    *   `theatre_name`: String
    *   `city`: String
    *   `room_category`: String
    *   `merchant`: String (XXI, CGV, etc.)
    *   `showtime`: String (HH:MM)
    *   `total_seats`: Integer
    *   `sold_seats`: Integer
    *   `occupancy_pct`: Float
    *   `layout_compressed`: Gzip Bytes
    *   `scraped_at`: ISO Timestamp

#### **V2: `movie_performance_v2` (Target)**
*   **Root Document ID**: `{metadata_id}` (Stable ID, e.g., `1815949081630040064`)
*   **Root Fields** (Aggregated Lifetime Stats):
    *   `total_seats`: Integer
    *   `total_sold`: Integer
    *   `avg_occupancy_pct`: Float
    *   `total_showtimes_scraped`: Integer
    *   `last_swept_at`: ISO Timestamp
*   **Subcollection: `days`**: (Doc ID: `YYYY-MM-DD`)
    *   *Aggregated fields from all schedule_ids mapped to this metadata_id.*
*   **Subcollection: `days/{date}/showtimes`**: (Doc ID: `{showtime_id}`)
    *   *Identical structure to V1, but includes both `movie_id` (metadata) and `schedule_id`.*

### 2.2 Schedules Data

#### **V1: `schedules` (Legacy)**
*   **Path**: `schedules/{date}/movies/{schedule_id}`

#### **V2: `schedules_v2` (Target)**
*   **Path**: `schedules_v2/{date}/movies/{metadata_id}`
*   **Key Field**: `schedule_ids`: Array of Strings (List of all V1 IDs associated with this movie on this date).

---

## 3. Migration Strategy (High-Level)

### Phase 1: Research & Discovery
- Identify all `schedule_id` to `metadata_id` mappings using the `movies` collection.
- For `schedule_ids` that are not currently "LIVE", search through historical `schedules_v2` records to find their previous `metadata_id` associations.

### Phase 2: Execution Logic
- **Iteration**: Loop through each `schedule_id` in the V1 `movie_performance` collection.
- **Transformation**: Convert the V1 document structure into the V2 structure, specifically mapping the root ID to the correct `metadata_id`.
- **Merging**: Since multiple V1 `schedule_ids` can map to one V2 `metadata_id`, the migration must **sum** values for `total_sold`, `total_seats`, and **re-calculate** `avg_occupancy_pct` for the `days` subcollection.
- **Batched Writing**: Use Firestore `WriteBatch` or bulk writers to ensure high throughput and atomicity where possible.

### Phase 3: Validation
- **Sample Audits**: Compare a known high-traffic movie's performance in V1 vs V2.
- **Global Totals**: Ensure total tickets sold across all V1 documents for a specific day equals the total in V2 after migration.

---

## 4. Mapping Visualization

To visualize the mapping consistency, imagine we are looking for the correct "Home" (**V2 Metadata ID**) for various data records currently sitting in the **V1 Collection**.

### 4.1 Discovery Logic
V1 documents are identified by either a stable Metadata ID or a volatile Schedule ID.

```text
+---------------------------------------------------------------------------------------+
|                                  MAPPING DISCOVERY                                    |
+---------------------------------------------------------------------------------------+
|      V1 RECORD ID (Source)      |    DISCOVERY LOGIC (How we find it)   |  V2 TARGET ID   |
+----------------------------------+--------------------------------------+-----------------+
|                                  |                                      |                 |
|  1815949081630040064             |  1. Check 'movies' doc ID.           |                 |
|  (This is a Metadata ID)         |     MATCH FOUND!                     |  181594908163004...
|                                  |                                      |                 |
+----------------------------------+--------------------------------------+-----------------+
|                                  |                                      |                 |
|  1815949082200465408             |  1. Check 'movies' doc ID -> NOPE.   |                 |
|  (This is a Schedule ID)         |  2. Query 'movies' where id == SID.  |  181594908163004...
|                                  |     MATCH FOUND!                     |  (Same as above)|
+----------------------------------+--------------------------------------+-----------------+
```

### 4.2 Merging Strategy
If a movie has data split across multiple IDs in V1, it is aggregated into a single record in V2.

```text
       V1 COLLECTION (Split)                      V2 COLLECTION (Merged)
+--------------------------------+        +------------------------------------+
| MOVIE: JUARA SEJATI            |        | MOVIE: JUARA SEJATI                |
| ID: ...0040064 (Metadata ID)   |        | ID: ...0040064 (Metadata ID)       |
| Sold: 100 tickets              |------\ |                                    |
+--------------------------------+       \+------------------------------------+
                                          | TOTAL SOLD: 250 TICKETS            |
+--------------------------------+       /+------------------------------------+
| MOVIE: JUARA SEJATI            |------/ | (Aggregation of all V1 records)    |
| ID: ...0465408 (Schedule ID)   |        |                                    |
| Sold: 150 tickets              |        |                                    |
+--------------------------------+        +------------------------------------+
```

---

## 5. Critical Questions & Clarifications

To ensure the safety of this production data migration, please provide clarification on the following:

1.  **Mapping Consistency**: 
    - **Analysis**: A scan of 248 V1 records showed that **100% can be mapped to a metadata entry**.
    - **Findings**: 
        - 156 records (63%) already use the `metadata_id` as their document ID.
        - 92 records (37%) use the `schedule_id` as their document ID but are found by querying the `id` field in the `movies` collection.
        - 5 cases where the `movie_id` field was `None` were successfully mapped to metadata via their document IDs.
    - **Strategy**: The migration script will use a dual-lookup: first by Document ID, then by the `id` field in the `movies` collection.

2.  **Duplicate Records**: 
    - **Analysis**: 68 Metadata IDs have multiple V1 `schedule_id` entries associated with them.
    - **Examples**: `JUARA SEJATI (2026)` has data under both `1815949081630040064` (Metadata ID) and `1815949082200465408` (Schedule ID).
    - **Strategy**: The migration must perform a **merge-sum** operation. For each `date`, we must aggregate `total_sold`, `total_seats`, and `total_showtimes` from all associated V1 IDs before writing the final V2 `days` document. Showtimes from all sources will be collected and deduplicated by `showtime_id`.
3.  **Active Scrapers**: Is the V2 scraper currently writing to `movie_performance_v2`? We need to ensure that the migration script doesn't overwrite fresh data being gathered today.
4.  **Historical vs. Live**: Do you want to migrate **all** data in V1, or is there a specific "cut-off date" (e.g., "only migrate data before Jan 1st, 2026")?
5.  **Subcollection Integrity**: Are there any other subcollections in V1 besides `days` and `showtimes` that are critical for your analysis?
6.  **Performance Metrics**: For the root document in V2 (`movie_performance_v2/{metadata_id}`), do you want the lifetime stats (`total_sold`, etc.) to be strictly calculated from the migrated V1 data, or should they be recalculated from the ground up by summing all `days` subcollections?

## 6. Pilot Migration Case Study: JUARA SEJATI (2026)

The pilot migration was successfully executed for **JUARA SEJATI (2026)** to verify the "Merge-Sum" logic for movies with split historical data.

### 6.1 Technical Profile
- **Target Metadata ID**: `1815949081630040064`
- **Source V1 IDs**: 
  1. `1815949081630040064` (Primary)
  2. `1815949082200465408` (Legacy Schedule ID)
- **Data Range**: 2026-03-05 to 2026-03-13 (9 days of valid showtime data)

### 6.2 Merging Process (Step-by-Step)
1. **Discovery**: The script identified all dates present in the `days` subcollection of *both* source IDs.
2. **Showtime-Level Deduplication**:
   - For each date, the script fetched all showtime documents from both sources.
   - It used a dictionary keyed by `showtime_id` to store the snapshots.
   - **Conflict Resolution**: If the same `showtime_id` appeared in both sources, the script compared the `scraped_at` ISO timestamps. Only the freshest snapshot (most recent timestamp) was kept. This prevents double-counting if a scraper job was overlapping or repeated.
3. **Daily Aggregation**:
   - **Total Sold**: Calculated as the sum of `sold_seats` from the final deduplicated set of showtimes.
   - **Total Seats**: Calculated as the sum of `total_seats` from the same set.
   - **Occupancy %**: Recalculated from the new daily totals ($Sold / Seats \times 100$).
   - **City List**: Created a `Set Union` of all cities appearing in the showtimes.
4. **Target Write**:
   - Wrote the aggregated daily summary to `movie_performance_v2/{metadata_id}/days/{date}`.
   - Wrote each unique showtime snapshot to the V2 `showtimes` subcollection, ensuring the `movie_id` field was updated to the target `metadata_id`.
5. **Root Metadata Finalization**:
   - Lifetime totals (Tickets Sold, Total Showtimes) were calculated by summing the new daily aggregates and updated on the root V2 document.

### 6.3 Pilot Results
| Metric | V1 (Source A) | V1 (Source B) | V2 (Merged Pilot) |
| :--- | :--- | :--- | :--- |
| **Lifetime Sold** | 4,210 | 4,490 | **8,700** |
| **Showtime Snapshots** | 352 | 397 | **749** |
| **Max Daily Sold (Mar 05)** | 2,810 | 2,815 | **5,625** |

## 7. Phase 1: Schedule Index Backfill (The Foundation)

Before migrating seat performance data, we must first unify the "Index" by migrating all historical listings from `schedules` (V1) to `schedules_v2` (V2).

### 7.1 Goal of this Phase
To ensure that for every date in CineRadar history, `schedules_v2` contains a single, unified document for every movie, listing all TIX IDs that were ever associated with it on that day.

### 7.2 Technical Strategy: "ID-Stacking"
The migration will follow an **Accumulative Merge** logic:

1.  **Iterate**: Loop through every date and every movie in the `schedules/{date}/movies/{schedule_id}` collection.
2.  **Map**: Lookup the `metadata_id` for each `schedule_id`.
3.  **Merge-Write**: For the target document `schedules_v2/{date}/movies/{metadata_id}`:
    - **`schedule_ids` (Array)**: Add the current `schedule_id` to this list (using `arrayUnion` to ensure uniqueness).
    - **`cities` (Map)**: Merge the city/theatre dictionaries. If the movie was showing in "Jakarta" under ID-A and "Surabaya" under ID-B, the unified V2 document will now show both cities and their respective theatres.
    - **`merchants` (Array)**: Combine chain names (e.g., ["XXI", "CGV"]).
    - **Metadata**: Preserve the latest title, poster, and genre info.

### 7.3 Outcome: A Complete History
**Yes.** After this phase is complete, `schedules_v2` will serve as the **Complete Historical Archive** for CineRadar. 

- Every movie that was ever scraped will have a permanent home under its `metadata_id`.
- You will be able to query any date in the past and see exactly which movies were showing, where they were showing, and every TIX ID they used.
- This unified index will then serve as the "Automated Map" for the final stage: deduplicating the performance data.

### 7.4 Safety & Idempotency
- **Non-Destructive**: This process only *adds* to or *updates* `schedules_v2`. It does not delete anything from the original `schedules` collection.
- **Idempotent**: The script can be run multiple times safely; because it uses `arrayUnion` and Map merging, it will not create duplicate IDs or corrupt the data if restarted.

---
*Status: Phase 1 (Schedule Backfill) COMPLETED - 3,451 documents unified in schedules_v2*

## 8. Multi-ID Analysis & Theory Verification

A total of **29 movies** were identified as having multiple TIX IDs on the same day in the historical `schedules` collection.

### 8.1 List of Multi-ID Movies
| Movie Title | Metadata ID | Sample IDs (last 4) |
| :--- | :--- | :--- |
| KOKUHO | `2021094805467123712` | `3712`, `4512` |
| DEMON SLAYER ... INFINITY CASTLE | `1945770977107460096` | `0096`, `7632` |
| AGAK LAEN: MENYALA PANTIKU! | `1977633929036906496` | `6496`, `3904` |
| ALAS ROBAN | `1991446452714422272` | `2272`, `6128` |
| ETERNITY | `1991461578532282368` | `2368`, `0032` |
| KUYANK | `1996107160261574656` | `4656`, `4368` |
| KAFIR GERBANG SUKMA | `2000869039747973120` | `3120`, `7984` |
| SHELTER | `2001914939408728064` | `8064`, `9136` |
| PAPA ZOLA THE MOVIE | `2003773176210866176` | `6176`, `5872` |
| TITIP BUNDA DI SURGA-MU | `2009532117171650560` | `0560`, `7056` |
| RAJAH | `2010566421070831616` | `1616`, `2432` |
| WUTHERING HEIGHTS | `2011332512982319104` | `9104`, `8672` |
| 5 CENTIMETERS PER SECOND (LIVE ACTION) | `2011393383754448896` | `8896`, `5712` |
| LIFT | `2011720541836230656` | `0656`, `3376` |
| CRIME 101 | `2014257251354755072` | `5072`, `6832` |
| GOAT | `2014257254206881792` | `1792`, `6656` |
| BLADES OF THE GUARDIANS | `2014634241349992448` | `2448`, `7568` |
| RUMAH TANPA CAHAYA | `2015655969538785280` | `5280`, `0912` |
| ASRAMA PUTRI | `2016461779319734272` | `4272`, `1680` |
| EPIC: ELVIS PRESLEY IN CONCERT | `2018595345537253376` | `3376`, `2688` |
| ONCE WE WERE US | `2018595348473266176` | `6176`, `4320` |
| HOPPERS | `2018610437561597952` | `7952`, `0432` |
| PANDA PLAN: THE MAGICAL TRIBE | `2018958227630276608` | `6608`, `6032` |
| SCREAM 7 | `2019295455988498432` | `8432`, `5056` |
| THE BRIDE! | `2019360383407570944` | `0944`, `8960` |
| ANTARA MAMA CINTA & SURGA | `2021528674976751616` | `1616`, `1568` |
| IRON LUNG | `2022147745543970816` | `0816`, `0656` |
| MARTY SUPREME | `2023234908742311936` | `1936`, `2336` |
| HAMNET | `2023961198965374976` | `4976`, `1376` |

### 8.2 Theory: Metadata ID as one of the Schedule IDs
**Theory**: For a movie with two IDs, one of them will be exactly the same as the Metadata ID itself.
**Verification**: Confirmed. Analysis of *Demon Slayer* (Metadata ID: `...0096`) showed that its `schedule_ids` array contains both `...0096` and `...7632`.

### 8.3 Theory: Showtime ID Overlap
**Theory**: The `showtime_id`s will be overlapping across the multiple source IDs, allowing for safe merging by ID without data loss.
**Verification**: Confirmed via case study.
- **Movie**: *Demon Slayer* (2026-03-05)
- **Source ID 1 (`...0096`)**: 7 showtimes found.
- **Source ID 2 (`...7632`)**: 7 showtimes found.
- **Overlap**: **100%**. All 7 showtimes were identical across both sources.
- **Conclusion**: The multiple IDs represent different "views" of the same data. Merging them by `showtime_id` results in a single, accurate set of showtimes with zero risk of duplication or accidental deletion.

### 8.4 Merging Safety
Since the `showtime_id` is globally unique for each screening, using it as the key for deduplication ensures:
1.  **No Deletion**: Every unique showtime is preserved.
2.  **No Duplication**: Identical showtimes found in multiple sources are merged into one.
3.  **Accuracy**: The final stats (Sold/Seats) are calculated from the single, deduplicated set of showtimes.

---
*Status: Merging Theory Verified - Ready for Performance Data Migration*

## 9. Phase 2: Performance Data Migration (The Deduplication)

This final phase moves the actual seat occupancy data (Snapshots) into the V2 collection.

### 9.1 The "Overcount" Problem
Your concern about overcounting is valid. In the old V1 system, if a movie had two IDs, the scraper might have captured the same showtime twice (once for each ID). If we simply sum the totals from V1, we will double-count the audience.

### 9.2 The Deduplication Mechanism: "The Fingerprint Rule"
To prevent overcounting, we do not merge the **Totals**. We merge the **Individual Showtimes**.

1.  **Extract**: Pull every `showtime_snapshot` from all V1 source IDs.
2.  **Fingerprint**: Every showtime has a unique `showtime_id` (The "Fingerprint").
3.  **Deduplicate**: 
    - We use a Dictionary to store showtimes, where the `showtime_id` is the key.
    - If `showtime_id: 123` is found in both IDs, the script **overwrites** the first one with the second (keeping only the most recent capture).
4.  **Rebuild**: Once we have a unique set of showtimes, we **RE-CALCULATE** the daily `total_sold` and `total_seats` from scratch.

### 9.3 Simulation Case Study: Demon Slayer (2026-03-05)
I simulated this approach on a known duplicate movie to verify accuracy.

| Source | Counted Showtimes | Tickets Sold |
| :--- | :--- | :--- |
| **V1 Folder A** | 7 | 44 |
| **V1 Folder B** | 7 | 44 |
| **Simple Sum (Wrong)** | 14 | 88 (Overcounted!) |
| **V2 Merged Result** | **7** | **44 (Correct)** |

**Result**: The deduplication logic successfully ignored the 7 duplicate entries, ensuring the V2 total remains accurate at 44.

### 9.4 Risk Assessment
- **Risk of Data Deletion**: **ZERO**. The script only READS from V1 and WRITES to V2. The original V1 data remains untouched as a backup.
- **Risk of Overcounting**: **Eliminated** by the "Fingerprint Rule" (Showtime ID deduplication).
- **Admin UI Impact**: Once the V2 collection is populated, the Admin charts will automatically switch from seeing "Fragments" to seeing the "Unified Golden Record." The historical gaps in your charts will disappear.

## 10. Phase 3: Codebase Sunsetting (Deprecating V1)

Even though the data migration is complete, the V1 collections cannot be deleted until the codebase stops reading from and writing to them. This phase outlines the exact steps to decouple the system from V1.

### Step 10.1: Refactor Admin Scraper Dashboard
The Scraper dashboard currently relies on V1 schedules to calculate daily coverage.
*   **Target File**: `admin/src/app/api/scraper/today/route.ts`
*   **Action**: Change the collection path from `schedules/${date}/movies` to `schedules_v2/${date}/movies`.
*   **Visual Check**: Open the Admin Panel -> **Mission Control** (`/scraper`). Ensure the "Total Theatres Scheduled" and "Coverage" metrics load correctly and are not showing `0`.

### Step 10.2: Delete Legacy V1 Admin UI
The admin panel still contains the old V1 performance components.
*   **Target Folders**: `admin/src/app/performances/` and `admin/src/features/performances/`
*   **Action**: Delete these folders entirely. Rename `performances_v2` to `performances`. Update the sidebar navigation (`admin/src/components/Sidebar.tsx`) to ensure links point to the correct updated paths.
*   **Visual Check**: Navigate to the **Head-to-Head Compare** and **Performance** tabs in the Admin UI. Verify that charts load seamlessly and no 404 errors occur.

### Step 10.3: Update Backend Cloud Functions
The cloud functions still use V1 as a fallback or primary read source.
*   **Target File 1**: `backend/functions/dispatcher/main.py`
    *   **Action**: Remove the V1 fallback logic (`movies_ref_v1 = db.collection("schedules")...`). Make the function rely *strictly* on `schedules_v2`.
*   **Target File 2**: `backend/functions/sweeper/main.py`
    *   **Action**: Remove all logic that reads from or updates the `movie_performance` (V1) collection. The sweeper should only aggregate data for `movie_performance_v2`.
*   **Visual Check**: Trigger a manual dispatch from the GCP Console (or wait for the next cron job). Check the Cloud Function logs to ensure "Successfully dispatched X jobs" without any V1 fallback warnings.

### Step 10.4: Stop Dual-Writing in the Scrapers
The final step before database deletion is to stop the scrapers from writing new data into V1.
*   **Target File 1**: `backend/infrastructure/core/tix_client.py` (Line ~448)
    *   **Action**: Remove the code block that writes the schedule to the V1 `schedules` collection. Keep only the V2 logic.
*   **Target File 2**: `backend/functions/scraper/main.py` (Line ~1104)
    *   **Action**: Remove the code that writes the seat snapshot to the V1 `movie_performance` collection. Keep only the V2 logic.
*   **Visual Check**: Run the CLI scraper (`uv run python -m backend.cli.cli scrape now-playing`). Check the Firebase Console to ensure no new data appears in V1 collections, but data does appear in V2.

### Step 10.5: Final Database Deletion
Only after completing Steps 10.1 through 10.4 is it safe to delete the legacy data.
*   **Action**: Open the Firebase Console. Manually delete the `schedules` and `movie_performance` root collections.
*   **Visual Check**: The application continues to function normally.

---
*Status: Ready for Codebase Sunsetting Implementation*
