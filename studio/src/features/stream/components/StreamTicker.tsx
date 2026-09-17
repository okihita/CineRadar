'use client';

import { StreamCircuitBreakdown, StreamMovieItem } from '../types';
import { getChainColor } from '@/lib/constants';
import { Radio } from 'lucide-react';

interface StreamTickerProps {
    circuits: StreamCircuitBreakdown[];
    movies: StreamMovieItem[];
    lastSweptAt: string | null;
    showCircuits?: boolean;
}

export function StreamTicker({
    circuits,
    movies,
    lastSweptAt,
    showCircuits = true,
}: StreamTickerProps) {
    // Format last swept time
    const formattedSweep = lastSweptAt
        ? new Date(lastSweptAt).toLocaleTimeString('en-GB', {
            timeZone: 'Asia/Jakarta',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false,
        }) + ' WIB'
        : 'LIVE SYNC';

    return (
        <footer className="relative z-20 w-full border-t border-border bg-card/95 px-4 py-2 flex items-center justify-between gap-4 text-sm font-mono overflow-hidden">
            {/* Circuit Footprint Summary */}
            {showCircuits && circuits.length > 0 && (
                <div className="flex items-center gap-3 flex-shrink-0">
                    <span className="text-sm font-bold uppercase tracking-wider text-muted-foreground hidden sm:inline">
                        Circuits:
                    </span>
                    <div className="flex items-center gap-2">
                        {circuits.map((c) => (
                            <div
                                key={c.name}
                                className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-muted/60 border border-border/80"
                            >
                                <span
                                    className="w-2 h-2 rounded-full flex-shrink-0"
                                    style={{ backgroundColor: getChainColor(c.name) }}
                                />
                                <span className="font-bold text-foreground">{c.name}</span>
                                <span className="text-muted-foreground text-sm">{c.sharePct}%</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Marquee Ticker */}
            <div className="flex-1 overflow-hidden whitespace-nowrap text-muted-foreground mx-4 hidden md:block">
                <div className="inline-block animate-marquee">
                    {movies.slice(0, 10).map((m, idx) => (
                        <span key={m.id} className="inline-flex items-center gap-1.5 mx-4">
                            <span className="text-muted-foreground font-bold">#{idx + 1}</span>
                            <span className="text-foreground font-semibold uppercase">{m.title}</span>
                            <span className="text-primary font-bold">({m.showtimes} shows · {m.showtimeSharePct}%)</span>
                            <span className="text-border">|</span>
                        </span>
                    ))}
                </div>
            </div>

            {/* Right: Sweeper Telemetry Status */}
            <div className="flex items-center gap-2 flex-shrink-0 text-sm text-muted-foreground">
                <Radio className="w-3.5 h-3.5 text-emerald-500 animate-pulse" />
                <span className="text-muted-foreground hidden lg:inline">Last JIT Sweep:</span>
                <span className="font-bold text-foreground">{formattedSweep}</span>
            </div>
        </footer>
    );
}
