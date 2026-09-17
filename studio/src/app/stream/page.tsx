'use client';

import { Suspense, useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { getTodayJakarta } from '@/lib/timeUtils';
import {
    useStreamData,
    StreamLayoutMode,
    StreamHudHeader,
    StreamLeaderboard,
    StreamTicker,
} from '@/features/stream';
import { Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

function StreamBackdropContent() {
    const searchParams = useSearchParams();
    const router = useRouter();

    const today = getTodayJakarta();
    const dateParam = searchParams.get('date');
    const [selectedDate, setSelectedDate] = useState<string>(dateParam || today);

    // Sync selectedDate with query param if it changes
    useEffect(() => {
        if (dateParam && dateParam !== selectedDate) {
            setSelectedDate(dateParam);
        }
    }, [dateParam, selectedDate]);

    // Layout mode: 'landscape' (16:9 TV wall) vs 'vertical' (9:16 TikTok studio)
    const [layoutMode, setLayoutMode] = useState<StreamLayoutMode>('landscape');
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [autoCycle, setAutoCycle] = useState(true);

    // Auto-fading controls on mouse idle
    const [showControls, setShowControls] = useState(true);
    const idleTimerRef = useRef<NodeJS.Timeout | null>(null);

    const resetIdleTimer = useCallback(() => {
        setShowControls(true);
        if (idleTimerRef.current) {
            clearTimeout(idleTimerRef.current);
        }
        idleTimerRef.current = setTimeout(() => {
            setShowControls(false);
        }, 3500);
    }, []);

    useEffect(() => {
        const handleActivity = () => resetIdleTimer();
        window.addEventListener('mousemove', handleActivity);
        window.addEventListener('keydown', handleActivity);
        resetIdleTimer();

        return () => {
            window.removeEventListener('mousemove', handleActivity);
            window.removeEventListener('keydown', handleActivity);
            if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
        };
    }, [resetIdleTimer]);

    // Fullscreen listeners & handler
    const toggleFullscreen = useCallback(async () => {
        try {
            if (!document.fullscreenElement) {
                await document.documentElement.requestFullscreen();
                setIsFullscreen(true);
            } else {
                if (document.exitFullscreen) {
                    await document.exitFullscreen();
                    setIsFullscreen(false);
                }
            }
        } catch (err) {
            console.error('Fullscreen toggle error:', err);
        }
    }, []);

    useEffect(() => {
        const handleFsChange = () => {
            setIsFullscreen(!!document.fullscreenElement);
        };
        document.addEventListener('fullscreenchange', handleFsChange);
        return () => document.removeEventListener('fullscreenchange', handleFsChange);
    }, []);

    // Toggle layout mode
    const toggleLayout = useCallback(() => {
        setLayoutMode((prev) => (prev === 'landscape' ? 'vertical' : 'landscape'));
    }, []);

    // Keyboard navigation shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

            if (e.key === 'f' || e.key === 'F') {
                e.preventDefault();
                toggleFullscreen();
            } else if (e.key === 'l' || e.key === 'L') {
                e.preventDefault();
                toggleLayout();
            } else if (e.key === 't' || e.key === 'T') {
                e.preventDefault();
                setSelectedDate(today);
                router.push(`/stream?date=${today}`);
            } else if (e.key === 'Escape' && !document.fullscreenElement) {
                e.preventDefault();
                router.push('/compare');
            } else if (e.code === 'Space') {
                e.preventDefault();
                setAutoCycle((prev) => !prev);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [toggleFullscreen, toggleLayout, today, router]);

    // Handle date change
    const handleDateChange = (newDate: string) => {
        setSelectedDate(newDate);
        router.push(`/stream?date=${newDate}`);
    };

    // Pull real-time aggregated data
    const { movies, summary, isLoading, error, refresh } = useStreamData(selectedDate);
    const [isRefreshing, setIsRefreshing] = useState(false);

    const handleManualRefresh = async () => {
        setIsRefreshing(true);
        try {
            await refresh();
        } finally {
            setTimeout(() => setIsRefreshing(false), 600);
        }
    };

    return (
        <div
            className={`
                w-full h-full min-h-screen bg-zinc-950 text-white flex flex-col justify-between select-none overflow-hidden
                ${layoutMode === 'vertical' ? 'max-w-2xl mx-auto border-x border-zinc-900 shadow-2xl' : ''}
            `}
        >
            {/* Top HUD */}
            <StreamHudHeader
                summary={summary}
                layoutMode={layoutMode}
                onToggleLayout={toggleLayout}
                isFullscreen={isFullscreen}
                onToggleFullscreen={toggleFullscreen}
                onDateChange={handleDateChange}
                selectedDate={selectedDate}
                onRefresh={handleManualRefresh}
                isRefreshing={isRefreshing}
                showControls={showControls}
            />

            {/* Main Stage / Theatrical Leaderboard */}
            {error ? (
                <div className="flex-1 flex flex-col items-center justify-center gap-3 text-zinc-500">
                    <AlertCircle className="w-10 h-10 text-red-500" />
                    <p className="font-mono text-sm uppercase tracking-widest text-red-400">
                        Unable to connect to Quick Count Feed
                    </p>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handleManualRefresh}
                        className="font-mono text-sm border-zinc-700 bg-zinc-900 text-zinc-200 hover:bg-zinc-800 mt-2"
                    >
                        Retry Feed
                    </Button>
                </div>
            ) : isLoading && movies.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center gap-3 text-zinc-500">
                    <Loader2 className="w-10 h-10 animate-spin text-primary" />
                    <p className="font-mono text-sm uppercase tracking-widest text-zinc-400">
                        Connecting to National Quick Count Feed...
                    </p>
                </div>
            ) : (
                <StreamLeaderboard
                    movies={movies}
                    layoutMode={layoutMode}
                    autoCycle={autoCycle}
                />
            )}

            {/* Bottom Ticker & Sweeper Telemetry */}
            <StreamTicker
                circuits={summary.circuits}
                movies={movies}
                lastSweptAt={summary.lastSweptAt}
            />
        </div>
    );
}

export default function StreamBackdropPage() {
    return (
        <Suspense
            fallback={
                <div className="w-screen h-screen bg-zinc-950 text-white flex items-center justify-center font-mono text-sm">
                    <Loader2 className="w-6 h-6 animate-spin text-primary mr-2" />
                    INITIALIZING BROADCAST ENGINE...
                </div>
            }
        >
            <StreamBackdropContent />
        </Suspense>
    );
}
