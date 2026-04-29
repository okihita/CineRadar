'use client';

import React from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Trophy, Target, Users, TrendingUp, Zap } from 'lucide-react';
import { formatCompactNumber, formatOccupancy } from '../../utils/format';
import { getOccupancyColor } from '../../utils/colors';
import { MovieWithStats } from '../../types/performance';
import { cn } from '@/lib/utils';

interface PerformanceBentoGridProps {
    movies: MovieWithStats[];
}

export function PerformanceBentoGrid({ movies }: PerformanceBentoGridProps) {
    const router = useRouter();
    const podium = movies.slice(0, 3);

    if (podium.length === 0) return null;

    return (
        <section className="space-y-6">
            <div className="flex items-center gap-2 mb-2">
                <Trophy className="w-5 h-5 text-amber-500" />
                <h2 className="text-sm font-black uppercase tracking-[0.2em] text-muted-foreground">Market Leaders</h2>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* 1. THE CHAMPION (Rank #1) - Exactly 50% width (6 of 12 columns) */}
                {podium[0] && (
                    <div 
                        className="lg:col-span-6 group relative overflow-hidden rounded-[2rem] bg-zinc-950 aspect-[16/9] lg:aspect-auto lg:h-[400px] cursor-pointer shadow-2xl border border-white/5"
                        onClick={() => router.push(`/performances/${podium[0].id}`)}
                    >
                        {/* 
                            NO-CROP POSTER FIX: 
                            Use the poster as a blurred background to fill the horizontal space,
                            then place the sharp, un-cropped vertical poster on top.
                        */}
                        <div className="absolute inset-0">
                            <Image 
                                src={podium[0].poster} 
                                alt="" 
                                fill 
                                className="object-cover opacity-30 blur-2xl scale-110"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/40 to-transparent" />
                        </div>
                        
                        <div className="relative h-full flex p-8 gap-8 z-10">
                            {/* Left: Floating Sharp Poster */}
                            <div className="relative h-full aspect-[2/3] flex-shrink-0 drop-shadow-[0_20px_50px_rgba(0,0,0,0.8)] transition-transform duration-700 group-hover:scale-[1.03]">
                                <Image 
                                    src={podium[0].poster} 
                                    alt={podium[0].title} 
                                    fill 
                                    className="object-contain rounded-xl border border-white/10"
                                    priority
                                />
                            </div>

                            {/* Right: Insight Panel */}
                            <div className="flex-1 flex flex-col justify-between py-2">
                                <div>
                                    <div className="flex items-center gap-3 mb-4">
                                        <div className="px-3 py-1 bg-amber-500 text-zinc-950 text-[10px] font-black uppercase tracking-tighter rounded-full">
                                            #1 National
                                        </div>
                                    </div>
                                    <h3 className="text-3xl font-black text-white tracking-tighter line-clamp-3 leading-[0.85]">
                                        {podium[0].title}
                                    </h3>
                                </div>

                                <div className="space-y-4 border-t border-white/10 pt-6">
                                    <div className="flex justify-between items-end">
                                        <div className="space-y-1">
                                            <p className="text-[9px] font-black text-white/30 uppercase tracking-widest flex items-center gap-1.5">
                                                <Target className="w-3 h-3" /> True OCR
                                            </p>
                                            <p className={cn("text-3xl font-black font-mono leading-none", getOccupancyColor(podium[0].today?.avg_occupancy_pct || 0))}>
                                                {formatOccupancy(podium[0].today?.avg_occupancy_pct)}<span className="text-sm ml-0.5 opacity-40">%</span>
                                            </p>
                                        </div>
                                        <div className="flex gap-8 text-right">
                                            <div className="space-y-1">
                                                <p className="text-[9px] font-black text-white/30 uppercase tracking-widest flex items-center gap-1.5 justify-end">
                                                    <Zap className="w-3 h-3" /> Shows
                                                </p>
                                                <p className="text-2xl font-black font-mono text-white leading-none">
                                                    {podium[0].today?.total_showtimes.toLocaleString()}
                                                </p>
                                            </div>
                                            <div className="space-y-1">
                                                <p className="text-[9px] font-black text-white/30 uppercase tracking-widest flex items-center gap-1.5 justify-end">
                                                    <Users className="w-3 h-3" /> Audience
                                                </p>
                                                <p className="text-2xl font-black font-mono text-white leading-none">
                                                    {formatCompactNumber(podium[0].today?.total_sold || 0)}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* 2. THE CONTENDERS (Rank #2 & #3) - Remaining 50% width (6 of 12 columns) */}
                <div className="lg:col-span-6 flex flex-col gap-4">
                    {podium.slice(1, 3).map((movie, idx) => (
                        <div 
                            key={movie.id}
                            className="flex-1 relative overflow-hidden rounded-[1.5rem] bg-muted/40 border border-border/50 group cursor-pointer hover:border-primary/30 transition-all shadow-sm"
                            onClick={() => router.push(`/performances/${movie.id}`)}
                        >
                            <div className="absolute inset-0 flex p-4 gap-6">
                                <div className="relative h-full aspect-[2/3] flex-shrink-0">
                                    <Image src={movie.poster} alt={movie.title} fill className="object-contain rounded-lg drop-shadow-md border border-border/10" />
                                </div>
                                <div className="flex-1 flex flex-col justify-center min-w-0">
                                    <div className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1 flex items-center gap-1.5">
                                        <TrendingUp className="w-3 h-3" /> Rank #{idx + 2}
                                    </div>
                                    <h4 className="text-xl font-black tracking-tight line-clamp-1 mb-4 group-hover:text-primary transition-colors">
                                        {movie.title}
                                    </h4>
                                    <div className="flex items-center gap-6">
                                        <div>
                                            <p className="text-[8px] font-black text-muted-foreground/50 uppercase tracking-widest mb-0.5">OCR</p>
                                            <p className={cn("text-xl font-black font-mono leading-none", getOccupancyColor(movie.today?.avg_occupancy_pct || 0))}>
                                                {formatOccupancy(movie.today?.avg_occupancy_pct)}%
                                            </p>
                                        </div>
                                        <div className="h-6 w-px bg-border/40" />
                                        <div>
                                            <p className="text-[8px] font-black text-muted-foreground/50 uppercase tracking-widest mb-0.5">Shows</p>
                                            <p className="text-xl font-black font-mono text-foreground leading-none">
                                                {movie.today?.total_showtimes.toLocaleString()}
                                            </p>
                                        </div>
                                        <div className="h-6 w-px bg-border/40" />
                                        <div>
                                            <p className="text-[8px] font-black text-muted-foreground/50 uppercase tracking-widest mb-0.5">Audience</p>
                                            <p className="text-xl font-black font-mono text-foreground leading-none">
                                                {formatCompactNumber(movie.today?.total_sold || 0)}
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
    );
}
