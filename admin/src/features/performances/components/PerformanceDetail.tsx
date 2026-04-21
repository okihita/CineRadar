'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Target, Users, Armchair, ChevronLeft, Globe, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MovieSummaryCard } from './MovieSummaryCard';
import { HistoryGrid } from './HistoryGrid';
import { PerformanceTrendCharts } from './PerformanceTrendCharts';
import { DailyStatsBanner } from './DailyStatsBanner';
import { MovieSummary } from '../types/performance';
import { getOccupancyColor } from '../utils/colors';
import { formatCompactNumber, formatOccupancy } from '../utils/format';
import { cn } from '@/lib/utils';

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
    const fetchMovie = useCallback(async () => {
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
        }
    }, [movieId]);

    useEffect(() => {
        setLoadingMovie(true);
        fetchMovie().finally(() => setLoadingMovie(false));
    }, [fetchMovie]);

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
            {/* Unified Intelligence Header (Mirroring Daily View) */}
            <div className="flex items-center justify-between gap-6 bg-muted/20 p-2 rounded-2xl border border-border/40 shadow-sm">
                {/* 1. LEFT: Movie Identity */}
                <div className="flex items-center gap-4 pl-2">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => router.push('/performances')}
                        className="h-8 w-8 hover:bg-background"
                    >
                        <ChevronLeft className="w-5 h-5" />
                    </Button>
                    <div className="flex-1">
                        <MovieSummaryCard movie={movie} />
                    </div>
                </div>

                {/* 2. CENTER: All-Time Performance HUD */}
                <div className="hidden lg:flex items-center gap-8 px-8 py-2 border-x border-border/30">
                    {/* All-Time Occupancy */}
                    <div className="flex flex-col items-center">
                        <div className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-muted-foreground/60 mb-0.5">
                            <Target className="w-3 h-3" />
                            ALL-TIME OCR
                        </div>
                        <div className="flex items-baseline gap-0.5">
                            <span className={cn(
                                "text-xl font-black font-mono tracking-tighter",
                                getOccupancyColor(movie.avg_occupancy_pct || 0)
                            )}>
                                {formatOccupancy(movie.avg_occupancy_pct)}
                            </span>

                            <span className="text-[10px] font-bold opacity-40 uppercase">%</span>
                        </div>
                    </div>

                    {/* Total Audience */}
                    <div className="flex flex-col items-center">
                        <div className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-muted-foreground/60 mb-0.5">
                            <Users className="w-3 h-3" />
                            Total Audience
                        </div>
                        <span className="text-xl font-black font-mono tracking-tighter tabular-nums text-foreground">
                            {formatCompactNumber(movie.total_sold)}
                        </span>
                    </div>

                    {/* Total Inventory */}
                    <div className="flex flex-col items-center">
                        <div className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-muted-foreground/60 mb-0.5">
                            <Armchair className="w-3 h-3" />
                            Total Inventory
                        </div>
                        <span className="text-xl font-black font-mono tracking-tighter tabular-nums text-foreground">
                            {formatCompactNumber(movie.total_seats)}
                        </span>
                    </div>

                    {/* Showtimes Count */}
                    <div className="flex flex-col items-center">
                        <div className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-muted-foreground/60 mb-0.5">
                            <Globe className="w-3 h-3" />
                            Total Units
                        </div>
                        <span className="text-xl font-black font-mono tracking-tighter text-foreground">
                            {movie.total_showtimes || 0}
                        </span>
                    </div>
                </div>

                {/* 3. RIGHT: Unified Context Pill */}
                <div className="hidden md:flex items-center gap-4 px-6 py-2.5 bg-zinc-900/5 dark:bg-white/5 rounded-xl border border-border/50">
                    <div className="flex flex-col items-end">
                        <div className="flex items-center gap-2 text-muted-foreground">
                            <Globe className="w-3.5 h-3.5 opacity-60" />
                            <span className="text-[10px] font-black uppercase tracking-widest opacity-60">
                                National Aggregated View
                            </span>
                        </div>
                        <a 
                            href={`https://console.firebase.google.com/project/cineradar-481014/firestore/databases/-default-/data/~2Fmovie_performance_v2~2F${movieId}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[8px] font-black uppercase text-primary hover:underline mt-0.5"
                        >
                            View in Firestore
                        </a>
                    </div>
                </div>
            </div>

            {/* Marketing DNA Strip (Parity with Daily View) */}
            <DailyStatsBanner
                stats={{
                    id: movie.id,
                    movie_id: movie.movie_id,
                    title: movie.title,
                    date: movie.last_updated,
                    total_showtimes: movie.total_showtimes || 0,
                    avg_occupancy_pct: movie.avg_occupancy_pct || 0,
                    total_seats: movie.total_seats || 0,
                    total_sold: movie.total_sold || 0,
                    cities: [],
                    marketing: movie.marketing
                }}
                onMarketingUpdate={fetchMovie}
            />

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
