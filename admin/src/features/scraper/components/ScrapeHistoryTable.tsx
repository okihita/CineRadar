'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Database, RefreshCw, CheckCircle2, AlertTriangle, XCircle, Info } from 'lucide-react';
import { formatWIBShort } from '@/lib/timeUtils';
import type { ScraperLog } from '../types';

interface ScrapeHistoryTableProps {
    logs: ScraperLog[];
}

function StatusIcon({ status }: { status: string }) {
    switch (status) {
        case 'success':
            return <CheckCircle2 className="w-4 h-4 text-green-500" />;
        case 'partial':
            return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
        case 'failed':
            return <XCircle className="w-4 h-4 text-red-500" />;
        default:
            return <AlertTriangle className="w-4 h-4 text-gray-400" />;
    }
}

export function ScrapeHistoryTable({ logs }: ScrapeHistoryTableProps) {
    return (
        <Card className="mb-6">
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
                            <TableHead className="w-40">Date (WIB)</TableHead>
                            <TableHead className="w-24">Status</TableHead>
                            <TableHead className="text-right">Movies</TableHead>
                            <TableHead className="text-right">Cities</TableHead>
                            <TableHead className="text-right">Theatres</TableHead>
                            <TableHead className="text-right">JIT Runs</TableHead>
                            <TableHead>Changes</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {logs.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                                    <Database className="w-8 h-8 mx-auto mb-2 opacity-50" />
                                    No scrape history yet
                                </TableCell>
                            </TableRow>
                        ) : (
                            logs.map((log, idx) => {
                                const prevLog = logs[idx + 1];
                                const currentMovies = log.morning_run?.movies_found || 0;
                                const prevMovies = prevLog?.morning_run?.movies_found || 0;
                                const currentTheatres = log.morning_run?.theatres_total || 0;
                                const prevTheatres = prevLog?.morning_run?.theatres_total || 0;

                                const movieDiff = prevLog ? currentMovies - prevMovies : 0;
                                const theatreDiff = prevLog ? currentTheatres - prevTheatres : 0;
                                const status = log.morning_run?.status || 'unknown';
                                const jitCount = log.dispatches ? Object.keys(log.dispatches).length : 0;

                                return (
                                    <TableRow key={log.date}>
                                        <TableCell className="font-mono text-xs">
                                            {formatWIBShort(log.created_at)}
                                            <div className="text-[10px] text-muted-foreground">{log.date}</div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-1">
                                                <Badge
                                                    variant={status === 'success' ? 'default' : status === 'partial' ? 'secondary' : 'destructive'}
                                                    className="text-xs flex items-center gap-1 w-fit"
                                                >
                                                    <StatusIcon status={status} />
                                                    {status}
                                                </Badge>
                                                {log.morning_run?.error && (
                                                    <span title={log.morning_run.error} className="cursor-help inline-flex">
                                                        <Info className="w-3 h-3 text-red-400" />
                                                    </span>
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-right font-mono">{currentMovies}</TableCell>
                                        <TableCell className="text-right font-mono">{log.morning_run?.cities_covered || 0}</TableCell>
                                        <TableCell className="text-right font-mono">
                                            {currentTheatres}
                                        </TableCell>
                                        <TableCell className="text-right font-mono">
                                            {jitCount > 0 ? (
                                                <Badge variant="outline" className="text-xs">{jitCount}</Badge>
                                            ) : '-'}
                                        </TableCell>
                                        <TableCell className="text-xs text-muted-foreground">
                                            {prevLog && (
                                                <span>
                                                    {movieDiff !== 0 && (
                                                        <span className={movieDiff > 0 ? 'text-green-600' : 'text-red-500'}>
                                                            {movieDiff > 0 ? '+' : ''}
                                                            {movieDiff} movies{' '}
                                                        </span>
                                                    )}
                                                    {theatreDiff !== 0 && (
                                                        <span className={theatreDiff > 0 ? 'text-green-600' : 'text-red-500'}>
                                                            {theatreDiff > 0 ? '+' : ''}
                                                            {theatreDiff} theatres
                                                        </span>
                                                    )}
                                                    {movieDiff === 0 && theatreDiff === 0 && <span>No change</span>}
                                                </span>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                );
                            })
                        )}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
}
