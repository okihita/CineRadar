'use client';

import Image from 'next/image';
import { Film, Users, Ticket, Percent, Sparkles } from 'lucide-react';
import { StreamMovieItem } from '../types';
import { getPerformanceTier, getChainTailwind } from '@/lib/constants';

interface StreamMovieCardProps {
    movie: StreamMovieItem;
    highlighted?: boolean;
    compact?: boolean;
    hero?: boolean;
}

export function StreamMovieCard({
    movie,
    highlighted = false,
    compact = false,
    hero = false,
}: StreamMovieCardProps) {
    const tier = getPerformanceTier(movie.avgOccupancyPct);

    // Rank styling: Distinct styling for top podium positions
    const rankStyle = movie.rank === 1
        ? 'bg-amber-400 text-black border-amber-300 shadow-amber-500/20 shadow-lg'
        : movie.rank === 2
            ? 'bg-zinc-200 text-black border-zinc-100 shadow-zinc-400/20 shadow-md'
            : movie.rank === 3
                ? 'bg-amber-700 text-white border-amber-600 shadow-amber-900/20 shadow-md'
                : 'bg-muted text-muted-foreground border-border';

    return (
        <div
            className={`
                relative overflow-hidden rounded-2xl border transition-all duration-300 flex flex-col justify-between
                ${highlighted
                    ? 'border-primary/80 bg-card/95 shadow-2xl shadow-primary/10 ring-1 ring-primary/40 scale-[1.01]'
                    : 'border-border/80 bg-card/60 backdrop-blur-md hover:border-border'
                }
                ${hero ? 'p-5 lg:p-6 border-primary/40' : compact ? 'p-3.5' : 'p-4'}
            `}
        >
            {/* Top Accent Line for #1 */}
            {movie.rank === 1 && (
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 via-amber-300 to-amber-500" />
            )}

            <div className={`flex gap-4 items-start ${hero ? 'sm:gap-6' : ''}`}>
                {/* Poster & Rank Indicator */}
                <div
                    className={`
                        relative flex-shrink-0 aspect-[2/3] rounded-xl overflow-hidden bg-muted border border-border shadow-inner
                        ${hero ? 'w-24 sm:w-32' : 'w-20 sm:w-24'}
                    `}
                >
                    {movie.poster ? (
                        <Image
                            src={movie.poster}
                            alt={movie.title}
                            fill
                            className="object-cover"
                            sizes={hero ? '(max-width: 768px) 96px, 128px' : '(max-width: 768px) 80px, 96px'}
                        />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                            <Film className={hero ? 'w-10 h-10' : 'w-8 h-8'} />
                        </div>
                    )}

                    {/* Rank Badge */}
                    <div
                        className={`
                            absolute top-1.5 left-1.5 px-2 py-0.5 rounded-md font-mono font-black text-sm border tracking-tight
                            ${rankStyle}
                        `}
                    >
                        #{movie.rank}
                    </div>

                    {/* Thursday Premiere Tag */}
                    {movie.isPremiere && (
                        <div className="absolute bottom-1.5 left-1.5 right-1.5 bg-red-600/95 text-white font-mono text-sm font-black uppercase text-center py-0.5 rounded tracking-wider shadow-sm">
                            Premiere
                        </div>
                    )}
                </div>

                {/* Film Metadata & Headliner */}
                <div className="flex-1 min-w-0 flex flex-col justify-between self-stretch">
                    <div>
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                            {movie.ageCategory && (
                                <span className="px-2 py-0.5 rounded text-sm font-mono font-bold bg-muted text-muted-foreground border border-border/60">
                                    {movie.ageCategory}
                                </span>
                            )}
                            {movie.rank === 1 && (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-sm font-bold uppercase bg-amber-400/15 text-amber-600 dark:text-amber-300 border border-amber-400/30">
                                    <Sparkles className="w-3 h-3" />
                                    No. 1 Box Office
                                </span>
                            )}
                        </div>

                        <h3
                            className={`
                                font-black text-foreground leading-tight tracking-tight uppercase
                                ${hero ? 'text-lg sm:text-2xl line-clamp-2' : 'text-base sm:text-lg line-clamp-2'}
                            `}
                        >
                            {movie.title}
                        </h3>

                        {movie.genres && (
                            <p className="text-sm text-muted-foreground font-medium truncate mt-0.5">
                                {movie.genres}
                            </p>
                        )}
                    </div>

                    {/* Circuit Availability Badges */}
                    <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                        {(['XXI', 'CGV', 'Cinépolis', 'FLIX'] as const).map((circuit) => {
                            const isAvailable = movie.merchants.some(m => m.toUpperCase().includes(circuit.toUpperCase()));
                            const tw = getChainTailwind(circuit);

                            if (!isAvailable) return null;

                            return (
                                <span
                                    key={circuit}
                                    className={`
                                        px-2 py-0.5 rounded-md text-sm font-mono font-bold border tracking-wider
                                        ${tw ? tw.badgeLight : 'bg-muted text-muted-foreground'}
                                        ${tw ? tw.text : ''} border-border/60
                                    `}
                                >
                                    {circuit}
                                </span>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Quick Count Performance Matrix */}
            <div className={`mt-3 pt-3 border-t border-border/60 grid grid-cols-3 gap-2 ${hero ? 'sm:gap-3' : ''}`}>
                {/* Showtimes & Share */}
                <div className="flex flex-col bg-muted/40 rounded-xl p-2.5 border border-border/50">
                    <div className="flex items-center gap-1 text-muted-foreground text-sm font-medium uppercase">
                        <Ticket className="w-3 h-3 text-muted-foreground/70" />
                        <span>Shows</span>
                    </div>
                    <div className="flex items-baseline gap-1 mt-0.5">
                        <span className={`font-mono font-black text-foreground tracking-tight ${hero ? 'text-lg sm:text-2xl' : 'text-base sm:text-lg'}`}>
                            {movie.showtimes.toLocaleString()}
                        </span>
                    </div>
                    <span className="text-sm font-mono font-bold text-primary mt-0.5">
                        {movie.showtimeSharePct}% share
                    </span>
                </div>

                {/* Estimated Audience */}
                <div className="flex flex-col bg-muted/40 rounded-xl p-2.5 border border-border/50">
                    <div className="flex items-center gap-1 text-muted-foreground text-sm font-medium uppercase">
                        <Users className="w-3 h-3 text-muted-foreground/70" />
                        <span>Audience</span>
                    </div>
                    <div className="flex items-baseline gap-1 mt-0.5">
                        <span className={`font-mono font-black text-foreground tracking-tight ${hero ? 'text-lg sm:text-2xl' : 'text-base sm:text-lg'}`}>
                            {movie.estimatedAdmissions > 0 ? movie.estimatedAdmissions.toLocaleString() : 'Pending'}
                        </span>
                    </div>
                    <span className="text-sm font-mono text-muted-foreground mt-0.5">
                        {movie.citiesCount > 0 ? `${movie.citiesCount} cities` : 'National'}
                    </span>
                </div>

                {/* Occupancy Rate & Tier Badge */}
                <div className="flex flex-col bg-muted/40 rounded-xl p-2.5 border border-border/50">
                    <div className="flex items-center gap-1 text-muted-foreground text-sm font-medium uppercase">
                        <Percent className="w-3 h-3 text-muted-foreground/70" />
                        <span>Occupancy</span>
                    </div>
                    <div className="flex items-baseline gap-1 mt-0.5">
                        <span className={`font-mono font-black tracking-tight ${tier.twText} ${hero ? 'text-lg sm:text-2xl' : 'text-base sm:text-lg'}`}>
                            {movie.avgOccupancyPct > 0 ? `${movie.avgOccupancyPct}%` : '0.0%'}
                        </span>
                    </div>
                    <span className={`text-sm font-mono font-bold tracking-tight uppercase ${tier.twText} mt-0.5`}>
                        {tier.label}
                    </span>
                </div>
            </div>
        </div>
    );
}
