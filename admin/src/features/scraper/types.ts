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
    status: 'success' | 'partial' | 'failed';
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
