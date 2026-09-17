'use client';

import { useState, useEffect } from 'react';
import { StreamMovieItem, StreamLayoutMode } from '../types';
import { StreamMovieCard } from './StreamMovieCard';
import { Film } from 'lucide-react';

interface StreamLeaderboardProps {
    movies: StreamMovieItem[];
    layoutMode: StreamLayoutMode;
    autoCycle?: boolean;
}

export function StreamLeaderboard({
    movies,
    layoutMode,
    autoCycle = true,
}: StreamLeaderboardProps) {
    const [highlightIndex, setHighlightIndex] = useState(0);

    // Auto-cycle through top movies to create gentle visual dynamism during live stream
    useEffect(() => {
        if (!autoCycle || movies.length <= 1) return;
        const interval = setInterval(() => {
            setHighlightIndex((prev) => (prev + 1) % Math.min(movies.length, 6));
        }, 9000);
        return () => clearInterval(interval);
    }, [autoCycle, movies.length]);

    if (movies.length === 0) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center p-12 text-zinc-500 gap-3">
                <Film className="w-12 h-12 stroke-[1.5] text-zinc-600 animate-pulse" />
                <p className="font-mono text-sm uppercase tracking-wider text-zinc-400">
                    No active theatrical screenings detected for this date
                </p>
            </div>
        );
    }

    // ─── 1. MODE: Vertical (9:16 TikTok Live Studio Canvas) ────────
    if (layoutMode === 'vertical') {
        const topTier = movies.slice(0, 2);
        const secondTier = movies.slice(2, 6);

        return (
            <div className="flex-1 flex flex-col justify-between p-4 sm:p-6 max-w-md mx-auto w-full overflow-hidden">
                {/* Upper Tier: Headliners */}
                <div className="space-y-3">
                    <div className="flex items-center justify-between">
                        <span className="text-sm font-mono font-black uppercase tracking-widest text-zinc-400">
                            Theatrical Leaders
                        </span>
                        <span className="text-sm font-mono text-zinc-500 uppercase">
                            Top 2
                        </span>
                    </div>
                    {topTier.map((movie, idx) => (
                        <StreamMovieCard
                            key={movie.id}
                            movie={movie}
                            highlighted={idx === highlightIndex}
                            compact
                        />
                    ))}
                </div>

                {/* Middle: Streamer Camera Safe Zone */}
                <div className="my-4 py-8 rounded-2xl border border-dashed border-zinc-800/80 bg-zinc-950/40 flex flex-col items-center justify-center text-center p-4">
                    <span className="text-sm font-mono font-black uppercase tracking-widest text-zinc-500">
                        Streamer Camera Box
                    </span>
                    <p className="text-sm text-zinc-400 font-mono mt-0.5">
                        OBS Studio / TikTok Live Overlay Safe Zone
                    </p>
                </div>

                {/* Lower Tier: Runners Up */}
                <div className="space-y-3">
                    <div className="flex items-center justify-between">
                        <span className="text-sm font-mono font-black uppercase tracking-widest text-zinc-400">
                            Holdovers & Challengers
                        </span>
                        <span className="text-sm font-mono text-zinc-500 uppercase">
                            Ranks #3 - #{Math.min(movies.length, 6)}
                        </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                        {secondTier.map((movie, idx) => (
                            <StreamMovieCard
                                key={movie.id}
                                movie={movie}
                                highlighted={idx + 2 === highlightIndex}
                                compact
                            />
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    // ─── 2. MODE: Landscape (16:9 Broadcast Wall) ───────────────────
    return (
        <div className="flex-1 p-4 sm:p-6 overflow-y-auto custom-scrollbar">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
                {movies.map((movie, idx) => (
                    <StreamMovieCard
                        key={movie.id}
                        movie={movie}
                        highlighted={idx === highlightIndex}
                    />
                ))}
            </div>
        </div>
    );
}
