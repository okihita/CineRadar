/**
 * Social Pulse Dashboard
 * 
 * Cross-platform sentiment analysis and buzz tracking.
 */
'use client';

import React, { useMemo, useState } from 'react';
import useSWR from 'swr';
import { Share2, Loader2, AlertCircle, RefreshCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { fetcher } from '@/lib/api';
import { getTodayJakarta } from '@/lib/timeUtils';
import { ApiResponse } from '@/types';
import { MovieWithStats } from '@/features/performances/types/performance';
import { IndustryMegaphone } from '@/features/social-pulse/components/IndustryMegaphone';
import { DivergenceEngine } from '@/features/social-pulse/components/DivergenceEngine';
import { MovieDeepDive } from '@/features/social-pulse/components/MovieDeepDive';
import { useMovieEnrichment, useNarrative, useSignals } from '@/features/social-pulse/hooks/useMovieEnrichment';

export default function SocialPulsePage() {
    const today = getTodayJakarta();
    const { data, isLoading, error, mutate } = useSWR(`/api/performance?date=${today}`, fetcher);
    const [selectedMovieId, setSelectedMovieId] = useState<string | null>(null);

    const result = data as ApiResponse<{ movies: MovieWithStats[] }> | undefined;
    const rawMovies = useMemo(() => result?.success ? result.data.movies : [], [result]);

    const { enrichedMovies } = useMovieEnrichment(rawMovies);
    const mockNarrative = useNarrative(enrichedMovies);
    const mockSignals = useSignals(enrichedMovies);

    const selectedMovie = useMemo(
        () => enrichedMovies.find(m => m.metadata_id === selectedMovieId),
        [enrichedMovies, selectedMovieId]
    );

    if (isLoading) {
        return (
            <div className="h-screen flex flex-col items-center justify-center gap-4">
                <Loader2 className="w-8 h-8 text-primary animate-spin" />
                <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Synchronizing Social Signals...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="h-screen flex flex-col items-center justify-center gap-4 px-6 text-center">
                <AlertCircle className="w-12 h-12 text-red-500" />
                <h2 className="text-xl font-black uppercase tracking-tighter">Connection Interrupted</h2>
                <p className="text-sm text-muted-foreground max-w-xs">Failed to fetch the current market pulse. Check your network or API keys.</p>
                <Button onClick={() => mutate()} variant="outline" className="mt-4 rounded-xl">Retry Sync</Button>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background text-foreground p-6 max-w-[1600px] mx-auto space-y-10 animate-in fade-in duration-700">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-primary/10 rounded-xl text-primary">
                            <Share2 className="w-6 h-6" />
                        </div>
                        <h1 className="text-3xl font-black uppercase tracking-tighter">Social Pulse</h1>
                    </div>
                    <p className="text-muted-foreground text-sm font-medium">
                        Cross-platform sentiment analysis and buzz tracking for <span className="text-foreground font-bold">Today</span>
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <div className="hidden md:flex flex-col items-end px-4 border-r border-border/40">
                        <span className="text-[10px] font-black uppercase text-muted-foreground/60 tracking-widest">Data Source</span>
                        <span className="text-[10px] font-bold text-primary uppercase">YT + Google + TMDB</span>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => mutate()} className="h-10 px-4 gap-2 rounded-xl border-border/60 hover:bg-muted transition-all">
                        <RefreshCcw className="w-4 h-4" />
                        Force Rescan
                    </Button>
                </div>
            </div>

            {/* 1. Industry Megaphone (Influencer Insight) */}
            <IndustryMegaphone narrative={mockNarrative} signals={mockSignals} />

            {/* 2. The Divergence Engine (Buzz vs Sales) */}
            <DivergenceEngine movies={enrichedMovies} onMovieClick={(id) => setSelectedMovieId(id)} />

            {/* 3. Detailed Forensic Overlay (Slide-over) */}
            <MovieDeepDive 
                movie={selectedMovie || null} 
                open={!!selectedMovieId} 
                onOpenChange={(open) => !open && setSelectedMovieId(null)} 
            />

            {/* Empty State fallback */}
            {enrichedMovies.length === 0 && (
                <div className="py-20 text-center border-2 border-dashed rounded-3xl border-border/40">
                    <p className="text-muted-foreground font-bold uppercase tracking-widest">No active titles found to analyze.</p>
                </div>
            )}
        </div>
    );
}
