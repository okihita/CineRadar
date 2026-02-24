'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Target, Loader2, ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MovieSummaryCard } from './MovieSummaryCard';
import { HistoryGrid } from './HistoryGrid';
import { PerformanceTrendCharts } from './PerformanceTrendCharts';

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

interface PerformanceDetailProps {
    movieId: string;
}

export function PerformanceDetail({ movieId }: PerformanceDetailProps) {
    const router = useRouter();
    const [movie, setMovie] = useState<MovieSummary | null>(null);
    const [history, setHistory] = useState<DailyPerformance[]>([]);
    const [loadingMovie, setLoadingMovie] = useState(true);
    const [loadingHistory, setLoadingHistory] = useState(true);

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

    // 2. Fetch History
    useEffect(() => {
        async function fetchHistory() {
            try {
                const res = await fetch(`/api/performance/${movieId}/history`);
                const data = await res.json();
                if (data.success) {
                    setHistory(data.history);
                }
            } catch (e) {
                console.error('Error fetching history:', e);
            } finally {
                setLoadingHistory(false);
            }
        }
        fetchHistory();
    }, [movieId]);

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
            <div className="flex items-start gap-4">
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => router.push('/performances')}
                    className="mt-1"
                >
                    <ChevronLeft className="w-6 h-6" />
                </Button>
                <MovieSummaryCard movie={movie} />
            </div>

            {/* Visual Trends */}
            {!loadingHistory && history.length > 0 && (
                <PerformanceTrendCharts history={history} />
            )}

            {/* Daily History Grid */}
            <div className="mt-8">
                <h2 className="text-xl font-semibold tracking-tight mb-2">Performance History</h2>
                <p className="text-sm text-muted-foreground mb-4">Select a specific date to view detailed seating performance across all theaters.</p>

                {loadingHistory ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Loading history...
                    </div>
                ) : (
                    <HistoryGrid movieId={movieId} history={history} />
                )}
            </div>
        </div>
    );
}
