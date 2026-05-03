/**
 * Performance Page
 * Pulls from Firestore movie_performance_v2
 */
'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Film, Trophy, ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import useSWR from 'swr';
import {
    PerformanceTab,
    UpdateTimer
} from '@/features/performances';
import { MovieWithStats, DiagnosticData } from '@/features/performances/types/performance';
import { getTodayJakarta } from '@/lib/timeUtils';
import { fetcher } from '@/lib/api';
import { ApiResponse } from '@/types';

function shiftDate(dateStr: string, days: number): string {
    const d = new Date(dateStr + 'T00:00:00');
    d.setDate(d.getDate() + days);
    return d.toLocaleDateString('en-CA'); // YYYY-MM-DD
}

function formatDisplayDate(dateStr: string): string {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
}

function formatShortDate(dateStr: string): { day: string; weekday: string } {
    const d = new Date(dateStr + 'T00:00:00');
    return {
        day: d.toLocaleDateString('en-US', { day: 'numeric' }),
        weekday: d.toLocaleDateString('en-US', { weekday: 'short' }),
    };
}

export default function PerformancePage() {
    const today = getTodayJakarta();
    const [selectedDate, setSelectedDate] = useState(today);

    // 1. Centralized Data Fetching (Lifts state from PerformanceTab)
    const { data, isLoading, error } = useSWR(
        `/api/performance?date=${selectedDate}`, 
        fetcher,
        { refreshInterval: 60000 } // Live monitoring refresh every 60s
    );
    
    const result = data as ApiResponse<{ movies: MovieWithStats[]; diagnostic: DiagnosticData }> | undefined;
    const movies = useMemo(() => result?.success ? result.data.movies : [], [result]);
    const diagnostic = useMemo(() => result?.success ? result.data.diagnostic : null, [result]);

    const lastSweptAt = useMemo(() => {
        const timestamps = movies
            .map(m => m.today?.last_swept_at)
            .filter((ts): ts is string => !!ts);
        if (timestamps.length === 0) return null;
        return timestamps.sort().reverse()[0];
    }, [movies]);

    const goBack = useCallback(() => setSelectedDate(d => shiftDate(d, -1)), []);
    const goForward = useCallback(() => setSelectedDate(d => {
        const next = shiftDate(d, 1);
        return next > today ? d : next;
    }), [today]);
    const goToday = useCallback(() => setSelectedDate(today), [today]);

    // Keyboard arrow navigation
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
            if (e.key === 'ArrowLeft') { e.preventDefault(); goBack(); }
            if (e.key === 'ArrowRight') { e.preventDefault(); goForward(); }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [goBack, goForward]);

    const isToday = selectedDate === today;

    // Build a 5-day strip centered on selectedDate
    const stripDates = Array.from({ length: 5 }, (_, i) => shiftDate(selectedDate, i - 2));

    return (
        <div className="min-h-screen bg-background text-foreground p-6">
            {/* Header */}
            <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-primary/10 rounded-xl">
                            <Film className="w-6 h-6 text-primary" />
                        </div>
                        <h1 className="text-3xl font-black uppercase tracking-tighter">Market Pulse</h1>
                    </div>
                    <div className="flex items-center">
                        <p className="text-muted-foreground text-sm font-medium">
                            Box office performance for{' '}
                            <span className="text-foreground font-bold">{formatDisplayDate(selectedDate)}</span>
                        </p>
                        {lastSweptAt && (
                            <UpdateTimer 
                                lastSweptAt={lastSweptAt} 
                                variant="minimal" 
                                showNextUpdate={selectedDate === today} 
                            />
                        )}
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <Button variant="outline" size="sm" className="h-9 px-4 gap-2 rounded-xl border-border/60 hover:bg-muted transition-all" asChild>
                        <Link href="/performances/all-time">
                            <Trophy className="w-4 h-4 text-amber-500" />
                            <span className="text-xs font-bold uppercase tracking-wider">All-Time Leaders</span>
                        </Link>
                    </Button>
                </div>
            </div>

            {/* Date Navigation Strip */}
            <div className="mb-8 flex items-center justify-center gap-2">
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 rounded-lg"
                    onClick={goBack}
                    title="Previous day (←)"
                >
                    <ChevronLeft className="w-4 h-4" />
                </Button>

                <div className="flex items-center gap-1">
                    {stripDates.map((d) => {
                        const isActive = d === selectedDate;
                        const isDateToday = d === today;
                        const { day, weekday } = formatShortDate(d);
                        const isFuture = d > today;

                        return (
                            <button
                                key={d}
                                onClick={() => !isFuture && setSelectedDate(d)}
                                disabled={isFuture}
                                className={`
                                    relative flex flex-col items-center px-3 py-1.5 rounded-xl transition-all
                                    ${isActive
                                        ? 'bg-primary text-primary-foreground shadow-sm'
                                        : isFuture
                                            ? 'opacity-25 cursor-not-allowed'
                                            : 'hover:bg-muted cursor-pointer'
                                    }
                                `}
                            >
                                <span className="text-[9px] font-bold uppercase tracking-wider opacity-60">{weekday}</span>
                                <span className="text-sm font-black font-mono leading-tight">{day}</span>
                                {isDateToday && !isActive && (
                                    <div className="absolute -bottom-0.5 w-1 h-1 rounded-full bg-primary" />
                                )}
                            </button>
                        );
                    })}
                </div>

                <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 rounded-lg"
                    onClick={goForward}
                    disabled={isToday}
                    title="Next day (→)"
                >
                    <ChevronRight className="w-4 h-4" />
                </Button>

                {/* Native date picker — jump to any past date */}
                <div className="relative ml-1 flex items-center">
                    <CalendarDays className="absolute left-2.5 w-3 h-3 pointer-events-none text-foreground" />
                    <input
                        type="date"
                        max={today}
                        value={selectedDate}
                        onChange={(e) => e.target.value && setSelectedDate(e.target.value)}
                        className="h-8 pl-7 pr-2 rounded-lg border border-border/60 bg-background text-[10px] font-bold uppercase tracking-wider text-foreground cursor-pointer hover:bg-muted transition-colors"
                    />
                </div>

                {!isToday && (
                    <Button
                        variant="outline"
                        size="sm"
                        className="ml-1 h-8 px-3 gap-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider"
                        onClick={goToday}
                    >
                        Today
                    </Button>
                )}
            </div>

            {/* Main Content */}
            <PerformanceTab 
                date={selectedDate} 
                movies={movies}
                diagnostic={diagnostic}
                isLoading={isLoading}
                error={error}
            />
        </div>
    );
}
