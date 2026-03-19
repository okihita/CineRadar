# Performance V1 vs V2 Architecture Comparison

This document provides a technical mapping of how the Admin UI interacts with Firestore for both the legacy (V1) and current (V2) performance modules.

## Data Structure Overview

| Feature | Legacy (V1) | V2 (Standardized) |
|:---|:---|:---|
| **Root Collection** | `movie_performance` | `movie_performance_v2` |
| **Document ID** | `movie_id` (TixID Schedule ID) | `metadata_id` (Internal UUID/Numeric) |
| **Metadata Source** | Denormalized in `movie_performance` | Joined from `movies` collection |
| **Daily Stats** | `days/{date}` | `days/{date}` |
| **Showtimes** | `showtimes/` (Flat) OR `days/{date}/showtimes` | `days/{date}/showtimes` (Nested) |

---

## Page-by-Page Data Mapping

### 1. Performance Dashboard
**URL:** `/performances` (V1) vs `/performances_v2` (V2)

| Component | V1 Source (Firestore Path) | V2 Source (Firestore Path) | Logic Difference |
|:---|:---|:---|:---|
| **Movie List** | `movie_performance` | `movie_performance_v2` | V2 requires a secondary fetch/join with `movies`. |
| **Movie Title** | `doc.title` | `movies/{id}.title` | V2 joins metadata in the API layer. |
| **Movie Poster** | `doc.poster` | `movies/{id}.poster_url` | V2 joins metadata in the API layer. |
| **Today's Stats** | `movie_performance/{id}/days/{today}` | `movie_performance_v2/{id}/days/{today}` | Identical sub-path structure. |

### 2. Movie Detail (Aggregate History)
**URL:** `/performances/[id]` (V1) vs `/performances_v2/[id]` (V2)

| Component | V1 Source (Firestore Path) | V2 Source (Firestore Path) | Logic Difference |
|:---|:---|:---|:---|
| **Summary Card** | `movie_performance/{id}` | `movie_performance_v2/{id}` + `movies/{id}` | V2 merges stats and metadata. |
| **History Grid** | `movie_performance/{id}/days` | `movie_performance_v2/{id}/days` | Sorted by `date` descending. |
| **Trend Charts** | `movie_performance/{id}/days` | `movie_performance_v2/{id}/days` | Uses the same historical data points. |
| **Marketing Info**| `movie_performance/{id}.marketing` | `movie_performance_v2/{id}.marketing` | Editable via PATCH to root doc. |

### 3. Daily Detail (Seating Visualizer)
**URL:** `/performances/[id]/[date]` (V1) vs `/performances_v2/[id]/[date]` (V2)

| Component | V1 Source (Firestore Path) | V2 Source (Firestore Path) | Logic Difference |
|:---|:---|:---|:---|
| **Daily Stats** | `movie_performance/{id}/days/{date}` | `movie_performance_v2/{id}/days/{date}` | Summary stats for the specific day. |
| **Showtime List** | `movie_performance/{id}/days/{date}/showtimes` | `movie_performance_v2/{id}/days/{date}/showtimes` | The "heavy" fetch (streamed via Suspense). |
| **Seat Map Data** | `.../showtimes/{showtime_id}.layout_compressed` | `.../showtimes/{showtime_id}.layout_compressed` | Snapshot of the theatre state at that time. |

---

## Key API Route Comparison

| Endpoint | V1 Path | V2 Path | Join Logic |
|:---|:---|:---|:---|
| **List All** | `/api/performance` | `/api/performance_v2` | V2 joins `movie_performance_v2` + `movies`. |
| **Get Single** | `/api/performance/[id]` | `/api/performance_v2/[id]` | V2 joins stats with `movies` metadata. |
| **Get History** | `/api/performance/[id]/history` | `/api/performance_v2/[id]/history` | Direct subcollection fetch. |
| **Update** | `PATCH /api/performance/[id]` | `PATCH /api/performance_v2/[id]` | Updates the root performance document. |

---

## Summary of Migration Logic
The V2 implementation uses **Clean Duplication**, meaning `features/performances_v2` is a self-contained copy of the logic. The primary technical hurdle was the **Metadata Join**: 
- In V1, the movie title/poster were saved directly in the performance document.
- In V2, the performance document only contains raw numbers (`total_sold`, `total_seats`), so the API must perform a look-up in the `movies` collection using the `metadata_id` to retrieve user-friendly information.
