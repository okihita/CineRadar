import { useMemo } from 'react';
import useSWR from 'swr';
import { fetcher } from '@/lib/api';
import {
    ScheduleResponse,
    MovieSchedule,
    countMovieShowtimes,
    countAvailableMovieShowtimes,
} from '../types';
import { computeRoomTypes, computeChainDistribution } from '../utils/schedule-helpers';

export interface ScheduleStats {
    totalMovies: number;
    totalShowtimes: number;
    totalAvailableShowtimes: number;
    totalTheatres: number;
}

export interface MovieWithStats extends MovieSchedule {
    showtimeCount: number;
    availableCount: number;
    roomTypes: Record<string, number>;
    delta: number | null; // showtime count difference vs previous day, null if no prev data
}

/**
 * Custom hook for schedule data fetching, deduplication, sorting,
 * stats computation, and day-over-day comparison — all memoized.
 */
export function useScheduleData(date: string) {
    // Current day
    const { data, error, isLoading } = useSWR<ScheduleResponse>(
        `/api/schedules?date=${date}`,
        fetcher
    );

    // Previous day for comparison
    const prevDate = getPreviousDate(date);
    const { data: prevData } = useSWR<ScheduleResponse>(
        prevDate ? `/api/schedules?date=${prevDate}` : null,
        fetcher
    );

    const rawMovies = data?.movies;
    const rawPrevMovies = prevData?.movies;

    const { movies, stats, chainDistribution } = useMemo(() => {
        if (!rawMovies || rawMovies.length === 0) {
            return {
                movies: [],
                stats: { totalMovies: 0, totalShowtimes: 0, totalAvailableShowtimes: 0, totalTheatres: 0 },
                chainDistribution: [],
            };
        }

        // Build previous day lookup: movie_id -> showtime count
        const prevMap = new Map<string, number>();
        if (rawPrevMovies) {
            for (const m of rawPrevMovies) {
                if (m.movie_id && m.cities) {
                    prevMap.set(m.movie_id, countMovieShowtimes(m.cities));
                }
            }
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
            const roomTypes = computeRoomTypes(m.cities);
            const prevCount = prevMap.get(m.movie_id);
            const delta = prevCount !== undefined ? showtimeCount - prevCount : null;

            return { ...m, showtimeCount, availableCount, roomTypes, delta };
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

        // Chain distribution
        const chainDistribution = computeChainDistribution(enriched);

        return {
            movies: enriched,
            stats: { totalMovies: enriched.length, totalShowtimes, totalAvailableShowtimes, totalTheatres },
            chainDistribution,
        };
    }, [rawMovies, rawPrevMovies]);

    return { movies, stats, chainDistribution, error, isLoading };
}

/** Returns the previous day in YYYY-MM-DD format */
function getPreviousDate(dateStr: string): string | null {
    const d = new Date(dateStr + 'T00:00:00');
    if (isNaN(d.getTime())) return null;
    d.setDate(d.getDate() - 1);
    return d.toISOString().slice(0, 10);
}
