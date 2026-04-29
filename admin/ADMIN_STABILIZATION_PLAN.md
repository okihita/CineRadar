# CineRadar Admin — Stabilization & Simplification Plan

_Last audited: 2026-04-29_

---

## 1. Dead Code to Delete

### 1A. Dead Components & Hooks (~284 lines)

| File | Lines | Export | Notes |
|------|-------|--------|-------|
| `features/scraper/components/ScraperStatsCards.tsx` | 48 | `ScraperStatsCards` | Never imported |
| `features/scraper/components/TodayScrapeCards.tsx` | 122 | `TodayScrapeCards` | Never imported |
| `hooks/useCachedFetch.ts` | 114 | `useCachedFetch` | Never imported; has stale-closure bug |
| `features/cinemas/hooks/useCinemasData.ts` L36-55 | ~20 | `useCinemasData()` | Dead function; calls non-existent `/api/scraper/stats` |

Also remove their barrel re-exports:
- `features/scraper/index.ts` L13-14
- `hooks/index.ts` L4

### 1B. Dead Types (become dead after §1A)

| File | Type | Notes |
|------|------|-------|
| `features/scraper/types.ts` L7-12 | `CollectionStats` | No imports |
| `features/scraper/types.ts` L14-20 | `ScraperStats` | Only used by dead `ScraperStatsCards` |
| `features/scraper/types.ts` L22-28 | `MorningScrape` | Only used by dead `TodayScrapeCards` |
| `features/scraper/types.ts` L37-61 | `JITSummary` | Only used by dead `TodayScrapeCards` |
| `features/scraper/types.ts` L84-92 | `JITRunEntry` | Marked `@deprecated`; no imports |

### 1C. Dead Constants

| File | Export | Notes |
|------|--------|-------|
| `features/performances/types/social.ts` L22-44 | `SOCIAL_PLATFORMS` | Zero imports |

### 1D. Dead Service Exports

| File | Export | Notes |
|------|--------|-------|
| `services/theatreService.ts` L39 | `getScraperRuns` | Only called via `theatreService.getScraperRuns()` |
| `services/theatreService.ts` L40 | `getTheatres` | Only called via `theatreService.getTheatres()` |

### 1E. Sidebar Cleanup

`components/Sidebar.tsx` L23-30 — remove commented-out "V1 Performance" menu block. V1 is long gone.

---

## 2. Bug Fixes

### 2A. Debug console.log in Production (3 instances)

| File | Line | Statement |
|------|------|-----------|
| `app/api/performance/[metadataId]/route.ts` | L117 | `console.log('[PATCH marketing] updateData:', ...)` |
| `app/api/showtimes/[showtimeId]/raw/route.ts` | L159 | `console.log('[JIT Inference] Matched legacy...')` |
| `lib/firestore-rest.ts` | L472 | `console.log('[Firestore PATCH] ...')` |

**Action:** Remove or convert to `console.debug` gated behind `process.env.NODE_ENV === 'development'`.

### 2B. Duplicated `getTodayJakarta()` — Replaced by Local Copy

| File | Line | Issue |
|------|------|-------|
| `app/schedules/page.tsx` | L4-6 | Reimplements `getTodayJakarta()` locally instead of importing from `@/lib/timeUtils` |
| `app/api/scraper/today/route.ts` | L21 | Uses `'en-CA'` locale instead of `'sv-SE'` — works but inconsistent |
| `features/performances/components/ForensicHealthSheet.tsx` | L53 | Inline `new Date().toLocaleDateString(...)` instead of `getTodayJakarta()` |

**Action:** Replace all 3 with `import { getTodayJakarta } from '@/lib/timeUtils'`.

---

## 3. Type Consolidation

### 3A. Duplicated Types to Deduplicate

| Type | Canonical | Duplicate | Action |
|------|-----------|-----------|--------|
| `DiagnosticItem` | `types/performance.ts` L91-98 | `ForensicHealthSheet.tsx` L26-33 | Delete local, import |
| `DiagnosticItem` (as `DiagnosticEntry`) | `types/performance.ts` L91-98 | `app/api/performance/route.ts` L22-29 | Delete local, import |
| `VisSeatStatus` | `types/seat.ts` L35 | `BaseSeatMap.tsx` L9 | Delete local, import |
| `SortDirection` | New: add to `types/performance.ts` | 4 files define locally | Import from shared |

### 3B. Inline Types to Extract

| Type | Current File | Target |
|------|-------------|--------|
| `MovieDetailResponse` | `movies/components/MovieDatabaseDetail.tsx` L20 | New `features/movies/types.ts` |
| `UnifiedMovie` | `movies/components/MovieDatabaseList.tsx` L21 | New `features/movies/types.ts` |
| `MovieDatabaseResponse` | `movies/components/MovieDatabaseList.tsx` L38 | New `features/movies/types.ts` |
| `FirestoreMovie` | `app/api/movies/route.ts` L12-26 | New `features/movies/types.ts` |
| `RawShowtimeResponse` | `app/api/showtimes/[showtimeId]/raw/route.ts` L66-79 | `types/performance.ts` |
| `RigidityStat`, `PricingStat`, `FormatStats`, `InsightData` | `cinemas/components/InsightsDashboard.tsx` L19-37 | New `features/cinemas/types.ts` |

---

## 4. Repeated Logic to Deduplicate

### 4A. Inline `.toFixed(1)` → `formatOccupancy()` (8 instances)

Files: `HistoryGrid.tsx` L142, `ShowtimeTable.tsx` L268/372/448, `NationalPulseHud.tsx` L55, `MarketMarketTable.tsx` L106, `RegionalCinemaTable.tsx` L117.

### 4B. Inline Compact Number → `formatCompactNumber()`

`HistoryGrid.tsx` L148 hand-rolls compact formatting (no "M" handling, no null guard).

### 4C. Inline Chain Color Lookups → `getChainColor()`

`ChainDistributionCard.tsx` L25, `TheatreFilters.tsx` L66, `TheatreSidebar.tsx` L109 — all do `CHAIN_COLORS[name as keyof typeof CHAIN_COLORS] || '#666'` instead of calling `getChainColor()`.

---

## 5. Large Components to Decompose (over 200 lines)

| # | File | Lines | Suggested Split |
|---|------|-------|-----------------|
| 1 | `movies/MovieDatabaseDetail.tsx` | 567 | Extract movie header, stats cards, schedule table |
| 2 | `scraper/DispatchTimeline.tsx` | 489 | Extract timeline entry component |
| 3 | `performances/ShowtimeTable.tsx` | 480 | Extract `ShowtimeRow` into own file |
| 4 | `CinemaRegistryMap.tsx` | 396 | Extract marker/pie chart logic |
| 5 | `movies/MovieDatabaseList.tsx` | 378 | Extract search/filter controls |
| 6 | `performances/social/EditMarketingModal.tsx` | 369 | Extract form field subcomponents |
| 7 | `cinemas/TheatreTable.tsx` | 283 | Extract row component |
| 8 | `cinemas/CinemaDetailView.tsx` | 283 | Extract header + studio list |
| 9 | `performances/ForensicHealthSheet.tsx` | 277 | Extract `StatItem`, `StatusPillDetailed` |
| 10 | `compare/page.tsx` | 272 | Extract data fetching into custom hook |
| 11 | `compare/CompareControlPanel.tsx` | 268 | Extract movie selector + date picker |
| 12 | `cinemas/InsightsDashboard.tsx` | 266 | Extract stat card components |

---

## 6. Documentation Gaps & Stale References

### 6A. API Reference (`docs/04_api_reference.md`)

**Only 1 of 21 endpoints documented.** Missing 20 endpoints. Add documentation for all routes listed in §9A of the audit.

### 6B. Stale Collection Names (affects 5 doc files)

| Doc File | Line(s) | Says | Should Be |
|----------|---------|------|-----------|
| `01_architecture_and_design.md` | L122, L272, L274 | `movie_performance`, `scraper_runs`, `schedules` | `movie_performance_v2`, `scraper_logs`, `schedules_v2` |
| `03_daily_pipeline.md` | L80, L131, L159 | `movie_performance` | `movie_performance_v2` |
| `06_troubleshooting.md` | L131 | `movie_performance/{id}/...` | `movie_performance_v2/{id}/...` |

### 6C. Non-Existent Directory Reference

`05_frontend_guidelines.md` L58 references `components/shared/` — this directory does not exist. Cross-page components live in `components/` directly.

### 6D. Wrong Movie Limit

`09_feature_movie_comparison.md` L62 says "4-movie limit" — code uses 6.

### 6E. Price Tier Inconsistency

`10_studio_layout_technical_specification.md` §4.1 L85 says 2 tiers — code and §2.1.2 use 3 tiers (`mon_thu`, `fri`, `sat_sun`).

---

## 7. Prioritized Execution Order

### Phase 1 — Zero-risk cleanup (delete dead code, ~400 lines)
- [ ] Delete `ScraperStatsCards.tsx`, `TodayScrapeCards.tsx`, `useCachedFetch.ts`
- [ ] Remove `useCinemasData()` from `useCinemasData.ts`
- [ ] Clean dead types from `features/scraper/types.ts`
- [ ] Remove `SOCIAL_PLATFORMS` from `types/social.ts`
- [ ] Remove dead service exports from `theatreService.ts`
- [ ] Remove commented V1 sidebar block

### Phase 2 — Quick fixes (bugs & consistency, ~30 min)
- [ ] Remove/convert 3 debug `console.log` statements
- [ ] Replace 3 inline `getTodayJakarta()` reimplementations with shared import
- [ ] Import `VisSeatStatus` from `types/seat.ts` in `BaseSeatMap.tsx`
- [ ] Import `DiagnosticItem` from `types/performance.ts` in `ForensicHealthSheet.tsx` and `api/performance/route.ts`
- [ ] Replace inline `.toFixed(1)` with `formatOccupancy()` in 8 places
- [ ] Replace inline chain color lookups with `getChainColor()` in 3 places

### Phase 3 — Type extraction (low risk, ~1 hour)
- [ ] Create `features/movies/types.ts` — extract 4 inline types
- [ ] Create `features/cinemas/types.ts` — extract 4 inline types
- [ ] Add `SortDirection` to `types/performance.ts`, update 4 files
- [ ] Move `RawShowtimeResponse` to `types/performance.ts`

### Phase 4 — Component decomposition (medium effort, per-file)
- [ ] Extract `ShowtimeRow` from `ShowtimeTable.tsx` (480→~280 lines)
- [ ] Extract `MovieDatabaseDetail` subcomponents (567→~300 lines)
- [ ] Extract `InsightsDashboard` stat cards (266→~150 lines)

### Phase 5 — Documentation update
- [ ] Fix stale collection names in 3 docs
- [ ] Fix `components/shared/` reference in `05_frontend_guidelines.md`
- [ ] Fix movie limit in `09_feature_movie_comparison.md`
- [ ] Fix price tiers in `10_studio_layout_technical_specification.md`
- [ ] Document remaining 20 API endpoints in `04_api_reference.md`
