/**
 * Social Pulse Dashboard (Mockup)
 * 
 * Demonstrates the Industry Megaphone and Buzz Ranking.
 */
'use client';

import React, { useMemo } from 'react';
import useSWR from 'swr';
import { Share2, Loader2, AlertCircle, RefreshCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { fetcher } from '@/lib/api';
import { getTodayJakarta } from '@/lib/timeUtils';
import { ApiResponse } from '@/types';
import { MovieWithStats } from '@/features/performances/types/performance';
import { IndustryMegaphone } from '@/features/social-pulse/components/IndustryMegaphone';
import { DivergenceEngine } from '@/features/social-pulse/components/DivergenceEngine';
import { MovieBuzz, SocialSignal } from '@/features/social-pulse/types';

export default function SocialPulsePage() {
    const today = getTodayJakarta();
    const { data, isLoading, error, mutate } = useSWR(`/api/performance?date=${today}`, fetcher);
    
    const result = data as ApiResponse<{ movies: MovieWithStats[] }> | undefined;

    // Mock narrative and signals
    const mockNarrative = "Nostalgia factor for 'DILAN 1997' is perfectly synced with sales, while 'VINA' shows classic 'Pent-up Demand' where search volume is outstripping available tickets in secondary cities.";
    const mockSignals: SocialSignal[] = [
        {
            source: 'YouTube',
            author: 'Cine Crib',
            title: 'DILAN 1997 REVIEW - Nostalgia Brutal!',
            url: 'https://youtube.com',
            engagement_score: 95,
            sentiment: 'positive',
            views: '120K Views',
            timestamp: new Date().toISOString()
        },
        {
            source: 'YouTube',
            author: 'WatchmenID',
            title: 'Kenapa Vina Bisa Viral?',
            url: 'https://youtube.com',
            engagement_score: 88,
            sentiment: 'positive',
            views: '85K Views',
            timestamp: new Date().toISOString()
        }
    ];

    // Enrich existing movies with Divergence Logic
    const enrichedMovies: MovieBuzz[] = useMemo(() => {
        const rawMovies = result?.success ? result.data.movies : [];
        
        return rawMovies.slice(0, 10).map((m, i) => {
            // Use fixed values for mockup stability (Math.random is impure in render)
            const buzzScore = Math.max(30, 95 - (i * 8));
            const salesScore = Math.max(20, buzzScore - (i === 1 ? 30 : i === 4 ? -15 : 5));
            
            let insight: MovieBuzz['insight'] = 'synced';
            if (buzzScore - salesScore > 20) insight = 'pent-up';
            if (salesScore - buzzScore > 10) insight = 'over-hyped';
            if (buzzScore < 50 && salesScore < 40) insight = 'fading';

            let momentum: MovieBuzz['momentum'] = 'stable';
            if (i === 1) momentum = 'rising';
            if (i > 6) momentum = 'falling';

            // Static trend for mockup
            const trends_7d = [40, 45, 50, 60, 75, 90, 85, 80, 70, 60, 55, 50, 55, 65];

            return {
                metadata_id: m.id,
                title: m.title,
                poster: m.poster,
                buzz_score: buzzScore,
                sales_score: salesScore,
                momentum,
                insight,
                top_keywords: [m.title.split(' ')[0].toLowerCase(), 'bioskop', 'review'],
                trends_7d,
                metrics: {
                    google_trends: buzzScore,
                    youtube_velocity: buzzScore - 10,
                    ocr_pct: m.today?.avg_occupancy_pct || 0
                }
            } satisfies MovieBuzz;
        }).sort((a, b) => b.buzz_score - a.buzz_score);
    }, [result]);

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
            <DivergenceEngine movies={enrichedMovies} />

            {/* Empty State fallback */}
            {enrichedMovies.length === 0 && (
                <div className="py-20 text-center border-2 border-dashed rounded-3xl border-border/40">
                    <p className="text-muted-foreground font-bold uppercase tracking-widest">No active titles found to analyze.</p>
                </div>
            )}
        </div>
    );
}
