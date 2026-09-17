'use client';

import Image from 'next/image';
import { Film, Ticket, Users } from 'lucide-react';
import { StreamMovieItem } from '../types';
import { getPerformanceTier, getChainTailwind } from '@/lib/constants';

interface StreamMovieRowProps {
    movie: StreamMovieItem;
    maxShowtimes: number;
    maxAdmissions: number;
}

export function StreamMovieRow({
    movie,
    maxShowtimes,
    maxAdmissions,
}: StreamMovieRowProps) {
    const tier = getPerformanceTier(movie.avgOccupancyPct);

    // Calculate proportional bar percentages (minimum 4% for visibility)
    const showtimesPct = maxShowtimes > 0
        ? Math.max(4, Math.min(100, (movie.showtimes / maxShowtimes) * 100))
        : 4;

    const admissionsPct = maxAdmissions > 0 && movie.estimatedAdmissions > 0
        ? Math.max(4, Math.min(100, (movie.estimatedAdmissions / maxAdmissions) * 100))
        : movie.avgOccupancyPct > 0
            ? Math.max(4, Math.min(100, movie.avgOccupancyPct))
            : 0;

    return (
        <div className="flex items-center gap-3.5 p-3 rounded-2xl border border-border/80 bg-card/75 backdrop-blur-md hover:border-border hover:bg-card transition-all">
            {/* LEFT: Movie Poster with Rank Badge */}
            <div className="relative flex-shrink-0 w-14 sm:w-16 aspect-[2/3] rounded-xl overflow-hidden bg-muted border border-border shadow-sm">
                {movie.poster ? (
                    <Image
                        src={movie.poster}
                        alt={movie.title}
                        fill
                        className="object-cover"
                        sizes="64px"
                    />
                ) : (
                    <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                        <Film className="w-6 h-6" />
                    </div>
                )}

                {/* Rank Badge */}
                <div className="absolute top-1 left-1 px-1.5 py-0.5 rounded-md font-mono font-black text-sm bg-background/90 text-foreground border border-border/80 shadow-sm">
                    #{movie.rank}
                </div>
            </div>

            {/* RIGHT: Three Stacked Information Lines */}
            <div className="flex-1 min-w-0 flex flex-col justify-between self-stretch py-0.5">
                {/* Line 1: Movie Title & Circuit Badges */}
                <div className="flex items-center justify-between gap-2 min-w-0">
                    <h4 className="font-bold text-sm sm:text-base text-foreground truncate uppercase tracking-tight">
                        {movie.title}
                    </h4>
                    <div className="flex items-center gap-1 flex-shrink-0">
                        {movie.merchants.slice(0, 2).map((circuit) => {
                            const tw = getChainTailwind(circuit);
                            return (
                                <span
                                    key={circuit}
                                    className={`
                                        px-1.5 py-0.5 rounded text-sm font-mono font-bold border
                                        ${tw ? tw.badgeLight : 'bg-muted text-muted-foreground'}
                                        ${tw ? tw.text : ''} border-border/50
                                    `}
                                >
                                    {circuit}
                                </span>
                            );
                        })}
                    </div>
                </div>

                {/* Line 2: Showtimes Bar */}
                <div className="flex flex-col gap-1 mt-1">
                    <div className="flex items-center justify-between text-sm font-mono">
                        <span className="flex items-center gap-1 text-muted-foreground">
                            <Ticket className="w-3.5 h-3.5 text-primary" />
                            <span className="font-bold text-foreground">
                                {movie.showtimes.toLocaleString()} shows
                            </span>
                        </span>
                        <span className="font-bold text-primary">
                            {movie.showtimeSharePct}% share
                        </span>
                    </div>
                    <div className="h-2 w-full bg-muted/70 rounded-full overflow-hidden border border-border/40">
                        <div
                            className="h-full bg-primary rounded-full transition-all duration-500"
                            style={{ width: `${showtimesPct}%` }}
                        />
                    </div>
                </div>

                {/* Line 3: Admissions & Occupancy Bar */}
                <div className="flex flex-col gap-1 mt-1">
                    <div className="flex items-center justify-between text-sm font-mono">
                        <span className="flex items-center gap-1 text-muted-foreground">
                            <Users className="w-3.5 h-3.5 text-emerald-500" />
                            <span className="font-bold text-foreground">
                                {movie.estimatedAdmissions > 0
                                    ? `${movie.estimatedAdmissions.toLocaleString()} sold`
                                    : 'Pending JIT'}
                            </span>
                        </span>
                        <span className={`font-bold ${tier.twText}`}>
                            {movie.avgOccupancyPct > 0 ? `${movie.avgOccupancyPct}% occ` : tier.label}
                        </span>
                    </div>
                    <div className="h-2 w-full bg-muted/70 rounded-full overflow-hidden border border-border/40">
                        <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{
                                width: `${admissionsPct}%`,
                                backgroundColor: tier.color || '#10b981',
                            }}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}
