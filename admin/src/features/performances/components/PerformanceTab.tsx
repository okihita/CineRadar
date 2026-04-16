/**
 * Performance Pulse Dashboard
 * 
 * Transforms the movie list into a Live Monitoring Station.
 * Features: National HUD, Podium Leaders, and High-Density Grid.
 */
'use client';

import { useState, useEffect, useMemo } from 'react';
import { Target, Trophy, Clapperboard, Activity, Zap, Users, Globe } from 'lucide-react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { formatCompactNumber, formatOccupancy } from '../utils/format';
import { ForensicHealthSheet } from './ForensicHealthSheet';

interface TodayStats {
    date: string;
    total_showtimes: number;
    total_showtimes_scraped: number;
    avg_occupancy_pct: number;
    total_seats: number;
    total_sold: number;
    cities: string[];
}

interface MovieWithStats {
    id: string;
    movie_id: string;
    title: string;
    poster: string;
    last_updated: string;
    today?: TodayStats;
}

interface DiagnosticItem {
    id: string;
    title: string;
    has_metadata: boolean;
    has_performance: boolean;
    has_schedule: boolean;
    showtimes_count: number;
}

interface DiagnosticData {
    total_discovered: number;
    active_count: number;
    scheduled_count: number;
    items: DiagnosticItem[];
}

export function PerformanceTab() {
    const router = useRouter();
    const [movies, setMovies] = useState<MovieWithStats[]>([]);
    const [diagnostic, setDiagnostic] = useState<DiagnosticData | null>(null);
    const [loadingMovies, setLoadingMovies] = useState(true);

    // 1. Fetch Movies List (Filtered to Active by API)
    useEffect(() => {
        async function fetchMovies() {
            try {
                const res = await fetch('/api/performance');
                const data = await res.json();
                if (data.success) {
                    setMovies(data.movies);
                    setDiagnostic(data.diagnostic);
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

    // --- High-Density Display Slices ---
    const podium = movies.slice(0, 3);
    const gridMovies = movies.slice(3);

    // Loading Skeleton (High Fidelity)
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
        <div className="space-y-10 animate-in fade-in duration-700">
            
            {/* 1. NATIONAL MOMENTUM HUD */}
            <div className="flex flex-wrap items-center gap-6 px-6 py-4 bg-muted/20 border border-border/40 rounded-2xl shadow-sm">
                <div className="flex items-center gap-3 pr-6 border-r border-border/30">
                    <div className="relative">
                        <Activity className="w-5 h-5 text-green-500 animate-pulse" />
                        <div className="absolute inset-0 bg-green-500/20 blur-md rounded-full animate-pulse" />
                    </div>
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 leading-none mb-1">National Pulse Today</p>
                        <div className="text-xs font-bold text-green-600 uppercase tracking-tight flex items-center gap-1.5">
                            <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                            Market Live
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-8">
                    <div className="flex flex-col">
                        <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/50 mb-0.5 flex items-center gap-1.5">
                            <Target className="w-2.5 h-2.5" /> Market OCR
                        </span>
                        <span className="text-xl font-black font-mono tracking-tighter text-foreground">
                            {nationalPulse.avgOCR.toFixed(1)}<span className="text-xs opacity-30 ml-0.5">%</span>
                        </span>
                    </div>

                    <div className="flex flex-col">
                        <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/50 mb-0.5 flex items-center gap-1.5">
                            <Users className="w-2.5 h-2.5" /> Total Sales
                        </span>
                        <span className="text-xl font-black font-mono tracking-tighter text-foreground">
                            {formatCompactNumber(nationalPulse.totalSold)}
                        </span>
                    </div>

                    <div className="flex flex-col">
                        <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/50 mb-0.5 flex items-center gap-1.5">
                            <Zap className="w-2.5 h-2.5" /> Active Shows
                        </span>
                        <span className="text-xl font-black font-mono tracking-tighter text-foreground">
                            {nationalPulse.totalShows.toLocaleString()}
                        </span>
                    </div>
                </div>

                <div className="ml-auto flex items-center gap-4">
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-background/50 rounded-xl border border-border/50">
                        <Globe className="w-3.5 h-3.5 text-primary opacity-60" />
                        <span className="text-[10px] font-black uppercase tracking-widest opacity-60">{movies.length} Active Titles</span>
                    </div>
                    {diagnostic && <ForensicHealthSheet diagnostic={diagnostic} />}
                </div>
            </div>

            {/* 2. THE PODIUM (Top 3 Performance) */}
            {podium.length > 0 && (
                <section>
                    <div className="flex items-center gap-2 mb-6">
                        <Trophy className="w-5 h-5 text-amber-500" />
                        <h2 className="text-sm font-black uppercase tracking-[0.2em] text-muted-foreground">Market Leaders</h2>
                    </div>
                    
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                        {/* CHAMPION (#1) */}
                        <div 
                            className="lg:col-span-7 group relative overflow-hidden rounded-3xl bg-zinc-950 aspect-[16/9] lg:aspect-auto lg:h-[450px] cursor-pointer shadow-xl border border-white/5"
                            onClick={() => router.push(`/performances/${podium[0].id}`)}
                        >
                            <Image 
                                src={podium[0].poster} 
                                alt={podium[0].title} 
                                fill 
                                className="object-cover opacity-60 transition-transform duration-1000 group-hover:scale-105 group-hover:opacity-40"
                                priority
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/20 to-transparent" />
                            
                            <div className="absolute top-6 left-6 flex items-center gap-3">
                                <div className="w-12 h-12 rounded-2xl bg-amber-500 flex items-center justify-center text-white text-2xl font-black shadow-lg shadow-amber-500/20">#1</div>
                                <div className="px-3 py-1.5 backdrop-blur-md bg-white/10 rounded-xl border border-white/10">
                                    <span className="text-[10px] font-black uppercase tracking-widest text-white">National Champion</span>
                                </div>
                            </div>

                            <div className="absolute bottom-8 left-8 right-8">
                                <h3 className="text-4xl font-black text-white mb-4 tracking-tighter drop-shadow-md">{podium[0].title}</h3>
                                <div className="flex flex-wrap gap-6 items-center">
                                    <div className="flex flex-col">
                                        <span className="text-[10px] font-black text-white/40 uppercase tracking-widest mb-1">True OCR</span>
                                        <span className="text-3xl font-black font-mono text-green-400 leading-none">
                                            {formatOccupancy(podium[0].today?.avg_occupancy_pct)}<span className="text-sm ml-0.5">%</span>
                                        </span>
                                    </div>
                                    <div className="h-10 w-px bg-white/10 mx-2" />
                                    <div className="flex flex-col">
                                        <span className="text-[10px] font-black text-white/40 uppercase tracking-widest mb-1">Tickets Sold</span>
                                        <span className="text-3xl font-black font-mono text-white leading-none">
                                            {podium[0].today?.total_sold.toLocaleString()}
                                        </span>
                                    </div>
                                    <div className="h-10 w-px bg-white/10 mx-2" />
                                    <div className="flex flex-col">
                                        <span className="text-[10px] font-black text-white/40 uppercase tracking-widest mb-1">Inventory</span>
                                        <span className="text-3xl font-black font-mono text-white/60 leading-none">
                                            {formatCompactNumber(podium[0].today?.total_seats)}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* CONTENDERS (#2 & #3) */}
                        <div className="lg:col-span-5 flex flex-col gap-6">
                            {podium.slice(1).map((movie, idx) => (
                                <div 
                                    key={movie.id}
                                    className="flex-1 group relative overflow-hidden rounded-2xl bg-muted border border-border/50 cursor-pointer transition-all hover:border-primary/30"
                                    onClick={() => router.push(`/performances/${movie.id}`)}
                                >
                                    <div className="flex h-full">
                                        <div className="relative w-1/3 aspect-[2/3] lg:aspect-auto">
                                            <Image src={movie.poster} alt={movie.title} fill className="object-cover transition-transform group-hover:scale-110" />
                                            <div className="absolute top-2 left-2 w-7 h-7 bg-zinc-900/80 backdrop-blur-md rounded-lg flex items-center justify-center text-white text-xs font-black border border-white/10">#{idx + 2}</div>
                                        </div>
                                        <div className="flex-1 p-5 flex flex-col justify-center">
                                            <h4 className="text-lg font-black tracking-tighter mb-3 line-clamp-1 group-hover:text-primary transition-colors">{movie.title}</h4>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <p className="text-[8px] font-black text-muted-foreground uppercase tracking-widest mb-0.5">True OCR</p>
                                                    <p className="text-lg font-black font-mono text-foreground leading-none">
                                                        {formatOccupancy(movie.today?.avg_occupancy_pct)}%
                                                    </p>
                                                </div>
                                                <div>
                                                    <p className="text-[8px] font-black text-muted-foreground uppercase tracking-widest mb-0.5">Audience</p>
                                                    <p className="text-lg font-black font-mono text-foreground leading-none">
                                                        {formatCompactNumber(movie.today?.total_sold)}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>
            )}

            {/* 3. NOW SHOWING (High Density Grid) */}
            {gridMovies.length > 0 && (
                <section>
                    <div className="flex items-center justify-between mb-6 pb-2 border-b border-border/40">
                        <div className="flex items-center gap-2">
                            <Clapperboard className="w-4 h-4 text-muted-foreground" />
                            <h2 className="text-sm font-black uppercase tracking-[0.2em] text-muted-foreground">Active Market</h2>
                        </div>
                        <span className="text-[10px] font-bold font-mono text-muted-foreground/60 uppercase">{gridMovies.length} Titles</span>
                    </div>
                    
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-6">
                        {gridMovies.map((movie) => (
                            <div
                                key={movie.id}
                                className="group cursor-pointer space-y-3"
                                onClick={() => router.push(`/performances/${movie.id}`)}
                            >
                                <div className="aspect-[2/3] relative overflow-hidden rounded-xl bg-muted border border-border/40 transition-all group-hover:shadow-lg group-hover:border-primary/20">
                                    <Image
                                        src={movie.poster}
                                        alt={movie.title}
                                        fill
                                        className="object-cover transition-transform duration-500 group-hover:scale-110"
                                        sizes="250px"
                                    />
                                    {/* Glassmorphism OCR Overlay */}
                                    <div className="absolute top-2 right-2 px-2 py-1 rounded-lg backdrop-blur-md bg-zinc-900/60 border border-white/10">
                                        <span className="text-[10px] font-black font-mono text-white italic">
                                            {formatOccupancy(movie.today?.avg_occupancy_pct)}%
                                        </span>
                                    </div>
                                    <div className="absolute inset-0 bg-primary/10 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                                </div>

                                <div className="px-1">
                                    <h3 className="text-xs font-bold leading-tight line-clamp-1 mb-1 group-hover:text-primary transition-colors">{movie.title}</h3>
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-1">
                                            <Users className="w-2.5 h-2.5 text-muted-foreground/60" />
                                            <span className="text-[10px] font-black font-mono text-muted-foreground tabular-nums">
                                                {formatCompactNumber(movie.today?.total_sold)}
                                            </span>
                                        </div>
                                        <span className="text-[8px] font-black text-muted-foreground/30 uppercase tracking-tighter">
                                            {movie.today?.total_showtimes || 0} Shows
                                        </span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>
            )}
        </div>
    );
}
