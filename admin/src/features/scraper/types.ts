/**
 * Scraper feature types
 */

export interface ScraperRun {
    id?: string;
    date: string;
    timestamp: string;
    status: 'success' | 'partial' | 'failed';
    run_type?: string;
    movies: number;
    cities: number;
    theatres_total: number;
    theatres_success: number;
    theatres_failed: number;
    presales?: number;
}

export interface CollectionStats {
    name: string;
    count: number;
    sample: Record<string, unknown> | null;
    fields: string[];
}

export interface ScraperStats {
    totalRuns: number;
    successRate: number;
    avgMovies: number;
    avgTheatres: number;
    lastRunTime: string;
}

export interface MorningScrape {
    status: 'running' | 'success' | 'partial' | 'failed';
    timestamp: string;
    movies: number;
    cities: number;
    theatres: number;
}

export interface JITSummary {
    totalRuns: number;
    totalShowtimesFound: number;
    totalJobsPublished: number;
    totalErrors: number;
    totalSuccesses: number;
    errorCount: number;
    firstDispatch: string;
    lastDispatch: string;
}

// ============================================================================
// NEW: Consolidated scraper_logs types (daily document model)
// ============================================================================

/**
 * Morning scrape run status within ScraperLog
 */
export interface MorningRunLog {
    status: 'running' | 'success' | 'partial' | 'failed';
    start_time?: string;
    end_time?: string;
    duration_seconds?: number;
    movies_found: number;
    theatres_total: number;
    cities_covered: number;
    error?: string;
}

/**
 * @deprecated Use DispatchEntry instead. Kept for backwards compatibility during migration.
 */
export interface JITRunEntry {
    dispatched_at: string;
    window_start: string;
    window_end: string;
    showtimes_found: number;
    jobs_published: number;
    status: string;
    error?: string;
}

/**
 * Dispatch entry from scraper_logs/{date}/dispatches/{HH-MM}
 * Contains both dispatch metadata (written by dispatcher) and
 * completion counters (incremented by scraper instances).
 */
export interface DispatchEntry {
    dispatched_at: string;
    time_slot: string;
    showtimes_found: number;
    jobs_published: number;
    window_start: string;
    window_end: string;
    status: string;
    total_errors: number;
    total_successes: number;
    error?: string;
}

/**
 * Daily summary stats
 */
export interface DailySummaryLog {
    generated_at: string;
    total_audience: number;
    total_seats: number;
    occupancy_pct: number;
    showtime_count: number;
    movie_count: number;
    theatre_count: number;
    city_count: number;
}

/**
 * Daily error summary rollup (computed by daily_summary CLI)
 */
export interface DailyErrorSummary {
    total_dispatches: number;
    total_errors: number;
    total_successes: number;
    error_rate_pct: number;
}

/**
 * Consolidated daily log document from scraper_logs/{date}
 */
export interface ScraperLog {
    date: string;
    created_at: string;
    morning_run?: MorningRunLog;
    dispatches?: Record<string, DispatchEntry>;
    daily_summary?: DailySummaryLog;
    daily_error_summary?: DailyErrorSummary;
}
