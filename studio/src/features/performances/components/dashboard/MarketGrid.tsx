'use client';

import React from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Clapperboard, Users, Zap, Coins } from 'lucide-react';
import { formatOccupancy, formatRupiahCompact, DEFAULT_TICKET_PRICE } from '../../utils/format';
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
                <span className="text-sm font-bold font-mono text-muted-foreground/60 uppercase">{movies.length} Titles</span>
            </div>
            
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-6">
                {movies.map((movie) => (
                    <div
                        key={movie.id}
                        className="group cursor-pointer space-y-3"
                        role="button"
                        tabIndex={0}
                        onClick={() => router.push(`/performances/${movie.id}`)}
                        onKeyDown={(e) => e.key === 'Enter' && router.push(`/performances/${movie.id}`)}
                    >
                        <div className="aspect-[2/3] relative overflow-hidden rounded-xl bg-muted border border-border/40 transition-all group-hover:shadow-lg group-hover:border-primary/20">
                            <Image
                                src={movie.poster}
                                alt={movie.title}
                                fill
                                className="object-cover transition-transform duration-500 group-hover:scale-110"
                                sizes="250px"
                            />
                            {/* High-Contrast OCR Overlay */}
                            <div className="absolute top-2 right-2 px-2 py-1 rounded-lg bg-zinc-950 border border-zinc-800">
                                <span className={cn("text-sm font-black font-mono italic", getOccupancyColor(movie.today?.avg_occupancy_pct ?? 0))}>
                                    {formatOccupancy(movie.today?.avg_occupancy_pct ?? 0)}%
                                </span>
                            </div>
                            <div className="absolute inset-0 bg-primary/10 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                        </div>

                        <div className="px-1">
                            <h3 className="text-sm font-bold leading-tight line-clamp-1 mb-1 group-hover:text-primary transition-colors">{movie.title}</h3>
                            <div className="flex items-center justify-between gap-1 text-sm font-black font-mono text-muted-foreground tabular-nums">
                                <div className="flex items-center gap-1">
                                    <Users className="w-2.5 h-2.5 text-muted-foreground/60" />
                                    <span>{(movie.today?.total_sold ?? 0).toLocaleString()}</span>
                                </div>
                                <div className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                                    <Coins className="w-2.5 h-2.5" />
                                    <span>{formatRupiahCompact(movie.today?.gross_revenue ?? ((movie.today?.total_sold ?? 0) * DEFAULT_TICKET_PRICE))}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </section>
    );
}
