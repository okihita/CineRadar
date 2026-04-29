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
import { DateNavigator } from "@/features/schedules/components/DateNavigator";
import { ScheduleStats } from "@/features/schedules/components/ScheduleStats";
import { MovieScheduleList } from "@/features/schedules/components/MovieScheduleList";
import { AggregatedShowtimeChart } from "@/features/schedules/components/AggregatedShowtimeChart";
import { ChainDistribution } from "@/features/schedules/components/ChainDistribution";
import { ScheduleFilterBar } from "@/features/schedules/components/ScheduleFilterBar";
import { SchedulesPageSkeleton } from "@/features/schedules/components/skeletons/SchedulesPageSkeleton";
import { useScheduleData } from "@/features/schedules/hooks/useScheduleData";
import { useScheduleFilters } from "@/features/schedules/hooks/useScheduleFilters";
import { Loader2, AlertCircle, Clock } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { formatFreshness, getLatestUpload } from "@/features/schedules/utils/schedule-helpers";

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

    // Fetch + process data via custom hook (memoized dedup, sort, stats)
    const { movies, stats, chainDistribution, error, isLoading } = useScheduleData(selectedDate);

    // Filter state
    const filters = useScheduleFilters(movies);

    // Data freshness
    const freshnessLabel = movies.length > 0 ? formatFreshness(getLatestUpload(movies)) : null;

    // Redirect invalid dates to today
    useEffect(() => {
        if (resolvedParams && !isValidDateFormat(routeDate)) {
            router.replace(`/schedules/${getTodayJakarta()}`);
        }
    }, [resolvedParams, routeDate, router]);

    // Date navigation handler
    const handleDateChange = (newDate: Date) => {
        const dateStr = format(newDate, "yyyy-MM-dd");
        router.push(`/schedules/${dateStr}`);
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
                            <h1 className="text-2xl font-bold tracking-tight">Showtime Intelligence</h1>
                            <p className="text-muted-foreground">
                                Daily schedule coverage and analysis for {selectedDate}
                            </p>
                        </div>
                        <div className="flex items-center gap-3">
                            {freshnessLabel && (
                                <span className="flex items-center gap-1.5 text-[10px] font-medium text-muted-foreground bg-muted/50 px-2 py-1 rounded-md border border-border/50">
                                    <Clock className="h-3 w-3" />
                                    Updated {freshnessLabel}
                                </span>
                            )}
                            {isLoading && <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />}
                        </div>
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

                    {!error && isLoading && (
                        <SchedulesPageSkeleton />
                    )}

                    {!error && !isLoading && (
                        <>
                            <ScheduleStats
                                totalMovies={stats.totalMovies}
                                totalShowtimes={stats.totalShowtimes}
                                totalAvailableShowtimes={stats.totalAvailableShowtimes}
                                totalTheatres={stats.totalTheatres}
                            />

                            {chainDistribution.length > 0 && (
                                <ChainDistribution chainDistribution={chainDistribution} />
                            )}

                            {movies.length > 0 && (
                                <AggregatedShowtimeChart movies={movies} />
                            )}

                            <ScheduleFilterBar
                                search={filters.search}
                                onSearchChange={filters.setSearch}
                                availableGenres={filters.availableGenres}
                                selectedGenres={filters.genres}
                                onToggleGenre={filters.toggleGenre}
                                availableChains={filters.availableChains}
                                selectedChains={filters.chains}
                                onToggleChain={filters.toggleChain}
                                presaleOnly={filters.presaleOnly}
                                onTogglePresale={() => filters.setPresaleOnly(!filters.presaleOnly)}
                                hasActiveFilters={filters.hasActiveFilters}
                                onClear={filters.clearFilters}
                                resultCount={filters.filteredMovies.length}
                                totalCount={movies.length}
                            />

                            <MovieScheduleList
                                movies={filters.filteredMovies}
                            />
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
