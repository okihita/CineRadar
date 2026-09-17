'use client';

import { useMemo } from 'react';
import useSWR from 'swr';
import { fetcher } from '@/lib/api';
import { ApiResponse } from '@/types';
import { StreamMovieItem, StreamSummaryMetrics } from '../types';

interface QuickCountResponse {
    date: string;
    movies: StreamMovieItem[];
    summary: StreamSummaryMetrics;
}

export function useStreamData(date: string) {
    // Fetch dedicated real-time quick count feed (refreshes every 30s)
    const {
        data: rawData,
        error,
        isLoading,
        mutate,
    } = useSWR<ApiResponse<QuickCountResponse>>(
        date ? `/api/quick-count?date=${date}` : null,
        fetcher,
        {
            refreshInterval: 30000,
            revalidateOnFocus: false,
        }
    );

    const movies = useMemo(() => {
        return rawData?.success && Array.isArray(rawData.data?.movies)
            ? rawData.data.movies
            : [];
    }, [rawData]);

    const summary = useMemo<StreamSummaryMetrics>(() => {
        if (rawData?.success && rawData.data?.summary) {
            return rawData.data.summary;
        }
        return {
            date,
            totalShowtimes: 0,
            totalEstimatedAdmissions: 0,
            totalMonitoredSeats: 0,
            nationalAvgOccupancyPct: 0,
            activeMoviesCount: 0,
            circuits: [],
            lastSweptAt: null,
        };
    }, [rawData, date]);

    // Check if the selected date is a Thursday (Day 4 in JavaScript getDay())
    const isThursday = useMemo(() => {
        try {
            const d = new Date(`${date}T00:00:00`);
            return d.getDay() === 4;
        } catch {
            return false;
        }
    }, [date]);

    return {
        movies,
        summary,
        isLoading,
        error,
        isThursday,
        refresh: mutate,
    };
}
