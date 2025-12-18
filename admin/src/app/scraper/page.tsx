'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/PageHeader';
import { formatWIBShort } from '@/lib/timeUtils';
import { Database, RefreshCw, AlertTriangle, CheckCircle2, XCircle, Calendar } from 'lucide-react';

interface ScraperRun {
    id?: string;
    date: string;
    timestamp: string;
    status: 'success' | 'partial' | 'failed';
    movies: number;
    cities: number;
    theatres_total: number;
    theatres_success: number;
    theatres_failed: number;
    presales?: number;
}

interface ScraperStats {
    totalRuns: number;
    successRate: number;
    avgMovies: number;
    avgTheatres: number;
    lastRunTime: string;
}

export default function ScraperPage() {
    const [runs, setRuns] = useState<ScraperRun[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const fetchData = async () => {
        try {
            const response = await fetch('/api/scraper');
            if (response.ok) {
                const data = await response.json();
                setRuns(data.runs || []);
            }
        } catch (error) {
            console.error('Error fetching scraper data:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleRefresh = () => {
        setRefreshing(true);
        fetchData();
    };

    // Calculate stats
    const stats: ScraperStats = {
        totalRuns: runs.length,
        successRate: runs.length > 0
            ? Math.round((runs.filter(r => r.status === 'success').length / runs.length) * 100)
            : 0,
        avgMovies: runs.length > 0
            ? Math.round(runs.reduce((sum, r) => sum + r.movies, 0) / runs.length)
            : 0,
        avgTheatres: runs.length > 0
            ? Math.round(runs.reduce((sum, r) => sum + r.theatres_total, 0) / runs.length)
            : 0,
        lastRunTime: runs[0]?.timestamp ? formatWIBShort(runs[0].timestamp) : 'Never',
    };

    const statusIcon = (status: string) => {
        switch (status) {
            case 'success': return <CheckCircle2 className="w-4 h-4 text-green-500" />;
            case 'partial': return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
            case 'failed': return <XCircle className="w-4 h-4 text-red-500" />;
            default: return null;
        }
    };

    if (loading) {
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

            {/* Scrape History Table */}
            <Card>
                <CardHeader className="py-3">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <RefreshCw className="w-4 h-4" />
                        Scrape History
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-40">Timestamp</TableHead>
                                <TableHead className="w-24">Status</TableHead>
                                <TableHead className="text-right">Movies</TableHead>
                                <TableHead className="text-right">Cities</TableHead>
                                <TableHead className="text-right">Theatres</TableHead>
                                <TableHead className="text-right">Pre-sales</TableHead>
                                <TableHead>Changes</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {runs.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                                        <Database className="w-8 h-8 mx-auto mb-2 opacity-50" />
                                        No scrape history yet
                                    </TableCell>
                                </TableRow>
                            ) : (
                                runs.map((run, idx) => {
                                    const prevRun = runs[idx + 1];
                                    const movieDiff = prevRun ? run.movies - prevRun.movies : 0;
                                    const theatreDiff = prevRun ? run.theatres_total - prevRun.theatres_total : 0;
                                    return (
                                        <TableRow key={run.id || run.timestamp}>
                                            <TableCell className="font-mono text-xs">
                                                {formatWIBShort(run.timestamp)}
                                            </TableCell>
                                            <TableCell>
                                                <Badge
                                                    variant={run.status === 'success' ? 'default' : run.status === 'partial' ? 'secondary' : 'destructive'}
                                                    className="text-xs flex items-center gap-1 w-fit"
                                                >
                                                    {statusIcon(run.status)}
                                                    {run.status}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-right font-mono">{run.movies}</TableCell>
                                            <TableCell className="text-right font-mono">{run.cities}</TableCell>
                                            <TableCell className="text-right font-mono">
                                                {run.theatres_success}/{run.theatres_total}
                                                {run.theatres_failed > 0 && (
                                                    <span className="text-red-500 ml-1 text-xs">
                                                        ({run.theatres_failed} failed)
                                                    </span>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-right font-mono">{run.presales || '-'}</TableCell>
                                            <TableCell className="text-xs text-muted-foreground">
                                                {prevRun && (
                                                    <span>
                                                        {movieDiff !== 0 && (
                                                            <span className={movieDiff > 0 ? 'text-green-600' : 'text-red-500'}>
                                                                {movieDiff > 0 ? '+' : ''}{movieDiff} movies{' '}
                                                            </span>
                                                        )}
                                                        {theatreDiff !== 0 && (
                                                            <span className={theatreDiff > 0 ? 'text-green-600' : 'text-red-500'}>
                                                                {theatreDiff > 0 ? '+' : ''}{theatreDiff} theatres
                                                            </span>
                                                        )}
                                                        {movieDiff === 0 && theatreDiff === 0 && <span>No change</span>}
                                                    </span>
                                                )}
                                                {!prevRun && idx === runs.length - 1 && <span>First run</span>}
                                            </TableCell>
                                        </TableRow>
                                    );
                                })
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}
