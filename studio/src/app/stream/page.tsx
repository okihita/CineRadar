'use client';

import { Suspense, useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import { getTodayJakarta } from '@/lib/timeUtils';
import {
    useStreamData,
    StreamHudHeader,
    StreamLeaderboard,
    StreamTicker,
    StreamSettingsModal,
    extrapolateStreamData,
} from '@/features/stream';
import { Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useDarkModeContext } from '@/hooks';

function StreamBackdropContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const { darkMode, setDarkMode, followsSystem, resetToSystem } = useDarkModeContext();

    const today = getTodayJakarta();
    const dateParam = searchParams.get('date');
    const [selectedDate, setSelectedDate] = useState<string>(dateParam || today);

    // Sync selectedDate with query param if it changes
    useEffect(() => {
        if (dateParam && dateParam !== selectedDate) {
            setSelectedDate(dateParam);
        }
    }, [dateParam, selectedDate]);

    const [isFullscreen, setIsFullscreen] = useState(false);
    const [autoCycle, setAutoCycle] = useState(true);

    // Broadcast Settings State (persisted to localStorage)
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [showCircuits, setShowCircuits] = useState<boolean>(() => {
        if (typeof window === 'undefined') return true;
        return localStorage.getItem('cineradar-stream-show-circuits') !== 'false';
    });
    const [extrapolateData, setExtrapolateData] = useState<boolean>(() => {
        if (typeof window === 'undefined') return false;
        return localStorage.getItem('cineradar-stream-extrapolate') === 'true';
    });

    const handleToggleShowCircuits = useCallback((val: boolean) => {
        setShowCircuits(val);
        localStorage.setItem('cineradar-stream-show-circuits', String(val));
    }, []);

    const handleToggleExtrapolateData = useCallback((val: boolean) => {
        setExtrapolateData(val);
        localStorage.setItem('cineradar-stream-extrapolate', String(val));
    }, []);

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

    // Cycle theme modes: System -> Light -> Dark -> System
    const cycleTheme = useCallback(() => {
        if (followsSystem) {
            setDarkMode(false);
        } else if (!darkMode) {
            setDarkMode(true);
        } else {
            resetToSystem();
        }
    }, [followsSystem, darkMode, setDarkMode, resetToSystem]);

    // Keyboard navigation shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

            if (e.key === 'f' || e.key === 'F') {
                e.preventDefault();
                toggleFullscreen();
            } else if (e.key === 'm' || e.key === 'M') {
                e.preventDefault();
                cycleTheme();
            } else if (e.key === 's' || e.key === 'S' || e.key === ',') {
                e.preventDefault();
                setSettingsOpen((prev) => !prev);
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
    }, [toggleFullscreen, cycleTheme, today, router]);

    // Handle date change
    const handleDateChange = (newDate: string) => {
        setSelectedDate(newDate);
        router.push(`/stream?date=${newDate}`);
    };

    // Pull real-time aggregated data
    const { movies, summary, isLoading, isValidating, error, refresh } = useStreamData(selectedDate);
    const [isManualRefreshing, setIsManualRefreshing] = useState(false);
    const isRefreshing = isManualRefreshing || isValidating;

    // Apply 5-15% coverage extrapolation if enabled
    const displayData = useMemo(() => {
        if (!extrapolateData) {
            return { movies, summary };
        }
        return extrapolateStreamData(movies, summary, selectedDate);
    }, [extrapolateData, movies, summary, selectedDate]);

    const handleManualRefresh = async () => {
        setIsManualRefreshing(true);
        try {
            await refresh();
        } finally {
            setTimeout(() => setIsManualRefreshing(false), 600);
        }
    };

    return (
        <div className="relative w-full h-full min-h-screen bg-background text-foreground flex flex-col justify-between select-none overflow-hidden">
            {/* Ambient Broadcast Watermark */}
            <div className="pointer-events-none fixed right-6 bottom-14 w-72 sm:w-96 aspect-[1024/721] opacity-[0.035] dark:opacity-[0.06] select-none -rotate-6 z-0">
                <Image
                    src="/kotak-kantor-logo.png"
                    alt=""
                    fill
                    className="object-contain"
                />
            </div>

            {/* Top HUD */}
            <StreamHudHeader
                summary={displayData.summary}
                isFullscreen={isFullscreen}
                onToggleFullscreen={toggleFullscreen}
                onDateChange={handleDateChange}
                selectedDate={selectedDate}
                onRefresh={handleManualRefresh}
                isRefreshing={isRefreshing}
                showControls={showControls}
                onOpenSettings={() => setSettingsOpen(true)}
            />

            {/* Main Stage / Theatrical Leaderboard */}
            {error ? (
                <div className="flex-1 flex flex-col items-center justify-center gap-3 text-muted-foreground">
                    <AlertCircle className="w-10 h-10 text-red-500" />
                    <p className="font-mono text-sm uppercase tracking-widest text-red-500">
                        Unable to connect to Quick Count Feed
                    </p>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handleManualRefresh}
                        className="font-mono text-sm border-border bg-card text-foreground hover:bg-muted mt-2"
                    >
                        Retry Feed
                    </Button>
                </div>
            ) : isLoading && movies.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center gap-3 text-muted-foreground">
                    <Loader2 className="w-10 h-10 animate-spin text-primary" />
                    <p className="font-mono text-sm uppercase tracking-widest text-muted-foreground">
                        Connecting to National Quick Count Feed...
                    </p>
                </div>
            ) : (
                <StreamLeaderboard
                    movies={displayData.movies}
                    autoCycle={autoCycle}
                    isRefreshing={isRefreshing}
                />
            )}

            {/* Bottom Ticker & Sweeper Telemetry */}
            <StreamTicker
                circuits={displayData.summary.circuits}
                movies={displayData.movies}
                lastSweptAt={summary.lastSweptAt}
                showCircuits={showCircuits}
            />

            {/* Presentation Settings Modal */}
            <StreamSettingsModal
                open={settingsOpen}
                onOpenChange={setSettingsOpen}
                showCircuits={showCircuits}
                onToggleShowCircuits={handleToggleShowCircuits}
                extrapolateData={extrapolateData}
                onToggleExtrapolateData={handleToggleExtrapolateData}
            />
        </div>
    );
}

export default function StreamBackdropPage() {
    return (
        <Suspense
            fallback={
                <div className="w-screen h-screen bg-background text-foreground flex items-center justify-center font-mono text-sm">
                    <Loader2 className="w-6 h-6 animate-spin text-primary mr-2" />
                    INITIALIZING BROADCAST ENGINE...
                </div>
            }
        >
            <StreamBackdropContent />
        </Suspense>
    );
}
