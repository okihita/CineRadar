# Plan: V1 Schema Audit (Phase 0 — Pre-Migration Reconnaissance)

> **Status**: Draft  
> **Date**: 2026-04-30  
> **Goal**: Catalog every field in every V1 Firestore document across all historical dates, producing a field evolution timeline. This informs the backfill strategy in Phase 1.  
> **Precedence**: Must complete BEFORE writing any backfill or migration code.

---

## 1. Why We Need This

V1 Firestore documents have been written by **different code versions** over months. Fields were added, removed, renamed, and restructured at various dates. Examples of known schema drift:

| Field | When It Changed | What Happened |
|-------|----------------|---------------|
| `layout_json` → `layout_compressed` | Unknown date | Switched from JSON string to gzip bytes |
| `source` | Unknown date | Added `"api"` marker to distinguish from legacy uploads |
| `scrape_phase` | Unknown date | Added T-30/T-20/T-10 phase tracking |
| `audience_pct`, `audience_count` | Unknown date | True audience delta metrics added |
| `master_total_seats`, `baseline_source` | Unknown date | Master layout baseline added |
| `initial_layout_compressed`, `initial_raw_layout` | Unknown date | Morning baseline capture added |
| `all_showtimes` vs `showtimes` | Unknown date | Structured showtime objects replaced plain time strings |
| `schedule_id` / `metadata_id` | Unknown date | Dual-ID field naming introduced |

If we naively copy V1 → V2 without understanding these eras, we'll produce inconsistent V2 data. The audit gives us a **field manifest per date** so we can design a schema-aware backfill.

---

## 2. Scope of the Audit

### 2.1 Collections to Scan

| V1 Collection | Document Pattern | What We Catalog |
|---------------|-----------------|-----------------|
| `schedules/{date}/movies/{schedule_id}` | Top-level fields, nested `cities` structure | All field names, types, nesting depth |
| `movie_performance/{schedule_id}` | Root metadata doc | All field names, types |
| `movie_performance/{schedule_id}/days/{date}` | Daily aggregation doc | All field names, types |
| `movie_performance/{schedule_id}/days/{date}/showtimes/{showtime_id}` | Individual showtime snapshot | All field names, types |

### 2.2 What We Do NOT Scan

| Collection | Reason |
|------------|--------|
| `schedules_v2/` | Already V2 — out of scope |
| `movie_performance_v2/` | Already V2 — out of scope |
| `snapshots/` | Collection-agnostic, not part of V1/V2 migration |
| `theatres/` | Collection-agnostic |
| `movies/` | Already keyed by metadata_id |
| `auth_tokens/` | Not schedule/performance data |
| `scraper_logs/` | Not schedule/performance data |

---

## 3. Audit Methodology

### 3.1 Approach: Field Manifest Per Date

For each date (descending from today to the earliest V1 document):

1. **List all documents** in the V1 collection for that date.
2. **For each document**, recursively walk its field structure and record:
   - Field name (full dot-path, e.g., `cities.JAKARTA[0].rooms[0].all_showtimes`)
   - Field type (`string`, `int`, `float`, `bool`, `list`, `dict`, `bytes`, `null`)
   - Whether the field is present or absent
3. **Aggregate by date**: Produce a `{date → {field_path → {present_count, type_set}}}` manifest.

### 3.2 Key Metrics Per Date

For **`schedules/{date}/movies/`**:

| Metric | Why It Matters |
|--------|---------------|
| Total movie count | Baseline for V2 parity check |
| Docs with `tix_metadata_id` present & non-null | Migratable docs |
| Docs with `tix_metadata_id` absent or null | **Orphans** — need manual handling |
| Docs with `cities` (dict) vs `schedules` (dict) | Schema version indicator |
| Docs with `all_showtimes` in rooms | New schema |
| Docs with only `showtimes` (string array) in rooms | Legacy schema |
| Docs with `source` field | Distinguishes API scraper vs legacy upload |
| Unique set of all top-level field names | Field evolution timeline |

For **`movie_performance/{id}/days/{date}/showtimes/`**:

| Metric | Why It Matters |
|--------|---------------|
| Total showtime count | Baseline for V2 parity check |
| Docs with `layout_compressed` (bytes) | New format |
| Docs with `layout_json` (string) | Legacy format |
| Docs with `initial_layout_compressed` | Morning baseline present |
| Docs with `initial_raw_layout` | Raw API data preserved |
| Docs with `raw_api_response` | Full API response preserved |
| Docs with `audience_pct` / `audience_count` | True audience metrics |
| Docs with `scrape_phase` | Phase-tracked scraping |
| Docs with `master_total_seats` / `baseline_source` | Master layout baseline |
| Docs with `price` | Revenue data |
| Unique set of all field names | Field evolution timeline |

For **`movie_performance/{id}/days/{date}`** (daily stats):

| Metric | Why It Matters |
|--------|---------------|
| Total daily stat docs | Per-movie per-date aggregation |
| Docs with `total_revenue` | Revenue field present |
| Docs with `total_showtimes_scraped` | Scraped vs total distinction |
| Unique set of all field names | Field evolution timeline |

For **`movie_performance/{id}`** (root metadata):

| Metric | Why It Matters |
|--------|---------------|
| Total root docs | Unique movies with performance data |
| Docs with `last_swept_at` | Sweeper has processed this |
| Docs with `total_sold` / `total_seats` | All-time aggregation present |

### 3.3 Cross-Reference Mapping

A critical output of the audit is the **schedule_id → metadata_id mapping**:

```
For each date:
  For each doc in schedules/{date}/movies:
    schedule_id = doc.id (or doc.movie_id)
    metadata_id = doc.tix_metadata_id
    
    Mapping: {schedule_id: metadata_id}
```

This mapping is needed for the backfill because `movie_performance` V1 is keyed by `schedule_id`, but V2 needs `metadata_id`. We build this lookup table during the audit so the backfill can use it directly.

---

## 4. Audit Script Design

### 4.1 Output Format

The audit produces three artifacts:

**Artifact 1: `audit_field_manifest.json`**
```json
{
  "schedules": {
    "2026-04-30": {
      "doc_count": 153,
      "migratable": 150,
      "orphans": 3,
      "fields": {
        "movie_id": {"present": 153, "types": ["string"]},
        "tix_metadata_id": {"present": 150, "types": ["string", "null"]},
        "title": {"present": 153, "types": ["string"]},
        "cities": {"present": 153, "types": ["dict"]},
        "source": {"present": 120, "types": ["string"]},
        ...
      },
      "nested_patterns": {
        "rooms.all_showtimes": {"present": 153, "sample_type": "list_of_dicts"},
        "rooms.showtimes": {"present": 0, "sample_type": null}
      }
    },
    "2026-04-29": { ... }
  },
  "movie_performance_showtimes": { ... },
  "movie_performance_daily": { ... },
  "movie_performance_root": { ... }
}
```

**Artifact 2: `audit_id_mapping.json`**
```json
{
  "schedule_to_metadata": {
    "2021094806305984512": "2021094805467123712",
    ...
  },
  "orphans": [
    {"schedule_id": "12345", "title": "Unknown Movie", "dates": ["2026-01-05"]}
  ],
  "date_range": {
    "earliest": "2025-12-01",
    "latest": "2026-04-30"
  }
}
```

**Artifact 3: `audit_report.txt`** (human-readable summary)
```
=== V1 SCHEMA AUDIT REPORT ===
Generated: 2026-04-30T12:00:00Z

--- SCHEDULES COLLECTION ---
Date range: 2025-12-01 to 2026-04-30 (151 days)
Total documents: 22,650
Migratable (has metadata_id): 22,500
Orphans (no metadata_id): 150

Field evolution:
  2025-12-01 to 2026-02-14: 11 fields (no 'source')
  2026-02-15 to 2026-04-30: 12 fields (+ 'source')

Nested schema:
  2025-12-01 to 2026-01-10: rooms[].showtimes (string array)
  2026-01-11 to 2026-04-30: rooms[].all_showtimes (dict array)

--- PERFORMANCE SHOWTIMES ---
Date range: 2025-12-01 to 2026-04-30 (151 days)
Total showtime snapshots: 682,000
  With layout_compressed: 450,000 (from 2026-02-01)
  With layout_json: 232,000 (before 2026-02-01)
  With audience_pct: 380,000 (from 2026-03-15)
  With scrape_phase: 400,000 (from 2026-02-20)
  With price: 350,000 (from 2026-03-01)
  Orphans (no schedule→metadata mapping): 2,100

--- PERFORMANCE DAILY STATS ---
Total daily aggregation docs: 22,500
  With total_revenue: 15,000 (from 2026-03-01)
  
--- PERFORMANCE ROOT METADATA ---
Total root docs: 320
  With total_sold/total_seats: 310

--- ESTIMATED BACKFILL SCOPE ---
V2 already has data from: 2026-02-15 (estimated)
Backfill needed for: 2025-12-01 to 2026-02-14 (76 days)
  Schedules to backfill: ~11,400 docs
  Showtimes to backfill: ~300,000 docs
  Daily stats to backfill: ~11,400 docs
```

### 4.2 Script Architecture

```
backend/scripts/audit_v1_schema.py
```

**Single script, three phases:**

**Phase A: Discover Date Range**
1. List all date documents in `schedules/` (collection IDs = dates)
2. Find earliest and latest dates
3. Print summary: "Found V1 data spanning {N} days from {earliest} to {latest}"

**Phase B: Scan & Catalog**
1. For each date (newest to oldest):
   a. Stream all docs from `schedules/{date}/movies/`
   b. For each doc: catalog fields, check `tix_metadata_id`, build ID mapping
   c. Stream all root docs from `movie_performance/` → for each, check `days/` subcollection
   d. For each date in `days/`: catalog daily stats fields
   e. For each showtime in `showtimes/`: catalog snapshot fields
2. Accumulate into in-memory manifests
3. Periodically flush to JSON (every 10 dates) for crash recovery

**Phase C: Generate Report**
1. Analyze manifests to detect field evolution boundaries
2. Print human-readable report
3. Save all three artifacts

### 4.3 Performance & Cost Controls

| Control | Implementation |
|---------|---------------|
| **Rate limiting** | Add `asyncio.sleep(0.1)` between date scans to avoid Firestore throttling |
| **Progress logging** | Log every date processed with doc counts |
| **Crash recovery** | Save intermediate manifests to JSON every 10 dates; resume from last checkpoint |
| **Optional date range** | CLI args `--from-date` and `--to-date` to scan a subset |
| **Dry run** | `--dry-run` flag that only counts docs without reading full content |

### 4.4 CLI Interface

```bash
# Full audit (all dates)
PYTHONPATH=. uv run python backend/scripts/audit_v1_schema.py

# Audit specific range
PYTHONPATH=. uv run python backend/scripts/audit_v1_schema.py --from-date 2026-01-01 --to-date 2026-03-01

# Dry run (just count documents, don't read fields)
PYTHONPATH=. uv run python backend/scripts/audit_v1_schema.py --dry-run

# Resume from checkpoint
PYTHONPATH=. uv run python backend/scripts/audit_v1_schema.py --resume
```

---

## 5. Safety Analysis

### 5.1 Operations Are Read-Only

The audit script performs **zero write operations** to any Firestore collection. It only calls:
- `collection.stream()` — read documents
- `document.get()` — read single documents

### 5.2 No Impact on Active Systems

| System | V1 Collection It Uses | Impact of Audit |
|--------|----------------------|-----------------|
| Admin dashboard (all routes) | Reads V2 only | **No impact** |
| Public web app (`MovieBrowser.tsx`) | Reads `schedules/` on-demand | **No impact** — our reads don't block theirs |
| JIT dispatcher | Reads V2 first, V1 fallback | **No impact** — reads don't interfere |
| JIT scraper | Writes to both V1 and V2 | **No impact** — our reads don't block writes |
| JIT sweeper | Reads/writes V2 first, V1 fallback | **No impact** |
| CLI tools | Reads V1 | **No impact** |

### 5.3 Firestore Concurrency

Firestore handles concurrent reads and writes without locking. Our audit reads will not slow down or block any active operations.

---

## 6. Cost Estimate

### 6.1 Read Operation Estimates

| Assumption | Value |
|------------|-------|
| Days of V1 history | 120-180 (to be confirmed by scan) |
| Movies per day | ~150 |
| Showtimes per day | ~3,000-5,000 |
| Daily stat docs per day | ~150 |
| Root metadata docs (unique movies) | ~300-500 |

**Conservative estimate (180 days):**

| Collection | Docs | Reads |
|------------|------|-------|
| `schedules/{date}/movies/` | 27,000 | 27,000 |
| `movie_performance/` root | 400 | 400 |
| `movie_performance/{id}/days/` listing | 400 × 180 = 72,000 subcollection reads | ~72,000 |
| `movie_performance/{id}/days/{date}` daily stats | 27,000 | 27,000 |
| `movie_performance/{id}/days/{date}/showtimes/` | 720,000 | 720,000 |
| **Total** | | **~847,000 reads** |

### 6.2 Cost Calculation

| Pricing Tier | Rate | Billable Reads | Cost |
|-------------|------|---------------|------|
| Free tier | 50,000/day | — | $0.00 |
| Above free tier | $0.036/100K reads | 847,000 | **~$0.31** |
| **Worst case (12 months)** | | ~1.7M | **~$0.61** |

**Bottom line: Under $1 regardless of scope.**

---

## 7. What We'll Learn

The audit output answers these critical questions for the backfill design:

| Question | Answered By |
|----------|-------------|
| How far back does V1 data go? | Phase A (date discovery) |
| How many total documents need backfilling? | Full scan counts |
| Which dates already have V2 data? | Comparing V1 dates vs V2 dates |
| What's the earliest V2 date? | Checking `schedules_v2` collection IDs |
| How many orphan V1 docs have no `tix_metadata_id`? | Schedules manifest |
| When was each field introduced? | Field evolution timeline |
| Which old showtimes use `layout_json` vs `layout_compressed`? | Performance showtimes manifest |
| How many unique schedule_id → metadata_id mappings exist? | ID mapping artifact |
| What's the estimated backfill write count? | Calculated from gap analysis |

---

## 8. Post-Audit Decision Points

After the audit completes, we'll be able to make these decisions:

1. **Backfill scope**: Exact number of dates, documents, and which "era" each date falls into.
2. **Schema handling strategy**: Whether to normalize old documents to the current schema during backfill, or preserve them as-is.
3. **Orphan handling**: How many docs can't be migrated, and whether they're worth manual fixing.
4. **Whether to backfill at all**: If V1 data only goes back a short time and V2 dual-write covers most of it, the backfill may be trivially small.

---

## 9. Execution Checklist

- [ ] Write `backend/scripts/audit_v1_schema.py`
- [ ] Run with `--dry-run` first to confirm document counts
- [ ] Run full audit
- [ ] Review `audit_report.txt` for field evolution timeline
- [ ] Review `audit_id_mapping.json` for orphan count
- [ ] Determine V2 coverage start date
- [ ] Calculate backfill scope (dates not covered by V2)
- [ ] Design backfill strategy based on findings
- [ ] Write backfill script (Phase 1 of migration plan)
