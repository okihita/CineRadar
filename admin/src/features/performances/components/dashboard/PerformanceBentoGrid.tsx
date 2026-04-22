'use client';

import React from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Trophy, Target, Users, TrendingUp } from 'lucide-react';
import { formatCompactNumber, formatOccupancy } from '../../utils/format';
import { getOccupancyColor } from '../../utils/colors';
import { MovieWithStats } from '../../types/performance';
import { cn } from '@/lib/utils';

interface PerformanceBentoGridProps {
    movies: MovieWithStats[];
}

export function PerformanceBentoGrid({ movies }: PerformanceBentoGridProps) {
    const router = useRouter();
    const podium = movies.slice(0, 6);

    if (podium.length === 0) return null;

    return (
        <section className="space-y-6">
            <div className="flex items-center gap-2 mb-2">
                <Trophy className="w-5 h-5 text-amber-500" />
                <h2 className="text-sm font-black uppercase tracking-[0.2em] text-muted-foreground">National Leaderboard</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-6 auto-rows-[180px] gap-4">
                {/* 1. THE CHAMPION (Rank #1) - Large 2x2 Bento Box */}
                {podium[0] && (
                    <div 
                        className="md:col-span-4 md:row-span-2 relative overflow-hidden rounded-[2.5rem] bg-zinc-950 border border-white/5 shadow-2xl group cursor-pointer"
                        onClick={() => router.push(`/performances/${podium[0].id}`)}
                    >
                        {/* Background Decoration */}
                        <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-transparent to-transparent opacity-30" />
                        
                        <div className="absolute inset-0 flex p-8 gap-8">
                            {/* Left: Floating Poster (No Cropping) */}
                            <div className="relative h-full aspect-[2/3] flex-shrink-0 drop-shadow-[0_20px_50px_rgba(0,0,0,0.8)] z-10 transition-transform duration-700 group-hover:scale-[1.02]">
                                <Image 
                                    src={podium[0].poster} 
                                    alt={podium[0].title} 
                                    fill 
                                    className="object-contain rounded-xl"
                                    priority
                                />
                            </div>

                            {/* Right: Insight Panel */}
                            <div className="flex-1 flex flex-col justify-between py-2 z-10">
                                <div>
                                    <div className="flex items-center gap-3 mb-4">
                                        <div className="px-3 py-1 bg-amber-500 text-zinc-950 text-[10px] font-black uppercase tracking-tighter rounded-full">
                                            National Rank #1
                                        </div>
                                        <div className="text-[10px] font-bold text-white/40 uppercase tracking-widest">
                                            Champion
                                        </div>
                                    </div>
                                    <h3 className="text-4xl font-black text-white tracking-tighter line-clamp-2 leading-[0.9]">
                                        {podium[0].title}
                                    </h3>
                                </div>

                                <div className="grid grid-cols-2 gap-6 border-t border-white/10 pt-6">
                                    <div className="space-y-1">
                                        <div className="flex items-center gap-1.5 text-[9px] font-black text-white/30 uppercase tracking-widest">
                                            <Target className="w-3 h-3" /> True OCR
                                        </div>
                                        <div className={cn("text-3xl font-black font-mono", getOccupancyColor(podium[0].today?.avg_occupancy_pct || 0).replace('text-', 'text-'))}>
                                            {formatOccupancy(podium[0].today?.avg_occupancy_pct)}<span className="text-sm ml-0.5 opacity-40">%</span>
                                        </div>
                                    </div>
                                    <div className="space-y-1">
                                        <div className="flex items-center gap-1.5 text-[9px] font-black text-white/30 uppercase tracking-widest">
                                            <Users className="w-3 h-3" /> Tickets Sold
                                        </div>
                                        <div className="text-3xl font-black font-mono text-white">
                                            {podium[0].today?.total_sold.toLocaleString()}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* 2. THE CONTENDERS (Rank #2 & #3) - Horizontal 2x1 Strips */}
                {podium.slice(1, 3).map((movie, idx) => (
                    <div 
                        key={movie.id}
                        className="md:col-span-2 row-span-1 relative overflow-hidden rounded-[1.5rem] bg-muted/40 border border-border/50 group cursor-pointer hover:border-primary/30 transition-all shadow-sm"
                        onClick={() => router.push(`/performances/${movie.id}`)}
                    >
                        <div className="absolute inset-0 flex p-4 gap-4">
                            <div className="relative h-full aspect-[2/3] flex-shrink-0">
                                <Image src={movie.poster} alt={movie.title} fill className="object-contain rounded-lg drop-shadow-md" />
                            </div>
                            <div className="flex-1 flex flex-col justify-center min-w-0">
                                <div className="text-[8px] font-black text-muted-foreground uppercase tracking-widest mb-1 flex items-center gap-1.5">
                                    <TrendingUp className="w-2.5 h-2.5" /> Rank #{idx + 2}
                                </div>
                                <h4 className="text-sm font-black tracking-tight line-clamp-1 mb-2 group-hover:text-primary transition-colors">
                                    {movie.title}
                                </h4>
                                <div className="flex items-center gap-4">
                                    <div>
                                        <p className="text-[7px] font-black text-muted-foreground/50 uppercase tracking-widest">OCR</p>
                                        <p className={cn("text-sm font-black font-mono leading-none", getOccupancyColor(movie.today?.avg_occupancy_pct || 0))}>
                                            {formatOccupancy(movie.today?.avg_occupancy_pct)}%
                                        </p>
                                    </div>
                                    <div className="h-4 w-px bg-border/40" />
                                    <div>
                                        <p className="text-[7px] font-black text-muted-foreground/50 uppercase tracking-widest">Sold</p>
                                        <p className="text-sm font-black font-mono text-foreground leading-none">
                                            {formatCompactNumber(movie.today?.total_sold || 0)}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                ))}

                {/* 3. THE MOVERS (Rank #4, #5, #6) - Compact 1x1 Squares or Grid items */}
                {podium.slice(3, 6).map((movie, idx) => (
                    <div 
                        key={movie.id}
                        className={cn(
                            "row-span-1 relative overflow-hidden rounded-[1.5rem] bg-muted/20 border border-border/30 group cursor-pointer hover:border-primary/20 transition-all",
                            idx === 2 ? "md:col-span-2 lg:col-span-1" : "md:col-span-1"
                        )}
                        onClick={() => router.push(`/performances/${movie.id}`)}
                    >
                        <div className="absolute inset-0 flex flex-col p-3">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-[8px] font-black text-muted-foreground/40">#{idx + 4}</span>
                                <span className={cn("text-[9px] font-black font-mono", getOccupancyColor(movie.today?.avg_occupancy_pct || 0))}>
                                    {formatOccupancy(movie.today?.avg_occupancy_pct)}%
                                </span>
                            </div>
                            <div className="relative flex-1 mb-2">
                                <Image src={movie.poster} alt={movie.title} fill className="object-contain rounded-md" />
                            </div>
                            <h4 className="text-[10px] font-bold tracking-tight line-clamp-1 text-center group-hover:text-primary transition-colors">
                                {movie.title}
                            </h4>
                        </div>
                    </div>
                ))}
            </div>
        </section>
    );
}
