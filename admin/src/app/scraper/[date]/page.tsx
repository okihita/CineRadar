/**
 * Scraper Monitor Page - Date Route
 * Track data collection runs and system health for a specific date
 *
 * URL format: /scraper/2026-02-14
 */
'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { PageHeader } from '@/components/PageHeader';
import { Database, Calendar } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

// Feature imports
import {
    useScraperData,
    useScraperDay,
    DateNavigator,
    DispatchTimeline,
    MorningScrapeCard,
    DailyStatsCards,
    WaveBreakdown,
} from '@/features/scraper';

// Helper to get today's date in YYYY-MM-DD format using Jakarta timezone
const getTodayDate = () => {
    const now = new Date();
    const wibOptions: Intl.DateTimeFormatOptions = {
        timeZone: 'Asia/Jakarta',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    };
    const parts = new Intl.DateTimeFormat('en-CA', wibOptions).formatToParts(now);
    const year = parts.find(p => p.type === 'year')?.value || '';
    const month = parts.find(p => p.type === 'month')?.value || '';
    const day = parts.find(p => p.type === 'day')?.value || '';
    return `${year}-${month}-${day}`;
};

// Helper to get min date (first available log)
const getMinDate = () => {
    // Allow going back to January 2025
    return '2025-01-01';
};

// Validate date format YYYY-MM-DD
const isValidDateFormat = (dateStr: string): boolean => {
    const regex = /^\d{4}-\d{2}-\d{2}$/;
    if (!regex.test(dateStr)) return false;
    const date = new Date(dateStr);
    return !isNaN(date.getTime());
};

interface PageProps {
    params: Promise<{ date: string }>;
}

export default function ScraperDatePage({ params }: PageProps) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [resolvedParams, setResolvedParams] = useState<{ date: string } | null>(null);

    // Unwrap params promise
    useEffect(() => {
        params.then(setResolvedParams);
    }, [params]);

    // Get dispatch from query params for deep linking
    const selectedDispatch = searchParams.get('dispatch');

    const [refreshing, setRefreshing] = useState(false);

    // Historical data for stats (used by PageHeader)
    const { stats } = useScraperData();

    // Get date from URL or default to today
    const routeDate = resolvedParams?.date || '';

    // Validate and normalize date
    const selectedDate = isValidDateFormat(routeDate) ? routeDate : getTodayDate();

    // Current day data
    const {
        dispatches,
        morningRun,
        dayStats,
        jitSummary,
        isLoading,
        isError,
        notFound,
        refresh,
    } = useScraperDay(selectedDate);

    const handleRefresh = () => {
        setRefreshing(true);
        refresh();
        setTimeout(() => setRefreshing(false), 1000);
    };

    const handleDateChange = (date: string) => {
        router.push(`/scraper/${date}`);
    };

    const handleDispatchClick = (dispatchId: string) => {
        const newUrl = `/scraper/${selectedDate}?dispatch=${dispatchId}`;
        router.push(newUrl, { scroll: false });
    };

    // Redirect invalid dates to today
    useEffect(() => {
        if (resolvedParams && !isValidDateFormat(routeDate)) {
            router.replace(`/scraper/${getTodayDate()}`);
        }
    }, [resolvedParams, routeDate, router]);

    // Show loading while resolving params
    if (!resolvedParams || isLoading) {
        return (
            <div className="p-6">
                <Skeleton className="h-48 w-full rounded-lg" />
            </div>
        );
    }

    return (
        <div className="p-6">
            <PageHeader
                title="Scraper Monitor"
                description={`Track data collection runs for ${selectedDate}`}
                icon={<Database className="w-6 h-6 text-primary" />}
                lastUpdated={stats.lastRunTime}
                onRefresh={handleRefresh}
                isRefreshing={refreshing}
            />

            {/* Date Navigator */}
            <div className="mb-6">
                <DateNavigator
                    selectedDate={selectedDate}
                    onDateChange={handleDateChange}
                    minDate={getMinDate()}
                    maxDate={getTodayDate()}
                />
            </div>

            {/* Daily Stats Cards */}
            <div className="mb-6">
                <DailyStatsCards
                    totalSchedules={dayStats.totalSchedules}
                    availableSchedules={dayStats.availableSchedules}
                    waveMultiplier={jitSummary?.waveMultiplier ?? 1}
                    coveragePercent={dayStats.coveragePercent}
                    totalDispatches={dayStats.totalDispatches}
                    totalSuccesses={dayStats.totalSuccesses}
                    totalErrors={dayStats.totalErrors}
                    errorBreakdown={dayStats.errorBreakdown}
                />
            </div>

            {/* Wave Performance Breakdown */}
            <div className="mb-6">
                <WaveBreakdown summary={jitSummary} />
            </div>

            {/* Morning Scrape Card */}
            <div className="mb-6">
                <MorningScrapeCard morningRun={morningRun} />
            </div>

            {/* Not Found Message */}
            {notFound && (
                <Card className="mb-6 border-dashed">
                    <CardContent className="py-8 text-center text-slate-500">
                        <Calendar className="w-8 h-8 mx-auto mb-2 opacity-50" />
                        <p>No scraper data found for {selectedDate}</p>
                        <p className="text-sm mt-1">Try selecting a different date</p>
                    </CardContent>
                </Card>
            )}

            {/* Error Message */}
            {isError && (
                <Card className="mb-6 border-red-500/50">
                    <CardContent className="py-4 text-center text-red-400">
                        <p>Failed to load scraper data. Please try again.</p>
                    </CardContent>
                </Card>
            )}

            {/* Dispatch Timeline */}
            {!notFound && Object.keys(dispatches).length > 0 && (
                <div className="mb-6">
                    <DispatchTimeline
                        dispatches={dispatches}
                        selectedId={selectedDispatch}
                        onDispatchClick={handleDispatchClick}
                        date={selectedDate}
                    />
                </div>
            )}
        </div>
    );
}
