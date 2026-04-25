/**
 * Performance Pulse Dashboard
 * 
 * Orchestrates the Live Monitoring Station.
 * Decomposed into: NationalPulseHud, PerformanceBentoGrid, and MarketGrid.
 */
'use client';

import { useState, useEffect, useMemo } from 'react';
import { Globe } from 'lucide-react';
import { NationalPulseHud } from './dashboard/NationalPulseHud';
import { PerformanceBentoGrid } from './dashboard/PerformanceBentoGrid';
import { MarketGrid } from './dashboard/MarketGrid';
import { ForensicHealthSheet } from './ForensicHealthSheet';
import { MovieWithStats, DiagnosticData } from '../types/performance';
import { ApiResponse } from '@/types';

export function PerformanceTab() {
    const [movies, setMovies] = useState<MovieWithStats[]>([]);
    const [diagnostic, setDiagnostic] = useState<DiagnosticData | null>(null);
    const [loadingMovies, setLoadingMovies] = useState(true);
    const [telemetry, setTelemetry] = useState<{ elapsed: number; size: number } | null>(null);

    // 1. Fetch Movies List (Filtered to Active by API)
    useEffect(() => {
        async function fetchMovies() {
            const start = performance.now();
            try {
                const res = await fetch('/api/performance');
                const text = await res.text();
                const result: ApiResponse<{ movies: MovieWithStats[]; diagnostic: DiagnosticData }> = JSON.parse(text);

                const end = performance.now();
                if (result.success) {
                    setMovies(result.data.movies);
                    setDiagnostic(result.data.diagnostic);
                    setTelemetry({
                        elapsed: (end - start) / 1000,
                        size: new Blob([text]).size / 1024
                    });
                }
            } catch (e) {
                console.error(String(e));
            } finally {
                setLoadingMovies(false);
            }
        }
        fetchMovies();
    }, []);


    // --- Aggregated National Pulse ---
    const nationalPulse = useMemo(() => {
        const totalSold = movies.reduce((sum, m) => sum + (m.today?.total_sold || 0), 0);
        const totalSeats = movies.reduce((sum, m) => sum + (m.today?.total_seats || 0), 0);
        const totalShows = movies.reduce((sum, m) => sum + (m.today?.total_showtimes || 0), 0);
        const avgOCR = totalSeats > 0 ? (totalSold / totalSeats * 100) : 0;
        
        return { totalSold, totalShows, avgOCR, activeCount: movies.length };
    }, [movies]);

    // --- Slicing for Bento vs Grid ---
    const bentoMovies = movies.slice(0, 3);
    const gridMovies = movies.slice(3);

    // Loading Skeleton
    if (loadingMovies) {
        return (
            <div className="space-y-10 animate-pulse">
                <div className="h-16 w-full bg-muted rounded-2xl border border-dashed border-border/60" />
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="md:col-span-2 h-[400px] bg-muted rounded-2xl" />
                    <div className="space-y-6">
                        <div className="h-[190px] bg-muted rounded-2xl" />
                        <div className="h-[190px] bg-muted rounded-2xl" />
                    </div>
                </div>
            </div>
        );
    }

    if (movies.length === 0 && !loadingMovies) {
        return (
            <div className="py-20 text-center border border-dashed rounded-3xl bg-muted/5 flex flex-col items-center gap-4">
                <Globe className="w-12 h-12 mx-auto text-muted-foreground/20" />
                <p className="text-muted-foreground font-medium uppercase tracking-widest text-sm">No Active Movies Found in Today&apos;s Market</p>
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
                telemetry={telemetry}
            />

            {/* 2. THE INSIGHT BENTO (Top 6) */}
            <PerformanceBentoGrid movies={bentoMovies} />

            {/* 3. NOW SHOWING (Rank 7+) */}
            <MarketGrid movies={gridMovies} />
        </div>
    );
}
