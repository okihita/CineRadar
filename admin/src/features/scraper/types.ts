/**
 * Scraper feature types
 */

export type { ScraperRun } from '@/types';

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

export interface WaveStats {
    found: number;
    success: number;
    error: number;
    rate: number;
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
    totalSchedules: number;
    availableSchedules: number;
    waveMultiplier: number;
    coveragePercent: number;
    errorBreakdown: {
        auth: number;      // 401 - token/auth issues (CRITICAL)
        closed: number;    // 400 - seating closed/passed (expected)
        other: number;     // Other errors (network, schema, etc.)
    };
    // New normalized wave breakdown
    waveBreakdown?: {
        t30: WaveStats;
        t20: WaveStats;
        t10: WaveStats;
    };
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
 * Error counts grouped by HTTP status code.
 * Used to distinguish between logic issues (401) and operational issues (400).
 */
export interface ErrorCounts {
    "401": number;  // Auth/token issues - DANGER (logic/software issue)
    "400": number;  // Operational - WARNING (showtime passed, etc.)
    "other": number; // Network errors, schema issues, etc.
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
    error_counts?: ErrorCounts;  // Breakdown by HTTP status (fetched on demand)
    // Phase-specific counts (Found)
    t30_found?: number;
    t20_found?: number;
    t10_found?: number;
    // Phase-specific counters (Successes)
    t30_success?: number;
    t20_success?: number;
    t10_success?: number;
    // Phase-specific counters (Errors)
    t30_error?: number;
    t20_error?: number;
    t10_error?: number;
}

/**
 * Consolidated daily log document from scraper_logs/{date}
 */
export interface ScraperLog {
    date: string;
    created_at: string;
    morning_run?: MorningRunLog;
    dispatches?: Record<string, DispatchEntry>;
}
