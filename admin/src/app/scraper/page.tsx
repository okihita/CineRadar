/**
 * Scraper Monitor Page
 * Track data collection runs and system health
 *
 * Refactored: 490 lines → ~100 lines
 * - Feature-based folder structure (/features/scraper/)
 * - SWR for server state (useScraperData)
 * - Extracted components: ScraperStatsCards, TodayScrapeCards,
 *   ScrapeHistoryTable, DatabaseExplorer
 */
'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader } from '@/components/PageHeader';
import { Database, Calendar } from 'lucide-react';
import { JITGranularMonitor } from '@/components/scraper/JITGranularMonitor';

// Feature imports
import {
    useScraperData,
    ScraperStatsCards,
    TodayScrapeCards,
    ScrapeHistoryTable,
    DatabaseExplorer,
} from '@/features/scraper';

export default function ScraperPage() {
    const [refreshing, setRefreshing] = useState(false);

    // Server state (SWR)
    const {
        runs,
        morningScrape,
        jitSummary,
        collections,
        stats,
        isLoading,
        isStatsLoading,
        refresh,
    } = useScraperData();

    const handleRefresh = () => {
        setRefreshing(true);
        refresh();
        setTimeout(() => setRefreshing(false), 1000);
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

            {/* Stats Cards */}
            <ScraperStatsCards stats={stats} />

            {/* Today's Reports */}
            <TodayScrapeCards morningScrape={morningScrape} jitSummary={jitSummary} />

            {/* Scrape History Table */}
            <ScrapeHistoryTable runs={runs} />

            {/* JIT Monitor */}
            <div className="mb-6">
                <JITGranularMonitor />
            </div>

            {/* Database Explorer */}
            <DatabaseExplorer collections={collections} isLoading={isStatsLoading} />

            {/* Schedule Info */}
            <Card className="mb-6">
                <CardHeader className="py-3">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <Calendar className="w-4 h-4" />
                        Scraper Schedule (WIB)
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                        <div className="p-3 bg-muted/50 rounded-lg">
                            <div className="font-medium">Token Refresh</div>
                            <div className="text-muted-foreground">Daily at 5:50 AM</div>
                        </div>
                        <div className="p-3 bg-muted/50 rounded-lg">
                            <div className="font-medium">Movie + Theatre Scrape</div>
                            <div className="text-muted-foreground">Daily at 6:00 AM</div>
                        </div>
                        <div className="p-3 bg-muted/50 rounded-lg">
                            <div className="font-medium">JIT Seat Scrape</div>
                            <div className="text-muted-foreground">Every 15 min (9 AM - 11 PM)</div>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
