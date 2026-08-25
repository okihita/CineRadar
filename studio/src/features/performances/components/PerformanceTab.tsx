/**
 * Performance Pulse Dashboard
 * 
 * Orchestrates the Live Monitoring Station.
 * Decomposed into: NationalPulseHud, PerformanceBentoGrid, and MarketGrid.
 */
'use client';

import { useMemo } from 'react';
import { Globe, AlertCircle } from 'lucide-react';
import { NationalPulseHud } from './dashboard/NationalPulseHud';
import { PerformanceBentoGrid } from './dashboard/PerformanceBentoGrid';
import { MarketGrid } from './dashboard/MarketGrid';
import { ForensicHealthSheet } from './ForensicHealthSheet';
import { PerformanceTabSkeleton } from './skeletons/PerformanceTabSkeleton';
import { MovieWithStats, DiagnosticData } from '../types/performance';

interface PerformanceTabProps {
    date: string; // YYYY-MM-DD
    movies: MovieWithStats[];
    diagnostic: DiagnosticData | null;
    isLoading: boolean;
    error: Error | null;
}

export function PerformanceTab({ movies, diagnostic, isLoading, error }: PerformanceTabProps) {
    // --- Aggregated National Pulse (must be above all early returns) ---
    const nationalPulse = useMemo(() => {
        const totalSold = movies.reduce((sum: number, m: MovieWithStats) => sum + (m.today?.total_sold ?? 0), 0);
        const totalSeats = movies.reduce((sum: number, m: MovieWithStats) => sum + (m.today?.total_seats ?? 0), 0);
        const totalShows = movies.reduce((sum: number, m: MovieWithStats) => sum + (m.today?.total_showtimes ?? 0), 0);
        const avgOCR = totalSeats > 0 ? (totalSold / totalSeats * 100) : 0;
        
        return { totalSold, totalShows, avgOCR, activeCount: movies.length };
    }, [movies]);

    // --- Slicing for Bento vs Grid ---
    const bentoMovies = movies.slice(0, 3);
    const gridMovies = movies.slice(3);

    // --- Conditional renders (after all hooks) ---
    if (isLoading) {
        return <PerformanceTabSkeleton />;
    }

    if (error) {
        return (
            <div className="py-20 text-center border border-dashed rounded-3xl bg-red-500/5 flex flex-col items-center gap-4">
                <AlertCircle className="w-12 h-12 mx-auto text-red-500" />
                <p className="text-red-600 font-medium">Failed to load performance data</p>
                <p className="text-sm text-muted-foreground">{error.message}</p>
            </div>
        );
    }

    if (movies.length === 0) {
        return (
            <div className="py-20 text-center border border-dashed rounded-3xl bg-muted/5 flex flex-col items-center gap-4">
                <Globe className="w-12 h-12 mx-auto text-muted-foreground/20" />
                <p className="text-muted-foreground font-medium uppercase tracking-widest text-sm">
                    No performance data available for this date
                </p>
                <p className="text-[11px] text-muted-foreground/50">
                    Data collection started December 2025
                </p>
                {diagnostic && <ForensicHealthSheet diagnostic={diagnostic} />}
            </div>
        );
    }

    return (
        <div className="space-y-10 animate-in fade-in duration-700 pb-20">
            {/* 1. NATIONAL MOMENTUM HUD */}
            <NationalPulseHud 
                avgOCR={nationalPulse.avgOCR}
                totalSold={nationalPulse.totalSold}
                totalShows={nationalPulse.totalShows}
                activeCount={nationalPulse.activeCount}
                diagnostic={diagnostic}
            />

            {/* 2. THE INSIGHT BENTO (Top 6) */}
            <PerformanceBentoGrid movies={bentoMovies} />

            {/* 3. NOW SHOWING (Rank 7+) */}
            <MarketGrid movies={gridMovies} />
        </div>
    );
}
