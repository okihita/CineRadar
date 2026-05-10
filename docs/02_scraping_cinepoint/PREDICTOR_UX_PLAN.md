# Success Predictor UX Overhaul — 20-Step Plan

## Current Problems
1. **No sidebar entry** — Analysis page only accessible via tiny button on catalog page
2. **Loading is a spinner** — User stares at spinner for 5-10s while API computes aggregates over 3,963 movies
3. **No filtering** — All analysis is static; can't isolate "what if we only consider genre?"
4. **Tab layout wastes horizontal space** — Each tab is a narrow column; charts get compressed
5. **Vertical scrolling** — Too much scrolling between sections; no overview-at-a-glance
6. **API is monolithic** — One giant computation; can't stream/partial-load sections

## Architecture Decision: Client-Side Computation
Instead of server-side aggregation (slow, monolithic), we fetch the raw movie data ONCE
and compute everything client-side. This enables:
- Instant re-filtering without API calls
- Progressive loading (show data as soon as movies arrive)
- Interactive factor toggles

## 20 Steps

### Phase 1: Data Layer (Steps 1-4)
1. Create lightweight API route `GET /api/competitors/cinepoint/analysis/raw`
   - Returns flat array of {id, title, type, language, genres, duration, total_admission,
     score, rating_category, directors[], actors[], release_date}
   - Uses Firestore `select()` to return only needed fields
   - ~3,963 docs × ~200 bytes each = ~800KB payload — acceptable

2. Create `useAnalysisData` hook
   - Fetches raw data once
   - Computes all aggregates client-side
   - Memoized with useMemo, re-computes only when filters change
   - Returns {overview, genres, directors, actors, languages, ratings, durations, combos}

3. Define filter state type
   - factors: { genre: bool, actors: bool, directors: bool, language: bool, duration: bool, rating: bool }
   - typeFilter: 'all' | 'local' | 'international'
   - yearRange: [min, max]
   - selectedGenres: string[]
   - Each factor toggle recalculates rankings

4. Create pure computation functions
   - `computeOverview(movies, filters)` → tier distribution, stats
   - `computeGenreStats(movies, filters)` → genre analysis
   - `computePersonRankings(movies, role, filters)` → director/actor rankings
   - All pure functions, easy to test

### Phase 2: Sidebar Navigation (Steps 5-6)
5. Add "Success Predictor" to Sidebar under Operations group
   - Icon: Target (already imported? check)
   - Route: /competitors/cinepoint/analysis
   - Place after "CinePoint Insights"

6. Update isItemActive if needed (already catches /competitors/cinepoint/*)

### Phase 3: Progressive Loading UX (Steps 7-9)
7. Loading skeleton: Show page structure immediately with pulsing placeholders
   - KPI card skeletons (5 cards)
   - Tier bar skeleton
   - Chart skeleton rectangles

8. Inline insight text during load
   - While data loads, show 2-3 "did you know" cards with placeholder text
   - Replaces boring spinner with engaging content

9. Staggered reveal: Once data arrives, fade in sections from top to bottom
   - Overview appears first (computed from first 100 movies)
   - Genre analysis second
   - Star power last (most expensive computation)

### Phase 4: Layout & Screen Real Estate (Steps 10-13)
10. Replace tab layout with vertical scrollable dashboard
    - ALL sections visible on one scroll — no hidden tabs
    - Each section is a Card with clear header

11. Two-column layout for charts + tables side-by-side
    - Genre chart (left, 60%) + Genre table (right, 40%)
    - Director ranking (left) + Actor ranking (right)

12. Compact data tables
    - Remove excessive padding
    - Smaller font sizes for ranking tables
    - Sticky headers within scroll containers

13. Factor filter sidebar panel (collapsible, left side of content area)
    - Toggle chips for each factor: Genre, Director, Actor, Language, Duration, Rating
    - Type filter: All / Local / International
    - Year range slider
    - Genre multi-select checkboxes

### Phase 5: Interactive Filtering (Steps 14-17)
14. Factor toggle UI
    - Each factor is a chip button: ON (colored) / OFF (gray)
    - When OFF, that factor is excluded from all computations
    - e.g. Turn off "Actors" → director rankings unchanged, but genre analysis no longer influenced by actor presence

15. Genre deep-dive filter
    - Click a genre bar → filters to only that genre
    - Shows how directors/actors perform WITHIN that genre

16. Type filter (Local vs International)
    - Segmented control at top
    - All stats recalculate for the filtered subset

17. Year range filter
    - Show min/max years from data
    - Slider or input fields

### Phase 6: Polish (Steps 18-20)
18. Animated tier bar — bars grow from 0 on mount
19. Consistent number formatting — all admissions use formatAdm()
20. Empty states — when filters produce 0 results, show helpful message
