'use client';

import { useMemo } from 'react';
import useSWR from 'swr';
import { fetcher } from '@/lib/api';
import { ApiResponse } from '@/types';
import { MovieWithStats } from '@/features/performances/types/performance';
import { MovieSchedule } from '@/features/schedules/types';
import { StreamMovieItem, StreamSummaryMetrics, StreamCircuitBreakdown } from '../types';

interface PerformanceResponse {
    date: string;
    movies: MovieWithStats[];
}

interface SchedulesResponse {
    date: string;
    count: number;
    movies: MovieSchedule[];
}

export function useStreamData(date: string) {
    // 1. Fetch Performance Metrics (Every 30s for live JIT audience sweeps)
    const {
        data: perfRaw,
        error: perfError,
        isLoading: perfLoading,
        mutate: mutatePerf,
    } = useSWR<ApiResponse<PerformanceResponse>>(
        date ? `/api/performance?date=${date}` : null,
        fetcher,
        {
            refreshInterval: 30000,
            revalidateOnFocus: false,
        }
    );

    // 2. Fetch Schedules for Circuit & Metadata Enrichment (Every 60s)
    const {
        data: schedRaw,
        error: schedError,
        isLoading: schedLoading,
    } = useSWR<SchedulesResponse>(
        date ? `/api/schedules?date=${date}` : null,
        fetcher,
        {
            refreshInterval: 60000,
            revalidateOnFocus: false,
        }
    );

    const perfMovies = useMemo(() => {
        return perfRaw?.success && Array.isArray(perfRaw.data?.movies)
            ? perfRaw.data.movies
            : [];
    }, [perfRaw]);

    const schedMovieMap = useMemo(() => {
        const map = new Map<string, MovieSchedule>();
        if (schedRaw?.movies && Array.isArray(schedRaw.movies)) {
            schedRaw.movies.forEach((m) => {
                map.set(m.movie_id, m);
            });
        }
        return map;
    }, [schedRaw]);

    // Check if the selected date is a Thursday (Day 4 in JavaScript getDay() where Sunday is 0)
    const isThursday = useMemo(() => {
        try {
            const d = new Date(`${date}T00:00:00`);
            return d.getDay() === 4;
        } catch {
            return false;
        }
    }, [date]);

    // Compute rollups and ranked movies
    const { movies, summary } = useMemo(() => {
        let nationalShowtimes = 0;
        let nationalSold = 0;
        let nationalSeats = 0;
        const circuitShowtimesMap: Record<string, { showtimes: number; theatres: Set<string> }> = {
            XXI: { showtimes: 0, theatres: new Set() },
            CGV: { showtimes: 0, theatres: new Set() },
            Cinépolis: { showtimes: 0, theatres: new Set() },
            FLIX: { showtimes: 0, theatres: new Set() },
        };

        const timestamps: string[] = [];

        // Pre-calculate sums for market share calculations
        perfMovies.forEach((m) => {
            const showtimes = m.today?.total_showtimes || 0;
            const sold = m.today?.total_sold || 0;
            const seats = m.today?.total_seats || 0;
            nationalShowtimes += showtimes;
            nationalSold += sold;
            nationalSeats += seats;

            if (m.today?.last_swept_at) {
                timestamps.push(m.today.last_swept_at);
            }
        });

        // Scan schedules for circuit breakdown
        if (schedRaw?.movies) {
            schedRaw.movies.forEach((sm) => {
                if (!sm.cities) return;
                Object.values(sm.cities).forEach((theatres) => {
                    theatres.forEach((t) => {
                        const merchant = t.merchant || '';
                        let targetChain: 'XXI' | 'CGV' | 'Cinépolis' | 'FLIX' | null = null;
                        if (merchant.includes('XXI')) targetChain = 'XXI';
                        else if (merchant.includes('CGV')) targetChain = 'CGV';
                        else if (merchant.includes('CINEPOLIS') || merchant.includes('CINÉPOLIS')) targetChain = 'Cinépolis';
                        else if (merchant.includes('FLIX')) targetChain = 'FLIX';

                        if (targetChain) {
                            const showtimesCount = (t.rooms || []).reduce((acc, r) => acc + (r.all_showtimes?.length || 0), 0);
                            circuitShowtimesMap[targetChain].showtimes += showtimesCount;
                            circuitShowtimesMap[targetChain].theatres.add(t.theatre_id || t.theatre_name);
                        }
                    });
                });
            });
        }

        const circuits: StreamCircuitBreakdown[] = (['XXI', 'CGV', 'Cinépolis', 'FLIX'] as const).map((chain) => {
            const entry = circuitShowtimesMap[chain];
            const sharePct = nationalShowtimes > 0 ? (entry.showtimes / nationalShowtimes) * 100 : 0;
            return {
                name: chain,
                showtimes: entry.showtimes,
                theatres: entry.theatres.size,
                sharePct: Number(sharePct.toFixed(1)),
            };
        });

        // Enrich and rank movies
        const enrichedList: StreamMovieItem[] = perfMovies
            .filter((m) => (m.today?.total_showtimes || 0) > 0)
            .map((m, index) => {
                const sched = schedMovieMap.get(m.id) || schedMovieMap.get(m.movie_id);
                const showtimes = m.today?.total_showtimes || 0;
                const sold = m.today?.total_sold || 0;
                const seats = m.today?.total_seats || 0;
                const occupancy = m.today?.avg_occupancy_pct || (seats > 0 ? (sold / seats) * 100 : 0);
                const sharePct = nationalShowtimes > 0 ? (showtimes / nationalShowtimes) * 100 : 0;

                const merchants = sched?.merchants && sched.merchants.length > 0
                    ? sched.merchants
                    : ['XXI'];

                return {
                    id: m.id,
                    rank: index + 1,
                    title: m.title,
                    poster: m.poster || sched?.poster || '',
                    showtimes,
                    showtimeSharePct: Number(sharePct.toFixed(1)),
                    estimatedAdmissions: sold,
                    totalSeats: seats,
                    avgOccupancyPct: Number(occupancy.toFixed(1)),
                    merchants,
                    citiesCount: m.today?.cities?.length || Object.keys(sched?.cities || {}).length || 0,
                    genres: sched?.genres?.join(', ') || undefined,
                    ageCategory: sched?.age_category || undefined,
                    isPremiere: isThursday && !sched?.is_presale,
                    lastSweptAt: m.today?.last_swept_at,
                };
            });

        // Re-sort deterministically: Audience (estimatedAdmissions) DESC -> Showtimes DESC -> Title ASC
        enrichedList.sort((a, b) => {
            if (b.estimatedAdmissions !== a.estimatedAdmissions) {
                return b.estimatedAdmissions - a.estimatedAdmissions;
            }
            if (b.showtimes !== a.showtimes) {
                return b.showtimes - a.showtimes;
            }
            return a.title.localeCompare(b.title);
        });

        // Re-assign accurate ranks after sort
        enrichedList.forEach((m, idx) => {
            m.rank = idx + 1;
        });

        const latestTimestamp = timestamps.length > 0 ? timestamps.sort().reverse()[0] : null;
        const nationalAvgOccupancy = nationalSeats > 0 ? (nationalSold / nationalSeats) * 100 : 0;

        const summaryData: StreamSummaryMetrics = {
            date,
            totalShowtimes: nationalShowtimes,
            totalEstimatedAdmissions: nationalSold,
            totalMonitoredSeats: nationalSeats,
            nationalAvgOccupancyPct: Number(nationalAvgOccupancy.toFixed(1)),
            activeMoviesCount: enrichedList.length,
            circuits,
            lastSweptAt: latestTimestamp,
        };

        return { movies: enrichedList, summary: summaryData };
    }, [perfMovies, schedRaw, schedMovieMap, isThursday, date]);

    return {
        movies,
        summary,
        isLoading: perfLoading || schedLoading,
        error: perfError || schedError,
        isThursday,
        refresh: mutatePerf,
    };
}
