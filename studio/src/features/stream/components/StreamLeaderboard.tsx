'use client';

import { useState, useEffect, useMemo } from 'react';
import { StreamMovieItem, StreamLayoutMode } from '../types';
import { StreamMovieCard } from './StreamMovieCard';
import { StreamCharts } from './StreamCharts';
import { StreamMovieRow } from './StreamMovieRow';
import { Film } from 'lucide-react';

interface StreamLeaderboardProps {
    movies: StreamMovieItem[];
    layoutMode?: StreamLayoutMode;
    autoCycle?: boolean;
    lastUpdatedAt?: number;
    isRefreshing?: boolean;
}

export function StreamLeaderboard({
    movies,
    layoutMode = 'landscape',
    autoCycle = true,
    lastUpdatedAt,
    isRefreshing = false,
}: StreamLeaderboardProps) {
    const [highlightIndex, setHighlightIndex] = useState(0);

    // Live countdown to next 30s auto-refresh
    const [nextRefreshDisplay, setNextRefreshDisplay] = useState<{ time: string; seconds: number }>({
        time: '--:--:-- WIB',
        seconds: 30,
    });

    useEffect(() => {
        const updateCountdown = () => {
            const now = Date.now();
            const base = lastUpdatedAt || now;
            const target = base + 30000;
            const diffMs = Math.max(0, target - now);
            const remainingSec = Math.ceil(diffMs / 1000);

            const formattedTarget = new Intl.DateTimeFormat('en-GB', {
                timeZone: 'Asia/Jakarta',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: false,
            }).format(new Date(target));

            setNextRefreshDisplay({
                time: `${formattedTarget} WIB`,
                seconds: remainingSec,
            });
        };

        updateCountdown();
        const interval = setInterval(updateCountdown, 1000);
        return () => clearInterval(interval);
    }, [lastUpdatedAt]);

    const top5 = useMemo(() => movies.slice(0, 5), [movies]);
    const otherMovies = useMemo(() => (movies.length > 5 ? movies.slice(5) : []), [movies]);

    const maxOtherShowtimes = useMemo(() => {
        if (otherMovies.length === 0) return 1;
        return Math.max(...otherMovies.map((m) => m.showtimes), 1);
    }, [otherMovies]);

    const maxOtherAdmissions = useMemo(() => {
        if (otherMovies.length === 0) return 1;
        return Math.max(...otherMovies.map((m) => m.estimatedAdmissions), 1);
    }, [otherMovies]);

    // Auto-cycle through top 5 movies to create subtle visual dynamism during live stream
    useEffect(() => {
        if (!autoCycle || top5.length <= 1) return;
        const interval = setInterval(() => {
            setHighlightIndex((prev) => (prev + 1) % top5.length);
        }, 8000);
        return () => clearInterval(interval);
    }, [autoCycle, top5.length]);

    if (movies.length === 0) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center p-12 text-muted-foreground gap-3">
                <Film className="w-12 h-12 stroke-[1.5] text-muted-foreground/60 animate-pulse" />
                <p className="font-mono text-sm uppercase tracking-wider text-muted-foreground">
                    No active theatrical screenings detected for this date
                </p>
            </div>
        );
    }

    // ─── 1. MODE: Vertical (9:16 TikTok Live Studio Canvas) ────────
    if (layoutMode === 'vertical') {
        const top1 = top5[0];
        const runnersUp = top5.slice(1, 5);

        return (
            <div className="flex-1 flex flex-col gap-4 p-4 sm:p-6 max-w-md mx-auto w-full overflow-y-auto custom-scrollbar">
                {/* Upper Tier: #1 Headliner */}
                {top1 && (
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <span className="text-sm font-mono font-black uppercase tracking-widest text-muted-foreground">
                                No. 1 Headliner
                            </span>
                            <span className="text-sm font-mono text-muted-foreground uppercase">
                                Top Box Office
                            </span>
                        </div>
                        <StreamMovieCard
                            movie={top1}
                            highlighted={highlightIndex === 0}
                            compact
                        />
                    </div>
                )}

                {/* Middle: Streamer Camera Safe Zone */}
                <div className="py-7 rounded-2xl border border-dashed border-border/80 bg-card/40 flex flex-col items-center justify-center text-center p-4">
                    <span className="text-sm font-mono font-black uppercase tracking-widest text-muted-foreground">
                        Streamer Camera Box
                    </span>
                    <p className="text-sm text-muted-foreground font-mono mt-0.5">
                        OBS Studio / TikTok Live Overlay Safe Zone
                    </p>
                </div>

                {/* Lower Tier: Runners Up (#2 - #5) */}
                {runnersUp.length > 0 && (
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <span className="text-sm font-mono font-black uppercase tracking-widest text-muted-foreground">
                                Ranks #2 - #{top5.length}
                            </span>
                            <span className="text-sm font-mono text-muted-foreground uppercase">
                                Core Contenders
                            </span>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            {runnersUp.map((movie, idx) => (
                                <StreamMovieCard
                                    key={movie.id}
                                    movie={movie}
                                    highlighted={highlightIndex === idx + 1}
                                    compact
                                />
                            ))}
                        </div>
                    </div>
                )}

                {/* Vertical Distribution Charts */}
                {otherMovies.length > 0 && (
                    <div className="pt-2">
                        <StreamCharts movies={otherMovies} />
                    </div>
                )}

                {/* Vertical Remaining Titles */}
                {otherMovies.length > 0 && (
                    <div className="flex flex-col gap-2 pt-2">
                        <div className="flex items-center justify-between border-b border-border/60 pb-1">
                            <span className="font-mono text-sm font-black uppercase tracking-wider text-foreground">
                                All Remaining Titles ({otherMovies.length})
                            </span>
                        </div>
                        <div className="flex flex-col gap-2">
                            {otherMovies.map((movie) => (
                                <StreamMovieRow
                                    key={movie.id}
                                    movie={movie}
                                    maxShowtimes={maxOtherShowtimes}
                                    maxAdmissions={maxOtherAdmissions}
                                />
                            ))}
                        </div>
                    </div>
                )}
            </div>
        );
    }

    // ─── 2. MODE: Landscape (16:9 Broadcast Wall) ───────────────────
    return (
        <div className="flex-1 p-4 sm:p-6 overflow-y-auto custom-scrollbar flex flex-col gap-6">
            {/* SECTION 1: Top 5 Theatrical Headliners */}
            <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between border-b border-border/60 pb-2 gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-sm font-black uppercase tracking-wider text-foreground">
                            Top 5 Theatrical Headliners
                        </span>
                        <span className="font-mono text-sm text-muted-foreground hidden sm:inline">
                            Live Performance Matrix
                        </span>
                        <span className="hidden sm:inline text-muted-foreground/40 font-mono text-sm">|</span>
                        <div className="flex items-center gap-1.5 text-sm font-mono text-muted-foreground">
                            <span>Next refresh at</span>
                            <span className="font-bold text-foreground">
                                {isRefreshing ? 'Updating...' : `${nextRefreshDisplay.time} (${nextRefreshDisplay.seconds}s)`}
                            </span>
                        </div>
                    </div>
                    <span className="font-mono text-sm text-muted-foreground shrink-0">
                        {movies.length} Active National Releases
                    </span>
                </div>

                {/* Top 5 Layout: #1 Hero Card + #2-#5 Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
                    {/* #1 Hero Film (Dominant left anchor) */}
                    {top5[0] && (
                        <div className={top5.length > 1 ? 'lg:col-span-5 xl:col-span-5 flex' : 'lg:col-span-12 flex'}>
                            <div className="w-full flex">
                                <StreamMovieCard
                                    movie={top5[0]}
                                    highlighted={highlightIndex === 0}
                                    hero
                                />
                            </div>
                        </div>
                    )}

                    {/* #2 - #5 Contenders (2x2 Grid on right) */}
                    {top5.length > 1 && (
                        <div className="lg:col-span-7 xl:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {top5.slice(1).map((movie, idx) => (
                                <StreamMovieCard
                                    key={movie.id}
                                    movie={movie}
                                    highlighted={highlightIndex === idx + 1}
                                    compact={false}
                                />
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* SECTION 2: Theatrical Distribution Charts */}
            <div className="pt-2">
                <StreamCharts movies={otherMovies.length > 0 ? otherMovies : movies} />
            </div>

            {/* SECTION 3: All Remaining Theatrical Releases (#6+) */}
            {otherMovies.length > 0 && (
                <div className="flex flex-col gap-3 pt-2">
                    <div className="flex items-center justify-between border-b border-border/60 pb-2">
                        <div className="flex items-center gap-2">
                            <span className="font-mono text-sm font-black uppercase tracking-wider text-foreground">
                                All Remaining Titles
                            </span>
                            <span className="font-mono text-sm text-muted-foreground hidden sm:inline">
                                (Ranks #6 - #{movies.length})
                            </span>
                        </div>
                        <span className="font-mono text-sm text-muted-foreground">
                            {otherMovies.length} Active Releases
                        </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                        {otherMovies.map((movie) => (
                            <StreamMovieRow
                                key={movie.id}
                                movie={movie}
                                maxShowtimes={maxOtherShowtimes}
                                maxAdmissions={maxOtherAdmissions}
                            />
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
