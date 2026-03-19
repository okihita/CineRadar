# Performances V2 Migration Plan

## 1. Objective
Mirror the functionality and user interface of the existing `performances` module into the `performances_v2` module. The new module will display the exact same views (Dashboard, Movie Detail, Daily Detail) but will pull data from the V2 data architecture (`movie_performance_v2` and `movies` collections) rather than the legacy `movie_performance` collection.

## 2. Data Source Differences
| Feature | Legacy (`movie_performance`) | V2 (`movie_performance_v2`) |
| :--- | :--- | :--- |
| **Document ID** | `movie_id` (TixID Schedule ID) | `metadata_id` (Internal Movie ID) |
| **Root Document Data** | Contains movie metadata (title, poster, age_category, genres) + aggregate stats | Only contains aggregate stats (`last_swept_at`, `total_sold`, `total_seats`). Movie metadata must be joined from the `movies/{metadata_id}` collection. |
| **Subcollections** | `days/{date}` (Daily stats) <br> `days/{date}/showtimes/{showtime_id}` | `days/{date}` (Daily stats) <br> `days/{date}/showtimes/{showtime_id}` |

## 3. Implementation Strategy: "Clean Duplication"

Since the legacy V1 module will be deleted in the near future, we will adopt a **Clean Duplication** strategy. Instead of parameterizing the existing V1 components with convoluted logic, we will duplicate the features and update them for V2. 

**Benefits:**
- **Zero Risk:** Changes to V2 won't accidentally break V1 during the transition period.
- **Clean Cleanup:** Deleting V1 later will be as simple as deleting the `features/performances`, `app/performances`, and `app/api/performance` directories without untangling parameters.
- **Type Safety:** The V2 data shape is different. Duplication allows us to cleanly type the V2 components without creating messy type unions.

### 3.1 Duplicating UI Components
We will duplicate the existing `features/performances` directory into a new `features/performances_v2` directory.

**Changes required in duplicated components:**
1. Update all hardcoded API fetch URLs from `/api/performance` to `/api/performance_v2`.
2. Update all hardcoded routing paths (e.g., `router.push('/performances')`, `<Link href="/performances">`) to use `/performances_v2`.
3. Adjust local TypeScript interfaces to match the V2 API responses (especially utilizing `metadata_id` as the primary identifier instead of `movie_id`).

### 3.2 Updating API Endpoints for V2
We will create parallel API endpoints under `app/api/performance_v2/` that mirror the responses of the V1 endpoints but fetch from V2 collections.

1. **`GET /api/performance_v2`** (Already partially implemented)
   - Fetches root documents from `movie_performance_v2`.
   - Joins metadata from `movies`.
   - Fetches today's stats from `movie_performance_v2/{metadata_id}/days/{today}`.

2. **`GET /api/performance_v2/[metadataId]/route.ts`** (To be created)
   - Fetches aggregate stats from `movie_performance_v2/{metadataId}`.
   - Fetches movie metadata from `movies/{metadataId}`.
   - Merges them to match the `summary` object format expected by the UI.

3. **`GET /api/performance_v2/[metadataId]/history/route.ts`** (To be created)
   - Fetches all documents from `movie_performance_v2/{metadataId}/days`.
   - Returns them sorted by date descending.

4. **`GET /api/performance_v2/[metadataId]/days/[date]/route.ts`** (To be created)
   - Fetches showtimes from `movie_performance_v2/{metadataId}/days/{date}/showtimes`.
   - Returns the showtimes array.

*(Note: The `PATCH /api/performance/[movieId]` route for marketing metadata may also need a V2 equivalent depending on feature requirements, but primary focus is on read operations).*

### 3.3 Creating V2 Pages
We will create the Next.js page components in the `app/performances_v2/` directory that simply consume the duplicated feature components from `features/performances_v2`.

1. **`app/performances_v2/page.tsx`**
   - Renders `<PerformanceTab />` from V2 features.

2. **`app/performances_v2/[metadataId]/page.tsx`**
   - Renders `<PerformanceDetail movieId={params.metadataId} />` from V2 features.

3. **`app/performances_v2/[metadataId]/[date]/page.tsx`**
   - Renders `<DailyPerformanceDetail movieId={params.metadataId} date={params.date} />` from V2 features.

## 4. Execution Steps
1. **Duplicate Features**: Copy `features/performances` to `features/performances_v2`.
2. **Update Paths & Types**: Search and replace `/performances` with `/performances_v2` and `/api/performance` with `/api/performance_v2` within the new `features/performances_v2` folder.
3. **Build V2 API Routes**: Implement the missing endpoints (`[metadataId]`, `history`, and `days/[date]`) in `app/api/performance_v2`.
4. **Build V2 Pages**: Create the pages in `app/performances_v2` using the new duplicated components.
5. **Validation**: Test `/performances_v2` side-by-side with `/performances` to ensure UI, charts, and routing behave identically, with data grouped correctly by `metadata_id`.
6. **Future Cleanup**: Once V2 is verified and deployed, delete V1 directories (`app/performances`, `app/api/performance`, `features/performances`).