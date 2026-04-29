import { useMemo } from 'react';
import useSWR from 'swr';
import { fetcher } from '@/lib/api';
import {
    ScheduleResponse,
    MovieSchedule,
    countMovieShowtimes,
    countAvailableMovieShowtimes,
} from '../types';

export interface ScheduleStats {
    totalMovies: number;
    totalShowtimes: number;
    totalAvailableShowtimes: number;
    totalTheatres: number;
}

export interface MovieWithStats extends MovieSchedule {
    showtimeCount: number;
    availableCount: number;
}

/**
 * Custom hook for schedule data fetching, deduplication, sorting,
 * and stats computation — all memoized.
 */
export function useScheduleData(date: string) {
    const { data, error, isLoading } = useSWR<ScheduleResponse>(
        `/api/schedules?date=${date}`,
        fetcher
    );

    const rawMovies = data?.movies;

    const { movies, stats } = useMemo(() => {
        if (!rawMovies || rawMovies.length === 0) {
            return { movies: [], stats: { totalMovies: 0, totalShowtimes: 0, totalAvailableShowtimes: 0, totalTheatres: 0 } };
        }

        // Deduplicate by movie_id, skipping malformed documents
        const uniqueMovies = new Map<string, MovieSchedule>();
        for (const m of rawMovies) {
            if (!m.movie_id) {
                console.warn('[useScheduleData] Dropping movie without movie_id:', m.title || m);
                continue;
            }
            if (!uniqueMovies.has(m.movie_id)) {
                uniqueMovies.set(m.movie_id, m);
            }
        }

        // Compute per-movie stats and sort
        const enriched: MovieWithStats[] = Array.from(uniqueMovies.values()).map((m) => {
            const showtimeCount = m.cities ? countMovieShowtimes(m.cities) : 0;
            const availableCount = m.cities ? countAvailableMovieShowtimes(m.cities) : 0;
            return { ...m, showtimeCount, availableCount };
        });

        enriched.sort((a, b) => b.showtimeCount - a.showtimeCount);

        // Aggregate stats
        let totalShowtimes = 0;
        let totalAvailableShowtimes = 0;
        let totalTheatres = 0;

        enriched.forEach((m) => {
            totalShowtimes += m.showtimeCount;
            totalAvailableShowtimes += m.availableCount;
            if (m.cities) {
                Object.values(m.cities).forEach((theatres) => {
                    totalTheatres += theatres.length;
                });
            }
        });

        return {
            movies: enriched,
            stats: {
                totalMovies: enriched.length,
                totalShowtimes,
                totalAvailableShowtimes,
                totalTheatres,
            },
        };
    }, [rawMovies]);

    return { movies, stats, error, isLoading };
}
