/**
 * SWR hooks for scraper data
 */
import useSWR from 'swr';
import type { ScraperRun, CollectionStats, MorningScrape, JITSummary, ScraperStats } from '../types';
import { formatWIBShort } from '@/lib/timeUtils';

interface ScraperCoreResponse {
    runs: ScraperRun[];
    todayMorningScrape: MorningScrape | null;
    todayJITSummary: JITSummary | null;
}

interface ScraperStatsResponse {
    collections: CollectionStats[];
}

const coreFetcher = async (url: string): Promise<ScraperCoreResponse> => {
    const res = await fetch(url);
    if (!res.ok) throw new Error('Failed to fetch scraper data');
    return res.json();
};

const statsFetcher = async (url: string): Promise<ScraperStatsResponse> => {
    const res = await fetch(url);
    if (!res.ok) throw new Error('Failed to fetch scraper stats');
    return res.json();
};

export function useScraperData() {
    const { data: coreData, error: coreError, isLoading: coreLoading, mutate: refreshCore } = useSWR<ScraperCoreResponse>(
        '/api/scraper',
        coreFetcher,
        { revalidateOnFocus: false, dedupingInterval: 30000 }
    );

    const { data: statsData, error: statsError, isLoading: statsLoading, mutate: refreshStats } = useSWR<ScraperStatsResponse>(
        '/api/scraper/stats',
        statsFetcher,
        { revalidateOnFocus: false, dedupingInterval: 60000 }
    );

    const runs = coreData?.runs ?? [];

    // Calculate derived stats
    const stats: ScraperStats = {
        totalRuns: runs.length,
        successRate: runs.length > 0
            ? Math.round((runs.filter(r => r.status === 'success').length / runs.length) * 100)
            : 0,
        avgMovies: runs.length > 0
            ? Math.round(runs.reduce((sum, r) => sum + r.movies, 0) / runs.length)
            : 0,
        avgTheatres: runs.length > 0
            ? Math.round(runs.reduce((sum, r) => sum + r.theatres_total, 0) / runs.length)
            : 0,
        lastRunTime: runs[0]?.timestamp ? formatWIBShort(runs[0].timestamp) : 'Never',
    };

    const refresh = () => {
        refreshCore();
        refreshStats();
    };

    return {
        runs,
        morningScrape: coreData?.todayMorningScrape ?? null,
        jitSummary: coreData?.todayJITSummary ?? null,
        collections: statsData?.collections ?? [],
        stats,
        isLoading: coreLoading,
        isStatsLoading: statsLoading,
        isError: !!coreError || !!statsError,
        refresh,
    };
}
