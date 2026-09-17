'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
    Maximize2, Minimize2, ArrowLeft, RefreshCw,
    Calendar, Sun, Moon, Laptop, Settings
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { StreamSummaryMetrics } from '../types';
import { getPerformanceTier } from '@/lib/constants';
import { useDarkModeContext } from '@/hooks';

interface StreamHudHeaderProps {
    summary: StreamSummaryMetrics;
    isFullscreen: boolean;
    onToggleFullscreen: () => void;
    onDateChange: (date: string) => void;
    selectedDate: string;
    onRefresh: () => void;
    isRefreshing: boolean;
    showControls: boolean;
    lastUpdatedAt?: number;
    onOpenSettings?: () => void;
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
    isFullscreen,
    onToggleFullscreen,
    onDateChange,
    selectedDate,
    onRefresh,
    isRefreshing,
    showControls,
    lastUpdatedAt,
    onOpenSettings,
}: StreamHudHeaderProps) {
    const [clock, setClock] = useState<string | null>(null);
    const { darkMode, setDarkMode, followsSystem, resetToSystem } = useDarkModeContext();

    // Hydration-safe 24h WIB live clock
    useEffect(() => {
        const update = () => setClock(`${getWibLiveTime()} WIB`);
        update();
        const timer = setInterval(update, 1000);
        return () => clearInterval(timer);
    }, []);

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

    const tier = getPerformanceTier(summary.nationalAvgOccupancyPct);

    return (
        <header className="relative z-30 w-full border-b border-border bg-card/90 backdrop-blur-xl px-4 sm:px-6 py-3 transition-all">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                
                {/* LEFT: Branding, Live Signal & Next Refresh Timer */}
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
                                <span className="font-mono text-sm font-bold text-foreground">
                                    {clock || '--:--:-- WIB'}
                                </span>
                            </div>
                            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                <h1 className="text-base sm:text-lg font-black uppercase tracking-tight text-foreground flex items-center gap-1.5">
                                    <span>CineRadar Broadcast</span>
                                    <span className="text-muted-foreground text-sm font-normal font-mono">/ {summary.date}</span>
                                </h1>
                                <span className="hidden sm:inline text-muted-foreground/40 font-mono text-sm">|</span>
                                <div className="flex items-center gap-1 text-sm font-mono text-muted-foreground">
                                    <span>Next refresh at</span>
                                    <span className="font-bold text-foreground">
                                        {isRefreshing ? 'Updating...' : `${nextRefreshDisplay.time} (${nextRefreshDisplay.seconds}s)`}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* CENTER: Hero Telemetry Quick Counters */}
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 sm:gap-4 flex-1 max-w-2xl lg:mx-6">
                    {/* Shows */}
                    <div className="bg-muted/40 border border-border rounded-xl px-3 py-1.5 flex flex-col">
                        <span className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
                            National Shows
                        </span>
                        <span className="font-mono font-black text-base sm:text-xl text-foreground tracking-tight">
                            {summary.totalShowtimes.toLocaleString()}
                        </span>
                    </div>

                    {/* Audience */}
                    <div className="bg-muted/40 border border-border rounded-xl px-3 py-1.5 flex flex-col">
                        <span className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
                            Audience Sold
                        </span>
                        <span className="font-mono font-black text-base sm:text-xl text-foreground tracking-tight">
                            {summary.totalEstimatedAdmissions > 0
                                ? summary.totalEstimatedAdmissions.toLocaleString()
                                : 'Sweeping...'}
                        </span>
                    </div>

                    {/* National Occupancy */}
                    <div className="bg-muted/40 border border-border rounded-xl px-3 py-1.5 flex flex-col">
                        <span className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
                            Avg Occupancy
                        </span>
                        <div className="flex items-baseline gap-1">
                            <span className={`font-mono font-black text-base sm:text-xl tracking-tight ${tier.twText}`}>
                                {summary.nationalAvgOccupancyPct > 0 ? `${summary.nationalAvgOccupancyPct}%` : '0.0%'}
                            </span>
                        </div>
                    </div>

                    {/* Active Movies */}
                    <div className="hidden sm:flex bg-muted/40 border border-border rounded-xl px-3 py-1.5 flex-col">
                        <span className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
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
                    {/* Theme Switcher: Light / Dark / System */}
                    <div className="flex items-center bg-muted/60 border border-border rounded-lg p-0.5" title="Theme (Light / Dark / System)">
                        <button
                            type="button"
                            onClick={() => setDarkMode(false)}
                            className={`p-1.5 rounded-md transition-colors ${
                                !followsSystem && !darkMode
                                    ? 'bg-primary text-primary-foreground shadow-sm'
                                    : 'text-muted-foreground hover:text-foreground'
                            }`}
                            title="Light theme"
                        >
                            <Sun className="w-3.5 h-3.5" />
                        </button>
                        <button
                            type="button"
                            onClick={() => setDarkMode(true)}
                            className={`p-1.5 rounded-md transition-colors ${
                                !followsSystem && darkMode
                                    ? 'bg-primary text-primary-foreground shadow-sm'
                                    : 'text-muted-foreground hover:text-foreground'
                            }`}
                            title="Dark theme"
                        >
                            <Moon className="w-3.5 h-3.5" />
                        </button>
                        <button
                            type="button"
                            onClick={resetToSystem}
                            className={`p-1.5 rounded-md transition-colors ${
                                followsSystem
                                    ? 'bg-primary text-primary-foreground shadow-sm'
                                    : 'text-muted-foreground hover:text-foreground'
                            }`}
                            title="System theme"
                        >
                            <Laptop className="w-3.5 h-3.5" />
                        </button>
                    </div>

                    {/* Date Picker Input */}
                    <div className="relative flex items-center">
                        <Calendar className="absolute left-2.5 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                        <input
                            type="date"
                            value={selectedDate}
                            onChange={(e) => e.target.value && onDateChange(e.target.value)}
                            className="h-8 pl-8 pr-2 rounded-lg border border-border bg-card text-sm font-mono font-bold text-foreground cursor-pointer hover:bg-muted transition-colors"
                            title="Change broadcast date"
                        />
                    </div>

                    {/* Refresh Button */}
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={onRefresh}
                        disabled={isRefreshing}
                        className="h-8 w-8 p-0 rounded-lg border-border bg-card text-foreground hover:bg-muted"
                        title="Force refresh data"
                    >
                        <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
                    </Button>

                    {/* Broadcast Settings Button */}
                    {onOpenSettings && (
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={onOpenSettings}
                            className="h-8 w-8 p-0 rounded-lg border-border bg-card text-foreground hover:bg-muted"
                            title="Broadcast Settings (,)"
                        >
                            <Settings className="w-3.5 h-3.5" />
                        </Button>
                    )}

                    {/* Fullscreen Toggle Button */}
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={onToggleFullscreen}
                        className="h-8 w-8 p-0 rounded-lg border-border bg-card text-foreground hover:bg-muted"
                        title={isFullscreen ? 'Exit Fullscreen (F)' : 'Enter Fullscreen (F)'}
                    >
                        {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                    </Button>

                    {/* Exit Back to /compare */}
                    <Button
                        variant="outline"
                        size="sm"
                        asChild
                        className="h-8 px-2.5 gap-1.5 rounded-lg border-border bg-card text-muted-foreground hover:bg-red-500/20 hover:text-red-500 hover:border-red-500/40"
                        title="Return to Head-to-Head Compare (Esc)"
                    >
                        <Link href="/compare">
                            <ArrowLeft className="w-3.5 h-3.5" />
                            <span className="text-sm font-mono font-bold uppercase hidden sm:inline">Exit</span>
                        </Link>
                    </Button>
                </div>

            </div>
        </header>
    );
}
