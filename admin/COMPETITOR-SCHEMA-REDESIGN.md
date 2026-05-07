# Plan: Competitor Schema Redesign & ETL Rebuild

## Problem Statement

Each date has two data points: **showtimes** and **admissions**. The admin needs to see at a glance whether each date is complete (both), partial (one), or missing (neither). The current schema uses flat sibling fields (`showtimes_raw`, `showtimes_parsed`, `showtimes_parsed_at`) with no structural grouping and no link back to the source tweet. The calendar and homepage derive coverage from the **tweets** collection (does a tweet with this `data_date` exist?) instead of the **snapshots** collection (does this date have both data points?).

## Schema Redesign

### Collection: `competitor_tweets/{tweet_id}` — immutable audit log

**No structural changes.** This collection is fine as-is. Add `data_date` field if missing (already exists on most documents).

```
{
  id: string,                          // tweet REST ID
  source_handle: string,               // "cinepoint_"
  source_name: string,                 // "Cinepoint app official account"
  source_avatar: string,               // avatar URL
  created_at: string,                  // Twitter format posting timestamp
  text: string,                        // cleaned tweet text
  tweet_type: "showtimes" | "admissions" | "other",
  data_date?: string,                  // "2026-05-05" extracted from header
  media_urls: string[],
  imported_at: string,                 // ISO timestamp
}
```

### Collection: `competitor_snapshots/{date}` — materialized view per content date

**Restructure from flat fields to nested objects.** Each data point (showtimes, admissions) becomes a self-contained object with its own metadata and source link.

```
{
  id: string,                          // "2026-05-05"
  date: string,                        // "2026-05-05"
  source: "cinepoint",

  showtimes: {                         // null if no showtimes data for this date
    raw: string,                       // "SHOWTIMES - SUN, 4/5/26\n#TungguAku..."
    parsed: [{ title_cp, showtimes, daily_change_pct, matched_movie_id?, matched_title? }],
    source_tweet_id: string,           // "2040935645766668794"
    updated_at: string,                // ISO timestamp
  } | null,

  admissions: {                        // null if no admissions data for this date
    raw: string,                       // "Estimated Admission - SUN, 4/5/26\n..."
    parsed: [{ title_cp, daily_admissions, daily_change_pct, cumulative_admissions, matched_movie_id?, matched_title? }],
    source_tweet_id: string,           // "2038654989665767643"
    updated_at: string,                // ISO timestamp
  } | null,
}
```

**Coverage is now trivially derived:**

| State | Condition |
|---|---|
| `complete` | `showtimes !== null && admissions !== null` |
| `showtimes_only` | `showtimes !== null && admissions === null` |
| `admissions_only` | `showtimes === null && admissions !== null` |
| `empty` | doc doesn't exist or both null |

## Files to Change

### Layer 1: Types (`types.ts`)

- Update `CompetitorSnapshot` interface: replace 6 flat fields (`showtimes_raw`, `showtimes_parsed`, `showtimes_parsed_at`, `admissions_raw`, `admissions_parsed`, `admissions_parsed_at`) with 2 nested objects (`showtimes`, `admissions`).
- Add `SnapshotDataPoint` interface for the nested structure.

### Layer 2: ETL / Write Path

**`lib/scrape-tweet.ts`** (tweet URL import):
- `scrapeAndImportTweet()`: write nested `showtimes: { raw, parsed, source_tweet_id, updated_at }` instead of flat fields.
- Preserve existing data point when updating only one (don't overwrite admissions when writing showtimes).

**`api/competitors/import/route.ts`** (bulk JSON import):
- Same nested write logic as scrape-tweet.

**`api/competitors/[date]/showtimes/route.ts`** (manual parse editing):
- Read/write under `snapshot.showtimes.raw`, `snapshot.showtimes.parsed` instead of flat fields.

**`api/competitors/[date]/admissions/route.ts`** (manual parse editing):
- Read/write under `snapshot.admissions.raw`, `snapshot.admissions.parsed` instead of flat fields.

**`api/competitors/[date]/match/route.ts`** (movie matching):
- Update `matched_movie_id` inside `showtimes.parsed[]` and `admissions.parsed[]` instead of flat fields.

### Layer 3: Read Path / API

**`api/competitors/route.ts`** (list snapshots):
- Check `s.showtimes?.parsed` and `s.admissions?.parsed` instead of flat fields.

**`api/competitors/trend/route.ts`** (30-day trend):
- Access `snap.showtimes?.parsed` and `snap.admissions?.parsed` with optional chaining.

**`api/competitors/[date]/route.ts`** (single date detail):
- Return `snapshot.showtimes` and `snapshot.admissions` as nested objects.

**`api/competitors/cumulative/route.ts`** (box office tracker):
- Access `snap.admissions?.parsed` with optional chaining.

**`api/competitors/tweets/route.ts`** (browse tweets):
- No changes needed. This reads from `competitor_tweets`, not snapshots.

### Layer 4: Frontend

**Calendar sidebar (`CalendarSidebar.tsx`):**
- Currently derives `availableDates` from tweets collection (via archive page grouping).
- Change to query snapshots for coverage: fetch `/api/competitors?days=90` and derive availableDates + per-date coverage status from snapshot data.
- Calendar dots: blue = complete, yellow/amber = partial (only one data point), red = missing.

**Archive page (`archive/page.tsx`):**
- `availableDates` derived from tweets grouping stays the same (archive is tweet-centric).
- But add a coverage indicator per date section header showing whether that date has both data points.

**Homepage nudge (`page.tsx`):**
- The missing-dates check already uses the trend API which reads snapshots. Just needs to account for the new nested structure.
- Consider showing partial dates differently from completely missing ones.

**Comparison engine (`comparison.ts`, `matching.ts`):**
- No logic changes needed. These operate on `CinePointShowtime[]` and `CinePointAdmission[]` arrays which don't change.

### Layer 5: Parsers (`parsers.ts`)

- No changes needed. The parser returns `ParsedImportResult` with `{ date, type, parsed, raw_text }` which maps directly to the nested structure.

## Implementation Order

### Step 1: Update types
- Edit `types.ts`: new `SnapshotDataPoint` interface, updated `CompetitorSnapshot`.
- Run `tsc --noEmit` — will get errors everywhere snapshots are used. Expected.

### Step 2: Update ETL write path
- Edit `scrape-tweet.ts`: write nested objects.
- Edit `import/route.ts`: write nested objects.

### Step 3: Update read APIs
- Fix all API routes to read from nested structure.
- Fix `tsc --noEmit` errors.

### Step 4: Update frontend
- Calendar sidebar: query snapshots for coverage.
- Homepage: update coverage logic.
- Archive page: add coverage badges per date section.

### Step 5: Clean up debug logs
- Remove `[scrape-tweet]` console.log/warn from `scrape-tweet.ts`.

### Step 6: Verify & commit
- `tsc --noEmit` clean.
- `eslint` clean.
- Manual test: import a tweet URL, verify Firestore document has nested structure.
- Commit.

## Firestore Data Migration

**You can safely delete both collections:**
- `competitor_snapshots` — will be rebuilt from scratch by re-importing tweets.
- `competitor_tweets` — will be rebuilt from scratch by re-importing tweets.

These two collections are **only used by the competitor feature** (not by theatres, movies, schedules, performance, scraper, social feed, or auth). Deleting them has zero impact on the rest of the admin.

**How to re-import after deletion:**
1. Use the "Paste Tweet URLs" flow in the archive sidebar or date detail page.
2. Paste the CinePoint tweet URLs one by one or in batches (up to 20 at a time).
3. Each URL fetches the tweet, parses it, and writes to both collections using the new nested schema.

**Tweets that need re-importing** (find them at https://x.com/cinepoint_):
- Look for tweets starting with "SHOWTIMES" or "ESTIMATED ADMISSION"
- Each day typically has 2 tweets: one showtimes, one admissions
- Tweets posted on date D+1 often contain data for date D (backdating)

## What NOT to Delete

The following collections are used by other features and must NOT be deleted:

| Collection | Used By |
|---|---|
| `admin_users` | Auth system |
| `theatres`, `studios` | Theatre management |
| `movies` | Movie registry |
| `schedules_v2` | Daily schedules |
| `movie_performance_v2` | Performance tracking |
| `scraper_logs` | Scraper monitoring |
| `beta_social_sources` | Social feed |
| `beta_social_posts` | Social feed |
| `beta_social_analysis` | Social feed |
