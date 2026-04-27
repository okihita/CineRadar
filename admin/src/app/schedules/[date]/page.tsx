/**
 * Showtime Intelligence - Date Route
 * Daily schedule coverage and analysis for a specific date
 *
 * URL format: /schedules/2026-03-02
 */
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { format, parse } from "date-fns";
import useSWR from "swr";
import { DateNavigator } from "@/features/schedules/components/DateNavigator";
import { ScheduleStats } from "@/features/schedules/components/ScheduleStats";
import { MovieScheduleList } from "@/features/schedules/components/MovieScheduleList";
import { AggregatedShowtimeChart } from "@/features/schedules/components/AggregatedShowtimeChart";
import { ScheduleResponse, MovieSchedule, countMovieShowtimes, countAvailableMovieShowtimes } from "@/features/schedules/types";
import { Loader2, AlertCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

import { fetcher } from '@/lib/api';
import { getTodayJakarta, isValidDateFormat } from '@/lib/timeUtils';

interface PageProps {
    params: Promise<{ date: string }>;
}

export default function SchedulesDatePage({ params }: PageProps) {
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

    // Fetch data
    const { data, error, isLoading } = useSWR<ScheduleResponse>(
        `/api/schedules?date=${selectedDate}`,
        fetcher
    );

    // Redirect invalid dates to today
    useEffect(() => {
        if (resolvedParams && !isValidDateFormat(routeDate)) {
            router.replace(`/schedules/${getTodayJakarta()}`);
        }
    }, [resolvedParams, routeDate, router]);

    // Date navigation handler - updates URL
    const handleDateChange = (newDate: Date) => {
        const dateStr = format(newDate, "yyyy-MM-dd");
        router.push(`/schedules/${dateStr}`);
    };

    // Calculate aggregated stats
    const totalMovies = data?.movies?.length || 0;
    let totalShowtimes = 0;
    let totalAvailableShowtimes = 0;
    let totalTheatres = 0;

    // Process movies: Deduplicate and Sort
    let processedMovies: MovieSchedule[] = data?.movies ? [...data.movies] : [];

    if (processedMovies.length > 0) {
        // 1. Calculate stats
        processedMovies.forEach((m) => {
            if (!m.cities) return;
            totalShowtimes += countMovieShowtimes(m.cities);
            totalAvailableShowtimes += countAvailableMovieShowtimes(m.cities);
            Object.values(m.cities).forEach((theatres) => {
                totalTheatres += theatres.length;
            });
        });

        // 2. Deduplicate by movie_id
        const uniqueMovies = new Map<string, MovieSchedule>();
        processedMovies.forEach((m) => {
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
                            <h1 className="text-2xl font-bold tracking-tight">Showtime Intelligence</h1>
                            <p className="text-muted-foreground">
                                Daily schedule coverage and analysis for {selectedDate}
                            </p>
                        </div>
                        {isLoading && <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />}
                    </div>

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
