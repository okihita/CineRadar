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
    totalShowtimes: number;
    successfulShowtimes: number;
    firstRun: string;
    lastRun: string;
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
 * Individual JIT dispatch entry
 */
export interface JITRunEntry {
    dispatched_at: string;
    window_start: string;
    window_end: string;
    showtimes_found: number;
    jobs_published: number;
    status: 'ok' | 'error';
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
 * Consolidated daily log document from scraper_logs/{date}
 */
export interface ScraperLog {
    date: string;
    created_at: string;
    morning_run?: MorningRunLog;
    jit_runs?: Record<string, JITRunEntry>;
    daily_summary?: DailySummaryLog;
}
