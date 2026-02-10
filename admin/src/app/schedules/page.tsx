"use client";

import { useState } from "react";
import { format } from "date-fns";
import useSWR from "swr";
import { DateNavigator } from "@/features/schedules/components/DateNavigator";
import { ScheduleStats } from "@/features/schedules/components/ScheduleStats";
import { MovieScheduleList } from "@/features/schedules/components/MovieScheduleList";
import { ScheduleResponse, countMovieShowtimes } from "@/features/schedules/types";
import { Loader2, AlertCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function SchedulesPage() {
    const [date, setDate] = useState<Date>(new Date());
    const dateStr = format(date, "yyyy-MM-dd");

    const { data, error, isLoading } = useSWR<ScheduleResponse>(
        `/api/schedules?date=${dateStr}`,
        fetcher
    );

    // Calculate aggregated stats
    const totalMovies = data?.movies?.length || 0;
    let totalShowtimes = 0;
    let totalTheatres = 0;

    if (data?.movies) {
        data.movies.forEach(m => {
            if (!m.cities) return;
            totalShowtimes += countMovieShowtimes(m.cities);
            Object.values(m.cities).forEach(theatres => {
                totalTheatres += theatres.length;
            });
        });
    }

    return (
        <div className="min-h-screen bg-background text-foreground flex flex-col">
            <DateNavigator date={date} setDate={setDate} isLoading={isLoading} />

            <div className="flex-1 p-6 space-y-6 max-w-7xl mx-auto w-full">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">Showtime Intelligence</h1>
                        <p className="text-muted-foreground">
                            Daily schedule coverage and analysis
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
                            totalTheatres={totalTheatres}
                        />

                        <MovieScheduleList
                            movies={data?.movies || []}
                            isLoading={isLoading}
                        />
                    </>
                )}
            </div>
        </div>
    );
}
