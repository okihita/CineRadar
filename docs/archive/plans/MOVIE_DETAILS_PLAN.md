# Movie Details Enrichment Plan

## Goal
Enrich CinePoint movie catalog with rich details from `/movies/detail?id=` endpoint:
casts, directors, producers, writers, description, language, trailer, rating_category,
user_ratings distribution, playing_at (cinemas), similar_movies, IMDb/RT scores.

## Pilot Scope
- 5 movies fetched, stored, and surfaced in the dashboard
- UI design for movie detail drill-down

## Firestore Schema

### Option: Enrich `cinepoint_movies` (chosen)
Add fields directly to existing `cinepoint_movies/{movieId}` docs. No new collection needed.
The detail endpoint returns ALL fields including ones we already have — we just add the new ones.

**New fields added to `cinepoint_movies/{movieId}`:**
```
casts: [                       // CinePoint provides arrays of names per role
  { role: "casts", names: ["Joe Taslim", ...] },
  { role: "directors", names: ["Simon McQuoid"] },
  { role: "producers", names: ["James Wan", ...] },
  { role: "writers", names: ["Jeremy Slater"] }
]
description: string            // Full synopsis in Bahasa Indonesia
language: string               // "English", "Indonesia"
trailer_url: string | null     // YouTube link
rating_category: string[]      // ["17+"], ["13+"]
user_ratings: [                // Distribution 1-10
  { rating: "1", value: 0 },   // value = percentage
  ...
  { rating: "10", value: 13.1 }
]
playing_at: [                  // Cinema chains showing this movie
  { title: "CGV Cinemas", image: "...", link: "..." }
]
similar_movies: [              // Related movie IDs
  { id: 686, title: "...", image_title: "...", description: "..." }
]
movie_rating: {                // External ratings
  imdb: number | null,
  rotten_tomatoes: number | null
}
production_status: string      // "released", "upcoming"
comparison: [...]              // Box office comparison vs other movies
details_fetched_at: string     // ISO timestamp — marks enrichment status
```

## Enrichment Script

### `scripts/cinepoint_enrich.py`
- Python (uv run), like backfill script
- Reads all movies from `cinepoint_movies` where `details_fetched_at` is null or stale
- Fetches `/movies/detail?id=` for each (3s delay between requests)
- Merges new fields into existing doc
- Content hash for idempotent re-runs
- `--movie-id 3965` for single movie pilot
- `--all` for full catalog enrichment
- `--stale-days 7` to re-fetch details older than N days

## Auth
- Refresh token stored in env (`CINEPOINT_REFRESH_TOKEN`)
- Auto-refreshes access token (24h validity) during script execution
- Refresh token valid ~14 days

## API Route
- `GET /api/competitors/cinepoint/movies/{id}/detail` — returns enriched movie from Firestore
- Or just include enriched fields in existing catalog response

## UI Design

### Movie Detail Drill-Down (in Dashboard)
When user clicks a movie in the rankings table → expand or navigate to detail view:

1. **Movie Header Card**
   - Poster image + title + genre badges + rating category badge
   - Language, duration, release date
   - Score (large) with user rating distribution mini-chart
   - IMDb / RT scores if available

2. **Synopsis**
   - Full description text

3. **Cast & Crew**
   - Directors, Writers → bold names
   - Cast → grid of names
   - Producers → smaller text

4. **Trailer**
   - Embedded YouTube thumbnail link

5. **Where to Watch**
   - Cinema chain logos (playing_at)

6. **Similar Movies**
   - Cards with poster, title, description

7. **Rating Distribution**
   - Bar chart (1-10 with percentages)

8. **Business Insight**
   - How does this movie compare to similar movies in the same genre?
   - Director's track record (other movies in our data)
   - Audience sentiment from user_ratings

## Execution Order
1. ✅ Fetch pilot data (5 movies) — DONE
2. Write enrichment Python script
3. Run pilot enrichment on 5 movies → Firestore
4. Add types for enriched fields
5. Build API route for enriched movie detail
6. Build movie detail drill-down UI in insights dashboard
7. Iterate on UX based on real data
