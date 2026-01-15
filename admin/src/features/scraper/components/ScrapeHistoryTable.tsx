/**
 * Scrape History Table component
 */
'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Database, RefreshCw, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';
import { formatWIBShort } from '@/lib/timeUtils';
import type { ScraperRun } from '../types';

interface ScrapeHistoryTableProps {
    runs: ScraperRun[];
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
            return null;
    }
}

export function ScrapeHistoryTable({ runs }: ScrapeHistoryTableProps) {
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
                                                variant={
                                                    run.status === 'success'
                                                        ? 'default'
                                                        : run.status === 'partial'
                                                            ? 'secondary'
                                                            : 'destructive'
                                                }
                                                className="text-xs flex items-center gap-1 w-fit"
                                            >
                                                <StatusIcon status={run.status} />
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
                                        <TableCell className="text-right font-mono">
                                            {run.presales || '-'}
                                        </TableCell>
                                        <TableCell className="text-xs text-muted-foreground">
                                            {prevRun && (
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
    );
}
