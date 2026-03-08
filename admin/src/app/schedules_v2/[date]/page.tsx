/**
 * Schedules V2 - Date Route
 * 
 * Validates the V2 collection which uses metadata_id as document ID.
 * This allows comparison with V1 (schedule_id-based) collection.
 *
 * URL format: /schedules_v2/2026-03-09
 */
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { format, parse } from "date-fns";
import useSWR from "swr";
import { DateNavigator } from "@/features/schedules/components/DateNavigator";
import { Loader2, AlertCircle, CheckCircle, XCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface MovieScheduleV2 {
    metadata_id: string;
    schedule_ids: string[];
    title: string;
    poster?: string;
    genres?: string[];
    age_category?: string;
    merchants?: string[];
    is_presale?: boolean;
    cities?: Record<string, unknown[]>;
    date: string;
    uploaded_at: string;
    source: string;
}

interface ScheduleV2Response {
    success: boolean;
    date: string;
    count: number;
    movies: MovieScheduleV2[];
    v1_count?: number;
    comparison?: {
        v2_only: number;
        v1_only: number;
        both: number;
    };
}

const fetcher = (url: string) => fetch(url).then((res) => res.json());

// Get today's date in Jakarta timezone (YYYY-MM-DD)
function getTodayJakarta(): string {
    return new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Jakarta" });
}

// Validate date format YYYY-MM-DD
function isValidDateFormat(dateStr: string): boolean {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false;
    const date = parse(dateStr, "yyyy-MM-dd", new Date());
    return !isNaN(date.getTime());
}

interface PageProps {
    params: Promise<{ date: string }>;
}

export default function SchedulesV2DatePage({ params }: PageProps) {
    const router = useRouter();
    const [resolvedParams, setResolvedParams] = useState<{ date: string } | null>(null);

    // Unwrap params promise
    useEffect(() => {
        params.then(setResolvedParams);
    }, [params]);

    // Get date from URL or default to today
    const routeDate = resolvedParams?.date || "";

    // Validate and normalize date
    const selectedDate = isValidDateFormat(routeDate) ? routeDate : getTodayJakarta();
    const dateObj = parse(selectedDate, "yyyy-MM-dd", new Date());

    // Fetch V2 data with comparison
    const { data, error, isLoading } = useSWR<ScheduleV2Response>(
        `/api/schedules_v2?date=${selectedDate}&compare=true`,
        fetcher
    );

    // Redirect invalid dates to today
    useEffect(() => {
        if (resolvedParams && !isValidDateFormat(routeDate)) {
            router.replace(`/schedules_v2/${getTodayJakarta()}`);
        }
    }, [resolvedParams, routeDate, router]);

    // Date navigation handler - updates URL
    const handleDateChange = (newDate: Date) => {
        const dateStr = format(newDate, "yyyy-MM-dd");
        router.push(`/schedules_v2/${dateStr}`);
    };

    // Show loading while resolving params
    if (!resolvedParams) {
        return (
            <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background text-foreground flex flex-col">
            <div className="w-full flex-1 flex flex-col">
                <DateNavigator
                    date={dateObj}
                    setDate={handleDateChange}
                    isLoading={isLoading}
                />

                <div className="flex-1 p-6 space-y-6 w-full">
                    <div className="flex items-center justify-between">
                        <div>
                            <div className="flex items-center gap-2">
                                <h1 className="text-2xl font-bold tracking-tight">Schedules V2</h1>
                                <Badge variant="outline">Beta</Badge>
                            </div>
                            <p className="text-muted-foreground">
                                Metadata ID-based collection for {selectedDate}
                            </p>
                        </div>
                        {isLoading && <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />}
                    </div>

                    {error && (
                        <Alert variant="destructive">
                            <AlertCircle className="h-4 w-4" />
                            <AlertTitle>Error</AlertTitle>
                            <AlertDescription>
                                Failed to load V2 schedules: {String(error)}
                            </AlertDescription>
                        </Alert>
                    )}

                    {!error && data && (
                        <>
                            {/* Comparison Stats */}
                            {data.comparison && (
                                <Card>
                                    <CardHeader>
                                        <CardTitle>V1 vs V2 Comparison</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="grid grid-cols-3 gap-4 text-center">
                                            <div>
                                                <div className="text-2xl font-bold text-green-500">{data.comparison.both}</div>
                                                <div className="text-sm text-muted-foreground">In Both</div>
                                            </div>
                                            <div>
                                                <div className="text-2xl font-bold text-blue-500">{data.comparison.v2_only}</div>
                                                <div className="text-sm text-muted-foreground">V2 Only</div>
                                            </div>
                                            <div>
                                                <div className="text-2xl font-bold text-orange-500">{data.comparison.v1_only}</div>
                                                <div className="text-sm text-muted-foreground">V1 Only</div>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            )}

                            {/* Summary Stats */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <Card>
                                    <CardContent className="pt-6">
                                        <div className="text-2xl font-bold">{data.count}</div>
                                        <div className="text-sm text-muted-foreground">V2 Movies</div>
                                    </CardContent>
                                </Card>
                                <Card>
                                    <CardContent className="pt-6">
                                        <div className="text-2xl font-bold">{data.v1_count || "-"}</div>
                                        <div className="text-sm text-muted-foreground">V1 Movies</div>
                                    </CardContent>
                                </Card>
                                <Card>
                                    <CardContent className="pt-6">
                                        <div className="text-2xl font-bold">
                                            {data.movies.reduce((sum, m) => sum + (m.schedule_ids?.length || 0), 0)}
                                        </div>
                                        <div className="text-sm text-muted-foreground">Total Schedule IDs</div>
                                    </CardContent>
                                </Card>
                                <Card>
                                    <CardContent className="pt-6">
                                        <div className="text-2xl font-bold">
                                            {data.movies.filter(m => m.schedule_ids && m.schedule_ids.length > 1).length}
                                        </div>
                                        <div className="text-sm text-muted-foreground">Multi-Chain Movies</div>
                                    </CardContent>
                                </Card>
                            </div>

                            {/* Movie List */}
                            <Card>
                                <CardHeader>
                                    <CardTitle>V2 Movies (by metadata_id)</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="space-y-2">
                                        {data.movies.slice(0, 20).map((movie) => (
                                            <div
                                                key={movie.metadata_id}
                                                className="flex items-center justify-between p-3 rounded-lg border"
                                            >
                                                <div className="flex items-center gap-3">
                                                    {movie.poster && (
                                                        <img
                                                            src={movie.poster}
                                                            alt={movie.title}
                                                            className="w-10 h-14 object-cover rounded"
                                                        />
                                                    )}
                                                    <div>
                                                        <div className="font-medium">{movie.title}</div>
                                                        <div className="text-xs text-muted-foreground font-mono">
                                                            {movie.metadata_id}
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    {movie.schedule_ids && movie.schedule_ids.length > 1 && (
                                                        <Badge variant="secondary">
                                                            {movie.schedule_ids.length} chains
                                                        </Badge>
                                                    )}
                                                    {movie.is_presale && (
                                                        <Badge variant="outline">Presale</Badge>
                                                    )}
                                                    <CheckCircle className="h-4 w-4 text-green-500" />
                                                </div>
                                            </div>
                                        ))}
                                        {data.movies.length > 20 && (
                                            <div className="text-center text-sm text-muted-foreground pt-4">
                                                ... and {data.movies.length - 20} more movies
                                            </div>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
