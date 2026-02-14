import useSWR from 'swr';
import type { ScraperLog, DispatchEntry, MorningRunLog } from '../types';
import { REFRESH_INTERVALS } from '@/lib/constants';

interface JITSummary {
    totalRuns: number;
    totalShowtimesFound: number;
    totalJobsPublished: number;
    totalErrors: number;
    totalSuccesses: number;
    errorCount: number;
    firstDispatch?: string;
    lastDispatch?: string;
    totalSchedules: number;
    coveragePercent: number;
}

interface DayResponse {
    log: ScraperLog;
    jitSummary: JITSummary | null;
    date: string;
}

const dayFetcher = async (url: string): Promise<DayResponse | null> => {
    const res = await fetch(url);
    if (res.status === 404) return null;
    if (!res.ok) throw new Error('Failed to fetch scraper day data');
    return res.json();
};

/**
 * Hook to fetch scraper data for a specific date
 * @param date - Date in YYYY-MM-DD format
 */
export function useScraperDay(date: string) {
    const { data, error, isLoading, mutate } = useSWR<DayResponse | null>(
        date ? `/api/scraper/today?date=${date}` : null,
        dayFetcher,
        {
            revalidateOnFocus: false,
            dedupingInterval: REFRESH_INTERVALS.FAST
        }
    );

    // Extract dispatches from the log
    const dispatches: Record<string, DispatchEntry> = data?.log?.dispatches ?? {};

    // Extract morning run
    const morningRun: MorningRunLog | undefined = data?.log?.morning_run;

    // Extract jit summary for coverage stats
    const jitSummary = data?.jitSummary;

    // Calculate day stats
    const dispatchList = Object.values(dispatches);
    const dayStats = {
        totalDispatches: dispatchList.length,
        totalShowtimes: jitSummary?.totalShowtimesFound ?? dispatchList.reduce((sum, d) => sum + (d.showtimes_found || 0), 0),
        totalSuccesses: dispatchList.reduce((sum, d) => sum + (d.total_successes || 0), 0),
        totalErrors: dispatchList.reduce((sum, d) => sum + (d.total_errors || 0), 0),
        errorDispatches: dispatchList.filter(d => d.status === 'error' || (d.total_errors || 0) > 0).length,
        // New fields for schedule coverage
        totalSchedules: jitSummary?.totalSchedules ?? 0,
        coveragePercent: jitSummary?.coveragePercent ?? 0,
    };

    return {
        log: data?.log ?? null,
        dispatches,
        morningRun,
        dayStats,
        jitSummary,
        date: data?.date ?? date,
        isLoading,
        isError: !!error,
        notFound: !data && !isLoading,
        refresh: mutate,
    };
}

export type { DayResponse, JITSummary };

