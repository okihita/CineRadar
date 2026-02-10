import useSWR from 'swr';
import type { MorningScrape, JITSummary, ScraperStats, ScraperLog } from '../types';
import { formatWIBShort } from '@/lib/timeUtils';
import { REFRESH_INTERVALS } from '@/lib/constants';

interface HistoryResponse {
    logs: ScraperLog[];
}


interface TodayResponse {
    log: ScraperLog;
    jitSummary: JITSummary | null;
    date: string;
}

const historyFetcher = async (url: string): Promise<HistoryResponse> => {
    const res = await fetch(url);
    if (!res.ok) throw new Error('Failed to fetch scraper logs');
    return res.json();
};


const todayFetcher = async (url: string): Promise<TodayResponse | null> => {
    const res = await fetch(url);
    if (res.status === 404) return null;
    if (!res.ok) throw new Error('Failed to fetch today log');
    return res.json();
};

export function useScraperData() {
    // 1. History API (New scraper_logs)
    const { data: historyData, error: historyError, isLoading: historyLoading, mutate: refreshHistory } = useSWR<HistoryResponse>(
        '/api/scraper',
        historyFetcher,
        { revalidateOnFocus: false, dedupingInterval: REFRESH_INTERVALS.FAST }
    );

    // 2. New API for today's status
    const { data: todayData, error: todayError, isLoading: todayLoading, mutate: refreshToday } = useSWR<TodayResponse | null>(
        '/api/scraper/today',
        todayFetcher,
        { revalidateOnFocus: true, dedupingInterval: REFRESH_INTERVALS.FAST }
    );


    const logs = historyData?.logs ?? [];

    // Calculate derived stats from logs
    const stats: ScraperStats = {
        totalRuns: logs.length,
        successRate: logs.length > 0
            ? Math.round((logs.filter(l => l.morning_run?.status === 'success').length / logs.length) * 100)
            : 0,
        avgMovies: logs.length > 0
            ? Math.round(logs.reduce((sum, l) => sum + (l.morning_run?.movies_found || 0), 0) / logs.length)
            : 0,
        avgTheatres: logs.length > 0
            ? Math.round(logs.reduce((sum, l) => sum + (l.morning_run?.theatres_total || 0), 0) / logs.length)
            : 0,
        lastRunTime: logs[0]?.created_at ? formatWIBShort(logs[0].created_at) : 'Never',
    };

    // Transform new ScraperLog to MorningScrape for UI
    const morningScrape: MorningScrape | null = todayData?.log.morning_run ? {
        status: todayData.log.morning_run.status,
        timestamp: todayData.log.morning_run.end_time || todayData.log.morning_run.start_time || todayData.log.created_at,
        movies: todayData.log.morning_run.movies_found,
        cities: todayData.log.morning_run.cities_covered,
        theatres: todayData.log.morning_run.theatres_total,
    } : null;

    const refresh = () => {
        refreshHistory();
        refreshToday();
    };

    return {
        logs, // Expose logs directly instead of runs
        morningScrape,
        jitSummary: todayData?.jitSummary ?? null,
        stats,
        isLoading: historyLoading || todayLoading,
        isError: !!historyError || !!todayError,
        refresh,
    };
}
