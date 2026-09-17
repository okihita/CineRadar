'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
    Maximize2, Minimize2, ArrowLeft, RefreshCw,
    Smartphone, Monitor, Calendar
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { StreamSummaryMetrics, StreamLayoutMode } from '../types';
import { getPerformanceTier } from '@/lib/constants';

interface StreamHudHeaderProps {
    summary: StreamSummaryMetrics;
    layoutMode: StreamLayoutMode;
    onToggleLayout: () => void;
    isFullscreen: boolean;
    onToggleFullscreen: () => void;
    onDateChange: (date: string) => void;
    selectedDate: string;
    onRefresh: () => void;
    isRefreshing: boolean;
    showControls: boolean;
}

function getWibLiveTime(): string {
    return new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Asia/Jakarta',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
    }).format(new Date());
}

export function StreamHudHeader({
    summary,
    layoutMode,
    onToggleLayout,
    isFullscreen,
    onToggleFullscreen,
    onDateChange,
    selectedDate,
    onRefresh,
    isRefreshing,
    showControls,
}: StreamHudHeaderProps) {
    const [clock, setClock] = useState<string | null>(null);

    // Hydration-safe 24h WIB live clock
    useEffect(() => {
        const update = () => setClock(`${getWibLiveTime()} WIB`);
        update();
        const timer = setInterval(update, 1000);
        return () => clearInterval(timer);
    }, []);

    const tier = getPerformanceTier(summary.nationalAvgOccupancyPct);

    return (
        <header className="relative z-30 w-full border-b border-zinc-800 bg-zinc-950/90 backdrop-blur-xl px-4 sm:px-6 py-3 transition-all">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                
                {/* LEFT: Branding & Live Signal */}
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2.5">
                        <div className="relative flex h-3 w-3">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75" />
                            <span className="relative inline-flex rounded-full h-3 w-3 bg-red-600" />
                        </div>
                        <div className="flex flex-col">
                            <div className="flex items-center gap-2">
                                <span className="font-mono text-sm font-black uppercase tracking-widest text-red-500 bg-red-500/10 px-2 py-0.5 rounded border border-red-500/20">
                                    Live Quick Count
                                </span>
                                <span className="font-mono text-sm font-bold text-zinc-400">
                                    {clock || '--:--:-- WIB'}
                                </span>
                            </div>
                            <h1 className="text-lg sm:text-xl font-black uppercase tracking-tighter text-white mt-0.5 flex items-center gap-2">
                                <span>CineRadar Broadcast</span>
                                <span className="text-zinc-500 text-sm font-normal font-mono">/ {summary.date}</span>
                            </h1>
                        </div>
                    </div>
                </div>

                {/* CENTER: Hero Telemetry Quick Counters */}
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 sm:gap-4 flex-1 max-w-2xl lg:mx-6">
                    {/* Shows */}
                    <div className="bg-zinc-900/80 border border-zinc-800 rounded-xl px-3 py-1.5 flex flex-col">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                            National Shows
                        </span>
                        <span className="font-mono font-black text-base sm:text-xl text-white tracking-tight">
                            {summary.totalShowtimes.toLocaleString()}
                        </span>
                    </div>

                    {/* Audience */}
                    <div className="bg-zinc-900/80 border border-zinc-800 rounded-xl px-3 py-1.5 flex flex-col">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                            Audience Sold
                        </span>
                        <span className="font-mono font-black text-base sm:text-xl text-white tracking-tight">
                            {summary.totalEstimatedAdmissions > 0
                                ? summary.totalEstimatedAdmissions.toLocaleString()
                                : 'Sweeping...'}
                        </span>
                    </div>

                    {/* National Occupancy */}
                    <div className="bg-zinc-900/80 border border-zinc-800 rounded-xl px-3 py-1.5 flex flex-col">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                            Avg Occupancy
                        </span>
                        <div className="flex items-baseline gap-1">
                            <span className={`font-mono font-black text-base sm:text-xl tracking-tight ${tier.twText}`}>
                                {summary.nationalAvgOccupancyPct > 0 ? `${summary.nationalAvgOccupancyPct}%` : '0.0%'}
                            </span>
                        </div>
                    </div>

                    {/* Active Movies */}
                    <div className="hidden sm:flex bg-zinc-900/80 border border-zinc-800 rounded-xl px-3 py-1.5 flex-col">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                            Active Titles
                        </span>
                        <span className="font-mono font-black text-base sm:text-xl text-primary tracking-tight">
                            {summary.activeMoviesCount}
                        </span>
                    </div>
                </div>

                {/* RIGHT: Floating Controls (Auto-fades on idle) */}
                <div
                    className={`
                        flex items-center gap-2 transition-opacity duration-300
                        ${showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'}
                    `}
                >
                    {/* Date Picker Input */}
                    <div className="relative flex items-center">
                        <Calendar className="absolute left-2.5 w-3.5 h-3.5 text-zinc-400 pointer-events-none" />
                        <input
                            type="date"
                            value={selectedDate}
                            onChange={(e) => e.target.value && onDateChange(e.target.value)}
                            className="h-8 pl-8 pr-2 rounded-lg border border-zinc-700 bg-zinc-900 text-sm font-mono font-bold text-white cursor-pointer hover:bg-zinc-800 transition-colors"
                            title="Change broadcast date"
                        />
                    </div>

                    {/* Layout Switcher: 16:9 Landscape vs 9:16 Vertical */}
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={onToggleLayout}
                        className="h-8 px-2.5 gap-1.5 rounded-lg border-zinc-700 bg-zinc-900 text-zinc-200 hover:bg-zinc-800"
                        title={layoutMode === 'landscape' ? 'Switch to Vertical 9:16 (TikTok Studio)' : 'Switch to Landscape 16:9 (TV Wall)'}
                    >
                        {layoutMode === 'landscape' ? (
                            <>
                                <Smartphone className="w-3.5 h-3.5 text-primary" />
                                <span className="text-[11px] font-mono font-bold uppercase hidden sm:inline">9:16</span>
                            </>
                        ) : (
                            <>
                                <Monitor className="w-3.5 h-3.5 text-primary" />
                                <span className="text-[11px] font-mono font-bold uppercase hidden sm:inline">16:9</span>
                            </>
                        )}
                    </Button>

                    {/* Refresh Button */}
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={onRefresh}
                        disabled={isRefreshing}
                        className="h-8 w-8 p-0 rounded-lg border-zinc-700 bg-zinc-900 text-zinc-200 hover:bg-zinc-800"
                        title="Force refresh data"
                    >
                        <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
                    </Button>

                    {/* Fullscreen Toggle Button */}
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={onToggleFullscreen}
                        className="h-8 w-8 p-0 rounded-lg border-zinc-700 bg-zinc-900 text-zinc-200 hover:bg-zinc-800"
                        title={isFullscreen ? 'Exit Fullscreen (F)' : 'Enter Fullscreen (F)'}
                    >
                        {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                    </Button>

                    {/* Exit Back to /compare */}
                    <Button
                        variant="outline"
                        size="sm"
                        asChild
                        className="h-8 px-2.5 gap-1.5 rounded-lg border-zinc-700 bg-zinc-900 text-zinc-300 hover:bg-red-500/20 hover:text-red-300 hover:border-red-500/40"
                        title="Return to Head-to-Head Compare (Esc)"
                    >
                        <Link href="/compare">
                            <ArrowLeft className="w-3.5 h-3.5" />
                            <span className="text-[11px] font-mono font-bold uppercase hidden sm:inline">Exit</span>
                        </Link>
                    </Button>
                </div>

            </div>
        </header>
    );
}
