"use client";

import { useState } from "react";
import { format } from "date-fns";
import useSWR from "swr";
import { DateNavigator } from "@/features/schedules/components/DateNavigator";
import { ScheduleStats } from "@/features/schedules/components/ScheduleStats";
import { MovieScheduleList } from "@/features/schedules/components/MovieScheduleList";
import { ScheduleResponse, countMovieShowtimes, countAvailableMovieShowtimes } from "@/features/schedules/types";
import { Loader2, AlertCircle, CheckCircle2, Zap } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { AggregatedShowtimeChart } from "@/features/schedules/components/AggregatedShowtimeChart";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function SchedulesV2Page() {
    const [date, setDate] = useState<Date>(new Date());
    const dateStr = format(date, "yyyy-MM-dd");

    const { data, error, isLoading } = useSWR<ScheduleResponse>(
        `/api/schedules_v2?date=${dateStr}`,
        fetcher
    );

    // Calculate aggregated stats
    const totalMovies = data?.movies?.length || 0;
    let totalShowtimes = 0;
    let totalAvailableShowtimes = 0;
    let totalTheatres = 0;

    // Process movies: Deduplicate and Sort
    let processedMovies = data?.movies ? [...data.movies] : [];

    if (processedMovies.length > 0) {
        // 1. Calculate stats (on original data is fine, but cleaner to do here)
        processedMovies.forEach(m => {
            if (!m.cities) return;
            totalShowtimes += countMovieShowtimes(m.cities);
            totalAvailableShowtimes += countAvailableMovieShowtimes(m.cities);
            Object.values(m.cities).forEach(theatres => {
                totalTheatres += theatres.length;
            });
        });

        // 2. Deduplicate by movie_id
        const uniqueMovies = new Map();
        processedMovies.forEach(m => {
            if (!uniqueMovies.has(m.movie_id)) {
                uniqueMovies.set(m.movie_id, m);
            }
        });
        processedMovies = Array.from(uniqueMovies.values());

        // 3. Sort by showtime count (descending)
        processedMovies.sort((a, b) => {
            const countA = a.cities ? countMovieShowtimes(a.cities) : 0;
            const countB = b.cities ? countMovieShowtimes(b.cities) : 0;
            return countB - countA;
        });
    }

    return (
        <div className="min-h-screen bg-background text-foreground flex flex-col">
            <div className="w-full flex-1 flex flex-col">
                <DateNavigator date={date} setDate={setDate} isLoading={isLoading} />

                <div className="flex-1 p-6 space-y-6 w-full">
                    <div className="flex items-center justify-between">
                        <div>
                            <div className="flex items-center gap-3">
                                <h1 className="text-2xl font-bold tracking-tight">Showtime Intelligence V2</h1>
                                <Badge variant="default" className="bg-green-600">
                                    <Zap className="h-3 w-3 mr-1" />
                                    API Only
                                </Badge>
                            </div>
                            <p className="text-muted-foreground">
                                Pure HTTP API scraper - excludes presale/upcoming movies
                            </p>
                        </div>
                        {isLoading && <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />}
                    </div>

                    {/* V2 Info Card */}
                    <Card className="border-green-200 bg-green-50 dark:bg-green-950 dark:border-green-800">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium flex items-center gap-2 text-green-700 dark:text-green-400">
                                <CheckCircle2 className="h-4 w-4" />
                                V2 Scraper Improvements
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="text-sm text-green-600 dark:text-green-300">
                            <ul className="list-disc list-inside space-y-1">
                                <li>No Playwright dependency - pure HTTP API calls</li>
                                <li>Checks <code className="bg-green-100 dark:bg-green-900 px-1 rounded">is_any_schedule</code> before fetching showtimes</li>
                                <li>Excludes presale/upcoming movies with no shows today</li>
                                <li>Per-city schedule checking for accurate filtering</li>
                            </ul>
                        </CardContent>
                    </Card>

                    {error && (
                        <Alert variant="destructive">
                            <AlertCircle className="h-4 w-4" />
                            <AlertTitle>Error</AlertTitle>
                            <AlertDescription>
                                Failed to load schedules: {String(error)}
                            </AlertDescription>
                        </Alert>
                    )}

                    {!error && (
                        <>
                            <ScheduleStats
                                totalMovies={totalMovies}
                                totalShowtimes={totalShowtimes}
                                totalAvailableShowtimes={totalAvailableShowtimes}
                                totalTheatres={totalTheatres}
                            />

                            {processedMovies.length > 0 && (
                                <AggregatedShowtimeChart movies={processedMovies} />
                            )}

                            <MovieScheduleList
                                movies={processedMovies}
                                isLoading={isLoading}
                            />
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
