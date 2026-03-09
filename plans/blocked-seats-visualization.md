# Blocked Seats Visualization - UI/UX Plan

## Overview

Display the "blocked/broken seats" (initial_unavailable) separately from "sold seats" in the admin panel, so users can understand the true audience count vs raw occupancy.

---

## Background

### Data Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ Initial Layout Scraper (4:15 AM WIB)                                        │
├─────────────────────────────────────────────────────────────────────────────┤
│ 1. Scrape all showtimes for today                                           │
│ 2. Capture seat layout BEFORE sales                                         │
│ 3. Store initial_unavailable = blocked + broken seats                       │
│ 4. Store initial_layout_compressed = gzipped seat grid                      │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ JIT Scraper (every 5 min)                                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│ 1. Scrape showtime 30 min before start                                      │
│ 2. Capture sold_seats = current unavailable                                 │
│ 3. Calculate audience_count = sold_seats - initial_unavailable              │
│ 4. Store both values for comparison                                         │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Key Metrics

| Metric | Description | Formula |
|--------|-------------|---------|
| `initial_unavailable` | Blocked/broken seats before sales | Captured at 4:15 AM |
| `sold_seats` | Current unavailable seats | Captured JIT |
| `audience_count` | Actual tickets sold | `sold_seats - initial_unavailable` |
| `audience_pct` | Real occupancy rate | `audience_count / total_seats * 100` |

---

## UI/UX Design

### Location

Add to existing **Showtime Detail** panel in the Performance pages.

### ASCII Mockup - Showtime Card

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ 🎬 Captain America: Brave New World                                         │
│ 📍 CGV Grand Indonesia - Jakarta                                            │
│ 🕐 14:30 | Regular 2D                                                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  SEAT BREAKDOWN                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │████████████│░░░░░░░░░│████████████████████████████████████████████│   │
│  │  Blocked   │  Sold   │              Available                      │   │
│  │    12      │   45    │                 143                        │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌──────────────────────┐  ┌──────────────────────┐                       │
│  │ Total Seats          │  │  200                 │                       │
│  ├──────────────────────┤  ├──────────────────────┤                       │
│  │ 🔴 Blocked/Broken    │  │   12  (6.0%)         │                       │
│  ├──────────────────────┤  ├──────────────────────┤                       │
│  │ 🟢 Tickets Sold      │  │   45  (22.5%)        │                       │
│  ├──────────────────────┤  ├──────────────────────┤                       │
│  │ ⚪ Available         │  │  143  (71.5%)        │                       │
│  └──────────────────────┘  └──────────────────────┘                       │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ 📊 TRUE AUDIENCE                                                     │   │
│  │                                                                      │   │
│  │   45 sold - 12 blocked = 33 actual audience (16.5%)                │   │
│  │                                                                      │   │
│  │   Raw Occupancy: 28.5%  ──►  True Occupancy: 16.5%                 │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  📅 Baseline captured: 2026-03-09 04:15:07 WIB                             │
│  📅 Last scraped: 2026-03-09 14:02:33 WIB                                  │
└─────────────────────────────────────────────────────────────────────────────┘
```

### ASCII Mockup - Table View

```
┌───────────────────────────────────────────────────────────────────────────────────────┐
│ SHOWTIME PERFORMANCE TABLE                                                            │
├─────────────┬───────┬─────────┬────────┬────────┬─────────┬───────────┬──────────────┤
│ Movie       │ Time  │ Seats   │ Blocked│ Sold   │ Audience│ True Occ% │ Raw Occ%     │
├─────────────┼───────┼─────────┼────────┼────────┼─────────┼───────────┼──────────────┤
│ Captain A.  │ 14:30 │ 200     │ 12     │ 45     │ 33      │ 16.5%     │ 28.5%        │
│ Spider-Man  │ 15:00 │ 150     │ 8      │ 62     │ 54      │ 36.0%     │ 41.3%        │
│ Frozen 3    │ 16:30 │ 180     │ 15     │ 89     │ 74      │ 41.1%     │ 49.4%        │
└─────────────┴───────┴─────────┴────────┴────────┴─────────┴───────────┴──────────────┘
```

---

## Visual Indicators

### Color Scheme

| Status | Color | Hex | Tailwind |
|--------|-------|-----|----------|
| Blocked/Broken | 🔴 Red | `#ef4444` | `bg-red-500` |
| Sold | 🟢 Green | `#22c55e` | `bg-green-500` |
| Available | ⚪ Gray | `#e5e7eb` | `bg-gray-200` |

### Stacked Progress Bar

```
┌─────────────────────────────────────────────────────────────────────────────┐
│████████████│░░░░░░░░░│████████████████████████████████████████████████████│
│  Blocked   │  Sold   │              Available                            │
│   (red)    │ (green) │               (gray)                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

Layered rendering:
1. Base layer: Gray bar (100% width = total seats)
2. Overlay 1: Red segment (blocked % from left)
3. Overlay 2: Green segment (sold % from left, after blocked)

---

## Component Structure

### New Components

```
admin/src/features/performances/components/
├── SeatBreakdownCard.tsx      # Main card with breakdown
├── SeatProgressBar.tsx        # Stacked progress bar
├── TrueAudienceBadge.tsx      # Shows "16.5% true" vs "28.5% raw"
└── ShowtimeSeatTable.tsx      # Table with blocked column
```

### Data Props

```typescript
interface SeatBreakdown {
  totalSeats: number;
  blockedSeats: number;      // initial_unavailable
  soldSeats: number;         // final_unavailable
  availableSeats: number;    // total - blocked - sold
  audienceCount: number;     // sold - blocked
  trueOccupancyPct: number;  // audience / total * 100
  rawOccupancyPct: number;   // sold / total * 100
  baselineCapturedAt: string; // initial_scraped_at
  lastScrapedAt: string;     // scraped_at
}
```

---

## Implementation Steps

### Phase 1: Data Layer
- [ ] Add `initial_unavailable` to showtime API response
- [ ] Calculate `audience_count` and `true_occupancy_pct` in backend
- [ ] Include baseline timestamp in response

### Phase 2: UI Components
- [ ] Create `SeatProgressBar.tsx` component
- [ ] Create `SeatBreakdownCard.tsx` component
- [ ] Create `TrueAudienceBadge.tsx` component

### Phase 3: Integration
- [ ] Add to ShowtimeTable component
- [ ] Add to DailyPerformanceDetail component
- [ ] Update performance API routes

### Phase 4: Polish
- [ ] Add tooltips explaining each metric
- [ ] Handle missing baseline data gracefully
- [ ] Add comparison view (raw vs true occupancy)

---

## Edge Cases

### Missing Baseline Data

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ ⚠️ BASELINE UNAVAILABLE                                                     │
│                                                                             │
│ This showtime was not scraped at 4:15 AM. True audience cannot be          │
│ calculated. Showing raw occupancy only.                                     │
│                                                                             │
│ Raw Occupancy: 28.5% (57 / 200 seats)                                      │
└─────────────────────────────────────────────────────────────────────────────┘
```

### More Sold Than Blocked

This is the normal case - sold seats should be >= blocked seats.

### All Seats Blocked

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ ⚠️ UNUSUAL: All seats marked as blocked                                     │
│                                                                             │
│ This could indicate:                                                        │
│ - Showtime cancelled                                                        │
│ - Technical issue with seat map                                             │
│ - Private screening                                                         │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Success Metrics

| Metric | Target |
|--------|--------|
| Users understand difference between raw and true occupancy | > 90% |
| Reduction in confusion about "high occupancy" shows | Measurable |
| Adoption of true occupancy for decision-making | Track usage |

---

## Questions to Resolve

1. **Should we show the actual seat map grid?**
   - We have `initial_layout_compressed` (gzipped grid)
   - Could render as interactive seat map
   - Recommendation: MVP without, add later if requested

2. **Historical data backfill?**
   - Shows before V2 migration won't have baseline
   - Consider one-time backfill script
   - Recommendation: Accept gap, new data will populate

3. **Aggregate true occupancy at movie level?**
   - Sum of all showtimes' audience_count / total_seats
   - Recommendation: Yes, add to movie performance cards
