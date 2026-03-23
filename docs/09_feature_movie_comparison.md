# Feature Specification: Head-to-Head Movie Comparison

## 1. Overview & Objective
The "Head-to-Head Movie Comparison" feature introduces a dedicated interface in CineRadar allowing users to directly compare the performance metrics of multiple movies side-by-side. The primary focus of this comparison will be on **admissions (seat occupancy)** and **showtimes (screen allocations)**. This will provide actionable insights into how different movies are performing relative to their scheduling footprint over time.

## 2. User Stories
* **Selection:** As a user, I want to search and select up to 6 movies simultaneously so that I can compare their performance without cluttering the screen.
* **Admissions Comparison:** As a user, I want to view a timeline chart comparing the total daily admissions between the selected movies.
* **Showtimes Comparison:** As a user, I want to view a timeline chart comparing the total daily showtimes allocated to the selected movies to understand studio/cinema allocation strategies.
* **Day-by-Day Progression:** As a user, I want to see a detailed table showing raw admissions and showtime counts per day for all selected movies.
* **Summary Metrics:** As a user, I want to see summary statistics (e.g., Average Admissions per Showtime, Total Admissions, Total Showtimes) side-by-side for a specific date range.
* **Time Filtering:** As a user, I want to filter the comparison by specific date ranges (e.g., Last 7 Days, Month to Date, or Custom Range).

## 3. UI/UX Design (Web)
* **Location:** A new dedicated route: `/compare` (accessible from the main global navigation).
* **Components & Layout:**
  * **Control Panel (Top):** 
    * **Movie Selector:** A multi-select autocomplete search bar querying movie metadata. Selected movies appear as colored chips (each movie gets a distinct, consistent color used across all charts and tables). Supports up to 6 movies.
    * **Date Range Picker:** Standard start/end date selection to constrain the dataset.
  * **Key Metrics Dashboard:** Side-by-side tabular or card view displaying cumulative stats for the selected period:
    * Total Showtimes
    * Total Admissions
    * Admissions per Showtime (Efficiency)
    * Overall Occupancy Rate (%)
  * **Day-by-Day Progression Table:** A detailed tabular view of raw daily metrics (Admissions / Showtimes) for granular comparison.
  * **Time-Series Charts (Main Body):**
    * *Admissions Over Time:* Multi-line chart (linear type) where each line represents a movie's daily admissions.
    * *Showtimes Over Time:* Multi-line chart (linear type) showing daily showtime counts.
    * *Occupancy Rate (%):* Multi-line chart (linear type) tracking percentage of seats sold vs. capacity over time.

## 4. Data Requirements & Backend Architecture
The core data already resides in the Firestore `movie_performance_v2` collections.

**Data Sources:**
* `movie_performance_v2/{metadata_id}/days/{date}/DailyPerformance`: Contains the pre-aggregated daily stats (admissions, total seats, total showtimes) needed for this feature.
* `schedules_v2/{date}/movies/{metadata_id}`: Used for initial movie search and metadata (Title, Poster).

**Backend Implementation (Next.js API Route):**
To ensure the client remains lightweight and secure, data aggregation will occur in a dedicated Next.js API route using the Firebase Admin SDK.
* **Endpoint:** `GET /api/compare?movies={id1,id2,id3,id4,id5,id6}&startDate={YYYY-MM-DD}&endDate={YYYY-MM-DD}`
* **Logic:**
  1. Validate incoming `movies` (max 6 IDs) and date formats.
  2. For each requested `metadata_id`, perform a query on its `days` subcollection constrained by `startDate` and `endDate`.
  3. Extract the `DailyPerformance` aggregation documents.
  4. Transform the disparate Firestore documents into a unified, chart-friendly JSON array (e.g., grouped by date, or flattened with clear movie identifiers).

## 5. Technical Implementation Details (Frontend - Next.js)
* **Routing:** Create `admin/src/app/compare/page.tsx` as the main entry point.
* **State Management:** Bind the selected movies and date range directly to the URL Search Parameters (e.g., `?m=id1,id2&start=2026-03-01&end=2026-03-22`). This ensures comparisons are bookmarkable and shareable.
* **Data Fetching:** Utilize SWR to fetch data from `/api/compare`.
* **Charting:** Use Recharts to render the multi-line graphs (linear type for direct point-to-point visualization). Explicit hex colors are used for SVG rendering reliability.

## 6. Edge Cases & Error Handling
* **Asynchronous Release Dates:** Movies released on different dates will have missing data points in a shared date range. The charts must gracefully handle `null` or missing values without breaking line continuity or crashing.
* **Selection Limits:** Hard limit the UI to 6 selected movies to prevent cognitive overload, chart illegibility, and excessive database reads.
* **Disambiguation:** The autocomplete search must display release years or thumbnail posters to prevent confusion between movies with identical titles.
* **Chart Rendering in Tabs:** Explicit height/width containers are used for Recharts to prevent collapse when rendered inside initially hidden `TabsContent`.
* **Cost / Read Optimization:** Since historical daily summaries are immutable, aggressive caching should be applied to the `/api/compare` endpoint to minimize Firestore read costs.

## 7. Testing Strategy
* **Backend / API:** Unit test the `/api/compare` route to ensure it correctly maps Firestore data to the expected JSON schema and handles missing days/movies correctly.
* **Frontend Components:** Unit test the Movie Selector to ensure it enforces the 4-movie limit and properly pushes updates to the URL parameters.
* **Integration/E2E:** Automate a flow that navigates to `/compare`, adds two distinct movies, selects a date range, and verifies that the chart DOM elements render without throwing React errors.

## 8. Rollout Plan
1. **Phase 1: API & Data Layer:** Develop, test, and deploy the `/api/compare` endpoint. Verify Firestore indexes support the required queries.
2. **Phase 2: UI Skeleton & State:** Build the `/compare` page, the movie search/selector component, and wire up the URL state synchronization.
3. **Phase 3: Visualization Integration:** Implement the charts and metrics cards, hooking them up to the API data.
4. **Phase 4: Polish & Review:** Add loading states (skeletons), empty states, error boundaries, and ensure mobile responsiveness before final release.