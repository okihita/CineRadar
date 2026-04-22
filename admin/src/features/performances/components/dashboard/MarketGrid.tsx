'use client';

import React from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Clapperboard, Users, Zap } from 'lucide-react';
import { formatCompactNumber, formatOccupancy } from '../../utils/format';
import { getOccupancyColor } from '../../utils/colors';
import { MovieWithStats } from '../../types/performance';
import { cn } from '@/lib/utils';

interface MarketGridProps {
    movies: MovieWithStats[];
}

export function MarketGrid({ movies }: MarketGridProps) {
    const router = useRouter();

    if (movies.length === 0) return null;

    return (
        <section>
            <div className="flex items-center justify-between mb-6 pb-2 border-b border-border/40">
                <div className="flex items-center gap-2">
                    <Clapperboard className="w-4 h-4 text-muted-foreground" />
                    <h2 className="text-sm font-black uppercase tracking-[0.2em] text-muted-foreground">Active Market</h2>
                </div>
                <span className="text-[10px] font-bold font-mono text-muted-foreground/60 uppercase">{movies.length} Titles</span>
            </div>
            
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-6">
                {movies.map((movie) => (
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
                                <span className={cn("text-[10px] font-black font-mono italic", getOccupancyColor(movie.today?.avg_occupancy_pct || 0).replace('text-', 'text-'))}>
                                    {formatOccupancy(movie.today?.avg_occupancy_pct)}%
                                </span>
                            </div>
                            <div className="absolute inset-0 bg-primary/10 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                        </div>

                        <div className="px-1">
                            <h3 className="text-xs font-bold leading-tight line-clamp-1 mb-1 group-hover:text-primary transition-colors">{movie.title}</h3>
                            <div className="flex items-center gap-3">
                                <div className="flex items-center gap-1">
                                    <Users className="w-2.5 h-2.5 text-muted-foreground/60" />
                                    <span className="text-[10px] font-black font-mono text-muted-foreground tabular-nums">
                                        {formatCompactNumber(movie.today?.total_sold || 0)}
                                    </span>
                                </div>
                                <div className="flex items-center gap-1">
                                    <Zap className="w-2.5 h-2.5 text-amber-500/50" />
                                    <span className="text-[10px] font-black font-mono text-muted-foreground tabular-nums">
                                        {movie.today?.total_showtimes || 0}
                                    </span>
                                </div>
                            </div>

                        </div>
                    </div>
                ))}
            </div>
        </section>
    );
}
