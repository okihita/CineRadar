/**
 * Scraper Stats Cards component
 */
'use client';

import { Card, CardContent } from '@/components/ui/card';
import type { ScraperStats } from '../types';

interface ScraperStatsCardsProps {
    stats: ScraperStats;
}

export function ScraperStatsCards({ stats }: ScraperStatsCardsProps) {
    return (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
            <Card>
                <CardContent className="pt-4">
                    <div className="text-2xl font-bold">{stats.totalRuns}</div>
                    <div className="text-xs text-muted-foreground">Total Runs</div>
                </CardContent>
            </Card>
            <Card>
                <CardContent className="pt-4">
                    <div className="text-2xl font-bold text-green-600">{stats.successRate}%</div>
                    <div className="text-xs text-muted-foreground">Success Rate</div>
                </CardContent>
            </Card>
            <Card>
                <CardContent className="pt-4">
                    <div className="text-2xl font-bold">{stats.avgMovies}</div>
                    <div className="text-xs text-muted-foreground">Avg Movies/Run</div>
                </CardContent>
            </Card>
            <Card>
                <CardContent className="pt-4">
                    <div className="text-2xl font-bold">{stats.avgTheatres}</div>
                    <div className="text-xs text-muted-foreground">Avg Theatres/Run</div>
                </CardContent>
            </Card>
            <Card>
                <CardContent className="pt-4">
                    <div className="text-sm font-medium">{stats.lastRunTime}</div>
                    <div className="text-xs text-muted-foreground">Last Run</div>
                </CardContent>
            </Card>
        </div>
    );
}
