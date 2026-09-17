'use client';

import { useMemo, useState, useEffect } from 'react';
import useSWR from 'swr';
import { fetcher } from '@/lib/api';
import { ApiResponse } from '@/types';
import { StreamMovieItem, StreamSummaryMetrics } from '../types';

interface QuickCountResponse {
    date: string;
    movies: StreamMovieItem[];
    summary: StreamSummaryMetrics;
}

export function getNextDropTarget(nowMs: number = Date.now()): { targetMs: number; timeStr: string } {
    const d = new Date(nowMs);
    const mins = d.getUTCMinutes();
    const target = new Date(d.getTime());
    target.setUTCSeconds(0, 0);

    if (mins < 5) {
        target.setUTCMinutes(5);
    } else if (mins < 35) {
        target.setUTCMinutes(35);
    } else {
        target.setUTCHours(target.getUTCHours() + 1);
        target.setUTCMinutes(5);
    }

    const formattedTime = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Asia/Jakarta',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
    }).format(target);

    return {
        targetMs: target.getTime(),
        timeStr: `${formattedTime} WIB`,
    };
}

export function useStreamData(date: string) {
    const [lastUpdatedAt, setLastUpdatedAt] = useState<number>(() => Date.now());

    // Fetch dedicated real-time quick count feed (refreshes at :05 and :35 WIB after backend sweeper)
    const {
        data: rawData,
        error,
        isLoading,
        isValidating,
        mutate,
    } = useSWR<ApiResponse<QuickCountResponse>>(
        date ? `/api/quick-count?date=${date}` : null,
        fetcher,
        {
            revalidateOnFocus: false,
            onSuccess: () => {
                setLastUpdatedAt(Date.now());
            },
        }
    );

    // Synchronize auto-refresh with backend Sweeper schedule (:05 and :35 WIB)
    useEffect(() => {
        let timer: NodeJS.Timeout;

        const scheduleNextFetch = () => {
            const now = Date.now();
            const { targetMs } = getNextDropTarget(now);
            // Delay until targetMs + 1000ms safety buffer
            const delay = Math.max(1000, targetMs - now + 1000);

            timer = setTimeout(() => {
                mutate();
                scheduleNextFetch();
            }, delay);
        };

        scheduleNextFetch();
        return () => clearTimeout(timer);
    }, [mutate]);

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
        isValidating,
        error,
        isThursday,
        refresh: mutate,
        lastUpdatedAt,
    };
}
