'use client';

import { useState, useEffect, useSyncExternalStore } from 'react';
import Link from 'next/link';
import Image from 'next/image';
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

const emptySubscribe = () => () => {};

export function StreamHudHeader({
    summary,
    isFullscreen,
    onToggleFullscreen,
    onDateChange,
    selectedDate,
    onRefresh,
    isRefreshing,
    showControls,
    onOpenSettings,
}: StreamHudHeaderProps) {
    const isMounted = useSyncExternalStore(emptySubscribe, () => true, () => false);
    const [clock, setClock] = useState<string | null>(null);
    const { darkMode, setDarkMode, followsSystem, resetToSystem } = useDarkModeContext();

    // Hydration-safe 24h WIB live clock
    useEffect(() => {
        const update = () => setClock(`${getWibLiveTime()} WIB`);
        update();
        const timer = setInterval(update, 1000);
        return () => clearInterval(timer);
    }, []);

    const tier = getPerformanceTier(summary.nationalAvgOccupancyPct);

    return (
        <header className="relative z-30 w-full border-b border-border bg-card/90 backdrop-blur-xl px-4 sm:px-6 py-3 transition-all">
            <div className="flex flex-wrap 2xl:flex-nowrap items-center justify-between gap-3 sm:gap-4">
                
                {/* LEFT: Branding & Live Signal */}
                <div className="flex items-center gap-3 sm:gap-4 order-1 flex-shrink-0">
                    {/* Kotak Kantor Station Bug Ident */}
                    <div className="relative h-10 w-14 sm:h-12 sm:w-16 flex-shrink-0 bg-white/95 dark:bg-white rounded-xl p-1 shadow-md shadow-red-950/20 border border-red-500/30 flex items-center justify-center overflow-hidden transition-transform hover:scale-105">
                        <Image
                            src="/kotak-kantor-logo.png"
                            alt="Kotak Kantor"
                            fill
                            className="object-contain p-0.5"
                            priority
                        />
                    </div>

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
                            <div className="flex items-center gap-2 mt-0.5">
                                <h1 className="text-base sm:text-lg font-black uppercase tracking-tight text-foreground flex items-center gap-1.5">
                                    <span className="text-red-600 dark:text-red-400">Kotak Kantor</span>
                                    <span className="text-muted-foreground text-sm font-normal">×</span>
                                    <span>CineRadar</span>
                                    <span className="text-muted-foreground text-sm font-normal font-mono">/ {summary.date}</span>
                                </h1>
                            </div>
                        </div>
                    </div>
                </div>

                {/* CENTER: Hero Telemetry Quick Counters (Full width on < 2xl, center row on >= 2xl) */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3.5 order-3 2xl:order-2 w-full 2xl:w-auto 2xl:flex-1 2xl:max-w-2xl 2xl:mx-6">
                    {/* Shows */}
                    <div className="bg-muted/40 border border-border/80 rounded-xl px-3 py-1.5 sm:py-2 flex flex-col justify-center min-w-0 shadow-sm">
                        <span className="text-sm font-bold uppercase tracking-wider text-muted-foreground truncate whitespace-nowrap">
                            National Shows
                        </span>
                        <span className="font-mono font-black text-base sm:text-lg xl:text-xl text-foreground tracking-tight truncate">
                            {summary.totalShowtimes.toLocaleString()}
                        </span>
                    </div>

                    {/* Audience */}
                    <div className="bg-muted/40 border border-border/80 rounded-xl px-3 py-1.5 sm:py-2 flex flex-col justify-center min-w-0 shadow-sm">
                        <span className="text-sm font-bold uppercase tracking-wider text-muted-foreground truncate whitespace-nowrap">
                            Audience Sold
                        </span>
                        <span className="font-mono font-black text-base sm:text-lg xl:text-xl text-foreground tracking-tight truncate">
                            {summary.totalEstimatedAdmissions > 0
                                ? summary.totalEstimatedAdmissions.toLocaleString()
                                : 'Sweeping...'}
                        </span>
                    </div>

                    {/* National Occupancy */}
                    <div className="bg-muted/40 border border-border/80 rounded-xl px-3 py-1.5 sm:py-2 flex flex-col justify-center min-w-0 shadow-sm">
                        <span className="text-sm font-bold uppercase tracking-wider text-muted-foreground truncate whitespace-nowrap">
                            Avg Occupancy
                        </span>
                        <div className="flex items-baseline gap-1 min-w-0">
                            <span className={`font-mono font-black text-base sm:text-lg xl:text-xl tracking-tight truncate ${tier.twText}`}>
                                {summary.nationalAvgOccupancyPct > 0 ? `${summary.nationalAvgOccupancyPct}%` : '0.0%'}
                            </span>
                        </div>
                    </div>

                    {/* Active Movies */}
                    <div className="bg-muted/40 border border-border/80 rounded-xl px-3 py-1.5 sm:py-2 flex flex-col justify-center min-w-0 shadow-sm">
                        <span className="text-sm font-bold uppercase tracking-wider text-muted-foreground truncate whitespace-nowrap">
                            Active Titles
                        </span>
                        <span className="font-mono font-black text-base sm:text-lg xl:text-xl text-primary tracking-tight truncate">
                            {summary.activeMoviesCount}
                        </span>
                    </div>
                </div>

                {/* RIGHT: Floating Controls (Auto-fades on idle) */}
                <div
                    className={`
                        flex items-center gap-2 transition-opacity duration-300 order-2 2xl:order-3 ml-auto 2xl:ml-0 flex-shrink-0
                        ${showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'}
                    `}
                >
                    {/* Theme Switcher: Light / Dark / System */}
                    <div
                        className="flex items-center bg-muted/60 border border-border rounded-lg p-0.5"
                        title="Theme (Light / Dark / System)"
                        suppressHydrationWarning
                    >
                        <button
                            type="button"
                            onClick={() => setDarkMode(false)}
                            className={`p-1.5 rounded-md transition-colors ${
                                isMounted && !followsSystem && !darkMode
                                    ? 'bg-primary text-primary-foreground shadow-sm'
                                    : 'text-muted-foreground hover:text-foreground'
                            }`}
                            title="Light theme"
                            suppressHydrationWarning
                        >
                            <Sun className="w-3.5 h-3.5" />
                        </button>
                        <button
                            type="button"
                            onClick={() => setDarkMode(true)}
                            className={`p-1.5 rounded-md transition-colors ${
                                isMounted && !followsSystem && darkMode
                                    ? 'bg-primary text-primary-foreground shadow-sm'
                                    : 'text-muted-foreground hover:text-foreground'
                            }`}
                            title="Dark theme"
                            suppressHydrationWarning
                        >
                            <Moon className="w-3.5 h-3.5" />
                        </button>
                        <button
                            type="button"
                            onClick={resetToSystem}
                            className={`p-1.5 rounded-md transition-colors ${
                                !isMounted || followsSystem
                                    ? 'bg-primary text-primary-foreground shadow-sm'
                                    : 'text-muted-foreground hover:text-foreground'
                            }`}
                            title="System theme"
                            suppressHydrationWarning
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
