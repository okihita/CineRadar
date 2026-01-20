# Technical Spec: Daily Scraper Logs Migration

**Status:** Draft
**Date:** 2026-01-20
**Objective:** Migrate from granular `scraper_runs` documents to a single-document-per-day model (`scraper_logs`) to improve dashboard performance and cost-efficiency.

---

## 1. Schema Definition

**Collection:** `scraper_logs`
**Document ID:** `YYYY-MM-DD` (ISO 8601 Date in Asia/Jakarta)

### Data Structure (TypeScript Interface)

```typescript
/**
 * Represents the daily log document in Firestore: scraper_logs/{date}
 */
interface ScraperLog {
  // Metadata
  date: string;          // "2026-01-20"
  created_at: string;    // ISO UTC timestamp

  // 1. Morning Scrape (Written by backend/cli.py)
  // Populated by: backend/cli.py (monitor logic)
  morning_run?: {
    status: 'running' | 'success' | 'failed';
    start_time: string; // ISO
    end_time?: string;  // ISO
    duration_seconds?: number;
    
    // Stats
    movies_found: number;
    theatres_total: number;
    cities_covered: number;
    
    // Diagnostics
    error?: string;
  };

  // 2. JIT Dispatch Log
  // Populated by: backend/functions/dispatcher/main.py
  // Keyed by HH:MM time slot (e.g., "09:05") to allow concurrent-safe updates via Map
  jit_runs?: {
    [timeSlot: string]: {
      dispatched_at: string;   // ISO timestamp of dispatch
      window_start: string;    // "09:13" (Target window start)
      window_end: string;      // "09:18" (Target window end)
      
      // Dispatch Stats
      showtimes_found: number; // Number of showtime docs found in window
      jobs_published: number;  // Number of Pub/Sub messages sent
      
      status: 'ok' | 'error';
      error?: string;
    }
  };

  // 3. Daily Summary
  // Populated by: backend/cli/daily_summary.py
  daily_summary?: {
    generated_at: string; // ISO
    total_revenue_est: number;
    total_tickets_sold: number;
    occupancy_rate: number;
  };
}
```

---

## 2. Backend Implementation Strategy

### 2.1 Morning Scrape Update (`backend/cli.py`)

**Current Behavior:** Creates a new doc in `scraper_runs` for every run.
**New Behavior:** Upserts `scraper_logs/{today}`.

**Logic Flow:**
1.  **Init:** Calculate `today_str` (Jakarta TZ).
2.  **Start:**
    ```python
    db.collection("scraper_logs").document(today_str).set({
        "date": today_str,
        "created_at": iso_now,
        "morning_run": { "status": "running", "start_time": iso_now }
    }, merge=True)
    ```
3.  **Finish:**
    ```python
    db.collection("scraper_logs").document(today_str).set({
        "morning_run": { 
            "status": "success", 
            "end_time": iso_now,
            "movies_found": count,
            ... 
        }
    }, merge=True)
    ```

### 2.2 JIT Dispatcher Update (`backend/functions/dispatcher/main.py`)

**Current Behavior:** Logging only to Cloud Logging (stdout).
**New Behavior:** Writes dispatch stats to Firestore.

**Logic Flow:**
1.  **Init:** Calculate `today_str` and `time_slot` (e.g., "09:05").
2.  **Post-Publish:**
    ```python
    jit_entry = {
        "dispatched_at": datetime.now().isoformat(),
        "showtimes_found": len(showtimes),
        "jobs_published": published_count,
        "status": "ok"
    }
    
    # Use update with field path to avoid overwriting other slots
    try:
        db.collection("scraper_logs").document(today_str).update({
            f"jit_runs.{time_slot}": jit_entry
        })
    except NotFound:
        # Create doc if missing (e.g. Morning Scrape failed)
        db.collection("scraper_logs").document(today_str).set({
            "date": today_str,
            "jit_runs": { time_slot: jit_entry }
        })
    ```

### 2.3 Daily Summary Update (`backend/cli/daily_summary.py`)

**Change:** Write stats to `daily_summary` field of the same `scraper_logs` document at the end of the day (instead of a separate collection).

---

## 3. Frontend / Admin Changes

### 3.1 New API Endpoint: `/api/scraper/today`
*   **Method:** GET
*   **Query Param:** `date` (optional, defaults to current Jakarta date)
*   **Returns:** `ScraperLog` object or 404.

### 3.2 Visual Component Updates
1.  **`ScraperMonitor`**: Bind to `morning_run` status.
2.  **`JITGranularMonitor`**:
    *   Iterate over `Object.entries(jit_runs)`.
    *   Sort by time key.
    *   Visualize "Jobs Published" as the primary metric (replacing "Occupancy %" which is not available at dispatch time).

---

## 4. Technical Considerations

### 4.1 Timezone Discipline
All **Document IDs** and **Date Calculations** for keys MUST use **Asia/Jakarta** (UTC+7).
*   *Avoid* `datetime.utcnow().date()` -> This changes at 7 AM Jakarta time.
*   *Use* `datetime.now(ZoneInfo("Asia/Jakarta")).date()`.

### 4.2 1MB Document Limit Safety
*   **Estimate:** 
    *   Morning Run: ~0.5 KB
    *   JIT Runs: ~150 entries * 0.2 KB = 30 KB
    *   Summary: ~0.5 KB
    *   **Total:** ~31 KB << 1000 KB Limit.
*   **Conclusion:** Safe for foreseeable future.

### 4.3 Concurrent Writes
The JIT Dispatcher runs every 5 minutes (Cloud Scheduler). There is **zero risk** of concurrent writes to the *same* `jit_runs` key. There is minimal risk of contention on the document itself unless we scale to sub-minute dispatching.
