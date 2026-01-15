/**
 * Today's Scrape Status Cards component
 * Shows morning scrape and JIT summary
 */
'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle2, AlertTriangle, XCircle, Calendar, RefreshCw } from 'lucide-react';
import { formatWIBShort, formatWIBWithRelative } from '@/lib/timeUtils';
import type { MorningScrape, JITSummary } from '../types';

interface TodayScrapeCardsProps {
    morningScrape: MorningScrape | null;
    jitSummary: JITSummary | null;
}

export function TodayScrapeCards({ morningScrape, jitSummary }: TodayScrapeCardsProps) {
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            {/* Morning Scrape Status */}
            <Card>
                <CardHeader className="py-3">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <Calendar className="w-4 h-4" />
                        Today&apos;s Morning Scrape
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {morningScrape ? (
                        <div className="space-y-3">
                            <div className="flex items-center gap-2">
                                {morningScrape.status === 'success' ? (
                                    <CheckCircle2 className="w-8 h-8 text-green-500" />
                                ) : morningScrape.status === 'partial' ? (
                                    <AlertTriangle className="w-8 h-8 text-yellow-500" />
                                ) : (
                                    <XCircle className="w-8 h-8 text-red-500" />
                                )}
                                <div>
                                    <div className="font-semibold capitalize">{morningScrape.status}</div>
                                    <div className="text-xs text-muted-foreground">
                                        {formatWIBWithRelative(morningScrape.timestamp)}
                                    </div>
                                </div>
                            </div>
                            <div className="grid grid-cols-3 gap-2 text-center">
                                <div className="p-2 bg-muted/50 rounded">
                                    <div className="font-bold">{morningScrape.movies}</div>
                                    <div className="text-xs text-muted-foreground">Movies</div>
                                </div>
                                <div className="p-2 bg-muted/50 rounded">
                                    <div className="font-bold">{morningScrape.cities}</div>
                                    <div className="text-xs text-muted-foreground">Cities</div>
                                </div>
                                <div className="p-2 bg-muted/50 rounded">
                                    <div className="font-bold">{morningScrape.theatres}</div>
                                    <div className="text-xs text-muted-foreground">Theatres</div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="text-center py-4 text-muted-foreground">
                            <AlertTriangle className="w-8 h-8 mx-auto mb-2 opacity-50" />
                            <div>No morning scrape today yet</div>
                            <div className="text-xs">Scheduled for 6:00 AM WIB</div>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* JIT Summary */}
            <Card>
                <CardHeader className="py-3">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <RefreshCw className="w-4 h-4" />
                        Today&apos;s JIT Seat Scraper
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {jitSummary ? (
                        <div className="space-y-3">
                            <div className="flex items-center gap-2">
                                <CheckCircle2 className="w-8 h-8 text-blue-500" />
                                <div>
                                    <div className="font-semibold">{jitSummary.totalRuns} runs today</div>
                                    <div className="text-xs text-muted-foreground">
                                        Last: {formatWIBWithRelative(jitSummary.lastRun)}
                                    </div>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-center">
                                <div className="p-2 bg-muted/50 rounded">
                                    <div className="font-bold">{jitSummary.totalShowtimes}</div>
                                    <div className="text-xs text-muted-foreground">Total Showtimes</div>
                                </div>
                                <div className="p-2 bg-muted/50 rounded">
                                    <div className="font-bold text-green-600">{jitSummary.successfulShowtimes}</div>
                                    <div className="text-xs text-muted-foreground">Successful</div>
                                </div>
                            </div>
                            <div className="text-xs text-muted-foreground text-center">
                                First run: {formatWIBShort(jitSummary.firstRun)}
                            </div>
                        </div>
                    ) : (
                        <div className="text-center py-4 text-muted-foreground">
                            <RefreshCw className="w-8 h-8 mx-auto mb-2 opacity-50" />
                            <div>No JIT scrapes today yet</div>
                            <div className="text-xs">Runs every 15 min (9 AM - 11 PM WIB)</div>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
