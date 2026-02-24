'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Target, Loader2, ChevronLeft, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MovieSummaryCard } from './MovieSummaryCard';
import { DailyStatsBanner } from './DailyStatsBanner';
import { ShowtimeTable, ShowtimeSnapshot } from './ShowtimeTable';

interface MovieSummary {
    id: string;
    movie_id: string;
    title: string;
    poster: string;
    last_updated: string;
    genres?: string;
    age_category?: string;
}

interface DailyPerformance {
    date: string;
    total_showtimes: number;
    avg_occupancy_pct: number;
    total_seats: number;
    total_sold: number;
    cities: string[];
}

interface DailyPerformanceDetailProps {
    movieId: string;
    date: string;
}

export function DailyPerformanceDetail({ movieId, date }: DailyPerformanceDetailProps) {
    const router = useRouter();
    const [movie, setMovie] = useState<MovieSummary | null>(null);
    const [dailyStats, setDailyStats] = useState<DailyPerformance | null>(null);
    const [showtimes, setShowtimes] = useState<ShowtimeSnapshot[]>([]);

    // Loading states
    const [loadingMovie, setLoadingMovie] = useState(true);
    const [loadingStats, setLoadingStats] = useState(true);
    const [loadingShowtimes, setLoadingShowtimes] = useState(true);

    // 1. Fetch Movie Summary
    useEffect(() => {
        async function fetchMovie() {
            try {
                const res = await fetch(`/api/performance/${movieId}`);
                const data = await res.json();
                if (data.success) {
                    setMovie(data.summary);
                } else {
                    console.error('Failed to load movie:', data.error);
                }
            } catch (e) {
                console.error('Error fetching movie:', e);
            } finally {
                setLoadingMovie(false);
            }
        }
        fetchMovie();
    }, [movieId]);

    // 2. Fetch specific day's stats
    useEffect(() => {
        async function fetchDailyStats() {
            try {
                const res = await fetch(`/api/performance/${movieId}/history`);
                const data = await res.json();
                if (data.success) {
                    const stats = data.history.find((d: DailyPerformance) => d.date === date);
                    if (stats) {
                        setDailyStats(stats);
                    }
                }
            } catch (e) {
                console.error('Error fetching history/stats:', e);
            } finally {
                setLoadingStats(false);
            }
        }
        fetchDailyStats();
    }, [movieId, date]);

    // 3. Fetch Showtimes for this date
    useEffect(() => {
        async function fetchShowtimes() {
            setLoadingShowtimes(true);
            try {
                const res = await fetch(`/api/performance/${movieId}/days/${date}`);
                const data = await res.json();
                if (data.success) {
                    setShowtimes(data.showtimes);
                }
            } catch (e) {
                console.error('Error fetching showtimes:', e);
            } finally {
                setLoadingShowtimes(false);
            }
        }
        fetchShowtimes();
    }, [movieId, date]);

    if (loadingMovie) {
        return (
            <div className="flex items-center justify-center min-h-[50vh]">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    if (!movie) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4">
                <Target className="w-12 h-12 text-muted-foreground" />
                <h2 className="text-xl font-semibold">Movie not found</h2>
                <Button onClick={() => router.push('/performances')}>Back to Performances</Button>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background text-foreground p-6 space-y-6 animate-in fade-in duration-500">
            {/* Header / Nav */}
            <div className="flex items-start justify-between">
                <div className="flex items-start gap-4">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => router.push(`/performances/${movieId}`)}
                        className="mt-1"
                    >
                        <ChevronLeft className="w-6 h-6" />
                    </Button>
                    <MovieSummaryCard movie={movie} />
                </div>

                {/* Date Highlight */}
                <div className="hidden md:flex flex-col items-end bg-muted/30 px-6 py-3 rounded-lg border">
                    <div className="flex items-center gap-2 text-muted-foreground mb-1">
                        <Calendar className="w-4 h-4" />
                        <span className="text-xs font-semibold uppercase tracking-wider">Viewing Details For</span>
                    </div>
                    <span className="text-2xl font-bold font-mono tracking-tight text-primary">
                        {date}
                    </span>
                </div>
            </div>

            {/* Daily Stats Banner */}
            {loadingStats ? (
                <div className="py-8 flex justify-center">
                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground/50" />
                </div>
            ) : dailyStats ? (
                <DailyStatsBanner stats={dailyStats} />
            ) : (
                <div className="p-4 border rounded-md bg-muted/50 text-center text-sm text-muted-foreground">
                    No summary stats found for this date.
                </div>
            )}

            {/* Showtime Table */}
            <ShowtimeTable showtimes={showtimes} loading={loadingShowtimes} />
        </div>
    );
}
