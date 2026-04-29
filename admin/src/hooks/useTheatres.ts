'use client';

/**
 * useTheatres - Custom hook for fetching and managing theatre data
 * Refactored to use SWR for standardized data fetching and caching
 */

import useSWR from 'swr';
import { Theatre, ScraperRun, PerformanceMetrics } from '@/types';
import theatreService from '@/services/theatreService';

interface CombinedTheatreData {
    theatres: Theatre[];
    runs: ScraperRun[];
    metrics: PerformanceMetrics;
}

interface UseTheatresReturn {
    theatres: Theatre[];
    runs: ScraperRun[];
    loading: boolean;
    error: Error | null;
    refetch: () => Promise<CombinedTheatreData | undefined>;
    isValidating: boolean;
    metrics: PerformanceMetrics | null;
}

/**
 * Combined fetcher for theatres and scraper runs
 * Calculates latency and payload size for monitoring
 */
const theatreFetcher = async () => {
    const start = performance.now();
    const [theatres, runs] = await Promise.all([
        theatreService.getTheatres(),
        theatreService.getScraperRuns(10)
    ]);
    const end = performance.now();

    // Calculate metrics
    const combinedData = { theatres, runs };
    const sizeBytes = new TextEncoder().encode(JSON.stringify(combinedData)).length;

    return {
        theatres,
        runs,
        metrics: {
            latencyMs: Math.round(end - start),
            sizeKB: parseFloat((sizeBytes / 1024).toFixed(2))
        }
    };
};

export function useTheatres(): UseTheatresReturn {
    const { data, error, isLoading, isValidating, mutate } = useSWR(
        'theatre-registry-combined',
        theatreFetcher,
        {
            revalidateOnFocus: false,
            revalidateOnReconnect: true,
            dedupingInterval: 60000, // 1 minute
        }
    );

    return {
        theatres: data?.theatres ?? [],
        runs: data?.runs ?? [],
        loading: isLoading,
        error: error || null,
        refetch: mutate,
        isValidating,
        metrics: data?.metrics ?? null
    };
}

export default useTheatres;


