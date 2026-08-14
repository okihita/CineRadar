# Competitor Tracking — CinePoint Benchmarking

## Objective

Compare CineRadar's Quick Count (showtimes + admissions) against CinePoint's published daily figures. The goal is to measure accuracy delta, spot coverage gaps, and build trust in our numbers.

## The Killer UX Insight: Paste-and-Parse

Admins will NOT type movie names and numbers into forms. They will **paste the raw CinePoint tweet** and the system auto-extracts everything. Data entry goes from 5 minutes of manual typing to 10 seconds of copy-paste.

CinePoint publishes two tweet formats daily:

**Tweet 1 — Showtime Count** (morning of, ~6 AM):
```
#Salmokji 2,466 (-3.90%)
#GhostinTheCell 2,444 (+1.20%)
```

**Tweet 2 — Estimated Admissions** (next morning, ~6 AM):
```
#Salmokji
+74,385 (-3.90%) | 389,072
```

Both are trivially parseable with regex. No NLP needed.

---

## Data Model

**Collection:** `competitor_snapshots`

```
Document ID: {date}  e.g. "2026-05-05"
```

```typescript
interface CompetitorSnapshot {
  date: string;                    // "2026-05-05"
  source: 'cinepoint';

  // Populated from Tweet 1 (morning showtime count)
  showtimes_raw?: string;          // original pasted tweet text
  showtimes_parsed?: CinePointShowtime[];
  showtimes_parsed_at?: string;

  // Populated from Tweet 2 (next-day admissions)
  admissions_raw?: string;         // original pasted tweet text
  admissions_parsed?: CinePointAdmission[];
  admissions_parsed_at?: string;
}

interface CinePointShowtime {
  title_cp: string;               // "Salmokji" (from hashtag, no #)
  showtimes: number;              // 2466
  daily_change_pct: number;       // -3.90
  matched_movie_id?: string;      // links to CineRadar movie
  matched_title?: string;         // CineRadar's title for display
}

interface CinePointAdmission {
  title_cp: string;               // "Salmokji"
  daily_admissions: number;       // 74385
  daily_change_pct: number;       // -3.90
  cumulative_admissions: number;  // 389072
  matched_movie_id?: string;
  matched_title?: string;
}
```

**Why a single document per date:** CinePoint publishes ~12 movies per day. Two tweets = ~24 data points. A single document is simpler than a sub-collection for this scale. No query complexity needed.

---

## Route Structure

```
/competitors                   → Main page: date selector + comparison dashboard
/competitors/[date]            → Date detail: paste areas + comparison table
```

API routes:
```
GET  /api/competitors                    → list all dates with data
GET  /api/competitors/[date]             → get snapshot for a date
PUT  /api/competitors/[date]/showtimes   → paste & parse showtime tweet
PUT  /api/competitors/[date]/admissions  → paste & parse admissions tweet
PATCH /api/competitors/[date]/match      → update movie matching
```

---

## UX Flow

### Page Layout (`/competitors/[date]`)

```
┌─────────────────────────────────────────────────────────────────────┐
│  SWORDS   CinePoint Benchmark — Mon, 5 May 2026          [< >] today│
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─── SHOWTIME COUNT ──────────────────────────────────── [PASTE] ─┐│
│  │                                                                  ││
│  │  ┌────────────────────────────────────────────────────────────┐  ││
│  │  │  Paste CinePoint showtime tweet here...                    │  ││
│  │  │                                                            │  ││
│  │  │  #Salmokji 2,466 (-3.90%)                                 │  ││
│  │  │  #GhostinTheCell 2,444 (+1.20%)                           │  ││
│  │  └────────────────────────────────────────────────────────────┘  ││
│  │                                                                  ││
│  │  [✓ Parsed: 12 movies]                        [Save & Compare]  ││
│  └──────────────────────────────────────────────────────────────────┘│
│                                                                     │
│  ┌─── ESTIMATED ADMISSIONS ────────────────────────────── [PASTE] ─┐│
│  │                                                                  ││
│  │  ┌────────────────────────────────────────────────────────────┐  ││
│  │  │  Paste CinePoint admissions tweet here...                  │  ││
│  │  │                                                            │  ││
│  │  │  #Salmokji                                                │  ││
│  │  │  +74,385 (-3.90%) | 389,072                               │  ││
│  │  └────────────────────────────────────────────────────────────┘  ││
│  │                                                                  ││
│  │  [✓ Parsed: 10 movies]                        [Save & Compare]  ││
│  └──────────────────────────────────────────────────────────────────┘│
│                                                                     │
│  ┌─── COMPARISON ──────────────────────────────────────────────────┐│
│  │                                                                  ││
│  │  MOVIE                CINERADAR    CINEPOINT    DELTA    Δ%      ││
│  │  ─────────────────── ─────────── ─────────── ──────── ──────    ││
│  │  Salmokji              2,512       2,466        +46    +1.87%   ││
│  │  Ghost in the Cell     2,401       2,444        -43    -1.76%   ││
│  │  Dilan ITB 1997        1,698       1,701         -3    -0.18%   ││
│  │  ...                                                            ││
│  │  ─────────────────── ─────────── ─────────── ──────── ──────    ││
│  │  TOTAL                11,234      11,022       +212    +1.92%   ││
│  │                                                                  ││
│  │  ● Coverage: 12/12 movies matched                                ││
│  │  ● Avg Deviation: ±1.2%                                         ││
│  └──────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────┘
```

### Landing Page (`/competitors`)

```
┌─────────────────────────────────────────────────────────────────────┐
│  SWORDS   CinePoint Benchmark                                       │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─── ACCURACY OVER LAST 7 DAYS ──────────────────────────────────┐│
│  │                                                                  ││
│  │  DATE       SHOWTIMES Δ%    ADMISSIONS Δ%   STATUS              ││
│  │  ───────── ────────────── ─────────────── ──────────            ││
│  │  May 05     +1.92%          —               🟡 Partial          ││
│  │  May 04     -0.45%          +2.31%          🟢 Complete         ││
│  │  May 03     +0.89%          -1.07%          🟢 Complete         ││
│  │  May 02     —               —               ⚪ No Data          ││
│  │  May 01     +3.21%          +4.55%          🟢 Complete         ││
│  │                                                                  ││
│  │  ● 7-day avg showtime delta: +1.64%                             ││
│  │  ● 7-day avg admission delta: +1.93%                            ││
│  └──────────────────────────────────────────────────────────────────┘│
│                                                                     │
│  [+ Add Today's Data]                                               │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Parsing Logic

### Showtime Tweet Parser

```
Input line:  "#Salmokji 2,466 (-3.90%)"
Regex:       /^#(\S+)\s+([\d,]+)\s+\(([+-][\d.]+)%\)/
Extract:     title="Salmokji", showtimes=2466, change=-3.90

Edge cases:
  - "---" separator between tiers → skip
  - Lines with just text/headers → skip
  - "SHOWTIMES - MON, 4/5/26" header → extract date as validation
```

### Admissions Tweet Parser

```
Input pair:
  "#Salmokji"
  "+74,385 (-3.90%) | 389,072"

Regex (title): /^#(\S+)/
Regex (data):  /^\+([\d,]+)\s+\(([+-][\d.]+)%\)\s*\|\s*([\d,]+)/
Extract:       title="Salmokji", daily=74385, change=-3.90, cum=389072

Edge cases:
  - "---" separator → skip
  - "ESTIMATED ADMISSION..." header → skip
  - "per Cinepoint tracking" → skip
```

---

## Movie Matching Strategy

The core challenge: CinePoint uses hashtag-style names (`#GhostinTheCell`) while CineRadar has full titles (`Ghost in the Cell`).

**Matching algorithm (in order of priority):**

1. **Exact match** after removing `#`, spaces, special chars — lowercase compare
   - `#Salmokji` → `salmokji` vs CineRadar `Salmokji` → `salmokji` ✓
   - `#DilanITB1997` → `dilanitb1997` vs CineRadar `Dilan ITB 1997` → `dilanitb1997` ✓

2. **Contains match** — if normalized CP title is a substring of normalized CR title or vice versa
   - `#TheMummy` → `themummy` contained in `Lee Cronin's The Mummy` → `leecroninsthemummy` ✓

3. **Manual override** — admin can click a movie row and select the correct CineRadar match from a dropdown

**Persistence:** Once matched, the `matched_movie_id` is stored in the Firestore document. Future pastes for the same CP title auto-match.

---

## Comparison Engine

After parsing + matching, the comparison table joins:

| Column | Source |
|--------|--------|
| CineRadar Showtimes | `movie_performance_v2/{id}/days/{date}.total_showtimes` |
| CinePoint Showtimes | Parsed from tweet |
| Delta | `CineRadar - CinePoint` |
| Delta % | `((CR - CP) / CP) * 100` |

For admissions:
| Column | Source |
|--------|--------|
| CineRadar Admissions | `movie_performance_v2/{id}/days/{date}.total_sold` |
| CinePoint Admissions | Parsed from tweet |
| Delta | Same formula |

**Aggregate metrics:**
- Total delta (sum of all movie deltas)
- Average deviation (mean of absolute delta percentages)
- Coverage (matched movies / total CP movies)

---

## Sidebar Placement

Add to **Operations** group:

```
PERFORMANCE        →  /performances
COMPETITOR DATA    →  /competitors        ← NEW
SHOWTIME INTEL     →  /schedules
```

Icon: `Swords` from lucide-react (competitive/battle metaphor).

---

## Implementation Phases

### Phase 1: Core (This PR)
- [ ] Firestore types + `competitor_snapshots` collection
- [ ] Paste-and-parse component with live preview
- [ ] Showtime tweet parser (regex)
- [ ] Admissions tweet parser (regex)
- [ ] Movie matching (exact + contains + manual dropdown)
- [ ] Comparison table with delta calculations
- [ ] API routes (GET, PUT for paste/parse, PATCH for matching)
- [ ] `/competitors` landing page (date list + accuracy overview)
- [ ] `/competitors/[date]` detail page (paste areas + comparison)
- [ ] Sidebar entry in Operations group

### Phase 2: Polish (Next PR)
- [ ] Historical accuracy chart (7-day/30-day trend)
- [ ] Alert thresholds (flag when delta > 5%)
- [ ] Export comparison as CSV
- [ ] Auto-date detection from tweet header

### Phase 3: Direct CinePoint API Integration (Implemented ✅)
- Direct authenticated API ingestion via Bearer/Refresh token
- Historical backfill script (`admin/scripts/cinepoint_backfill.py`)
- Metadata & creator enrichment script (`admin/scripts/cinepoint_enrich.py`)
- Box office rankings, director analysis, actor analysis, and insights dashboards

---

## Direct CinePoint API Architecture

In addition to manual tweet parsing, CineRadar integrates directly with the CinePoint REST API:

### Collections:
* **`cinepoint_daily_boxoffice`**: Historical daily admissions and gross figures keyed by `{date}`.
* **`cinepoint_movies`**: Normalized movie catalog enriched with directors, cast, poster URLs, and cumulative admissions.

### Admin Routes:
* `/competitors/cinepoint`: Daily box office dashboard and date browser.
* `/competitors/cinepoint/insights`: Market share and distributor performance.
* `/competitors/cinepoint/analysis/directors`: Box office rankings by director.
* `/competitors/cinepoint/analysis/actors`: Box office rankings by actor.
* `/competitors/cinepoint/movies/[id]`: Individual film lifetime performance trajectory.
