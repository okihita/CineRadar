/**
 * Scraper Monitor Page
 * Track data collection runs and system health
 *
 * Redesigned: Uses new scraper_logs/dispatches schema
 * - Date-based navigation
 * - Dispatch timeline visualization
 * - Morning scrape status
 * - Daily stats cards
 */
'use client';

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { PageHeader } from '@/components/PageHeader';
import { Database, Calendar } from 'lucide-react';
import { JITGranularMonitor } from '@/components/scraper/JITGranularMonitor';

// Feature imports
import {
    useScraperData,
    useScraperDay,
    DateNavigator,
    DispatchTimeline,
    MorningScrapeCard,
    DailyStatsCards,
    ScrapeHistoryTable,
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

export default function ScraperPage() {
    const [selectedDate, setSelectedDate] = useState(getTodayDate());
    const [refreshing, setRefreshing] = useState(false);
    const [selectedDispatch, setSelectedDispatch] = useState<string | null>(null);

    // Historical data for the sidebar
    const { logs, stats } = useScraperData();

    // Current day data
    const {
        dispatches,
        morningRun,
        dayStats,
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
        setSelectedDate(date);
        setSelectedDispatch(null);
    };

    const handleDispatchClick = (dispatchId: string) => {
        setSelectedDispatch(selectedDispatch === dispatchId ? null : dispatchId);
    };

    if (isLoading) {
        return (
            <div className="p-6">
                <div className="h-48 bg-muted animate-pulse rounded-lg" />
            </div>
        );
    }

    return (
        <div className="p-6">
            <PageHeader
                title="Scraper Monitor"
                description="Track data collection runs and system health"
                icon={<Database className="w-6 h-6 text-primary" />}
                lastUpdated={stats.lastRunTime}
                onRefresh={handleRefresh}
                isRefreshing={refreshing}
                showMockBadge={false}
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
                    coveragePercent={dayStats.coveragePercent}
                    totalDispatches={dayStats.totalDispatches}
                    errorDispatches={dayStats.errorDispatches}
                />
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
                    />
                </div>
            )}

            {/* JIT Monitor - Keep for seat snapshots */}
            {selectedDate === getTodayDate() && (
                <div className="mb-6">
                    <JITGranularMonitor />
                </div>
            )}

            {/* Scrape History Table */}
            <ScrapeHistoryTable logs={logs} />
        </div>
    );
}
