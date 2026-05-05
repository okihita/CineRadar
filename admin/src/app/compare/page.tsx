'use client';

import { useMemo, Suspense } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import useSWR from 'swr';
import { PageHeader } from '@/components/PageHeader';
import { Loader2, AlertCircle } from 'lucide-react';
import { format, subDays, parseISO } from 'date-fns';
import { DateRange } from 'react-day-picker';
import { fetcher } from '@/lib/api';
import { Movie, TrendingMovie, CHART_COLORS, abbreviateTitle, CompareSummaryMetrics, CompareMovieDayData, CompareMovieMeta, CompareChartDataItem } from '@/features/compare/types';
import { CompareControlPanel } from '@/features/compare/components/CompareControlPanel';
import { SummaryMetricsCards } from '@/features/compare/components/SummaryMetricsCards';
import { ShareDistributionCharts } from '@/features/compare/components/ShareDistributionCharts';
import { PerformanceTimelines } from '@/features/compare/components/PerformanceTimelines';
import { DayByDayTable } from '@/features/compare/components/DayByDayTable';
import { TrendingGrid } from '@/features/compare/components/TrendingGrid';

function CompareDashboard() {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();

    // URL State
    const urlMovies = searchParams.get('m');
    const selectedMovieIds = useMemo(() => urlMovies ? urlMovies.split(',') : [], [urlMovies]);
    const urlColors = searchParams.get('c');

    const startDateStr = searchParams.get('start');
    const endDateStr = searchParams.get('end');

    // Map of movieId -> hex color
    const movieColorsMap = useMemo(() => {
        const colors = urlColors ? urlColors.split(',') : [];
        const map: Record<string, string> = {};
        selectedMovieIds.forEach((id, index) => {
            map[id] = colors[index] ? `#${colors[index]}` : CHART_COLORS[index % CHART_COLORS.length];
        });
        return map;
    }, [selectedMovieIds, urlColors]);

    // Initialize date range from URL or default to last 7 days
    const dateRange = useMemo<DateRange>(() => {
        const end = endDateStr ? parseISO(endDateStr) : new Date();
        const start = startDateStr ? parseISO(startDateStr) : subDays(end, 7);
        return { from: start, to: end };
    }, [startDateStr, endDateStr]);

    // Fetch comparison data if movies selected
    const compareUrl = selectedMovieIds.length > 0
        ? `/api/compare?movies=${selectedMovieIds.join(',')}${dateRange.from ? `&startDate=${format(dateRange.from, 'yyyy-MM-dd')}` : ''}${dateRange.to ? `&endDate=${format(dateRange.to, 'yyyy-MM-dd')}` : ''}`
        : null;

    const { data: compareData, isLoading, isValidating, error: compareError } = useSWR<{
        data: Record<string, CompareMovieDayData | string>[];
        movies?: Record<string, CompareMovieMeta>;
    }>(compareUrl, fetcher);
    const isComparing = (isLoading || isValidating) && !compareData;
    const safeCompareData = compareData ?? null;

    // Fetch trending market leaders (only if no movies are selected)
    const { data: trendingData, isLoading: isLoadingTrending, error: trendingError } = useSWR(
        selectedMovieIds.length === 0 ? '/api/performance' : null,
        fetcher,
        { revalidateOnFocus: false }
    );

    const trendingMovies: TrendingMovie[] = useMemo(() => {
        if (!trendingData?.data?.movies) return [];
        return trendingData.data.movies.slice(0, 8);
    }, [trendingData]);

    // Calculate Summary Metrics
    const summaryMetrics = useMemo(() => {
        if (!compareData || !compareData.data) return {};

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const metrics: Record<string, CompareSummaryMetrics> = {};

        selectedMovieIds.forEach(id => {
            let totalAdmissions = 0;
            let totalShowtimes = 0;
            let totalSeats = 0;

            compareData.data.forEach((day: Record<string, CompareMovieDayData | string>) => {
                const dayData = day[id] as CompareMovieDayData | undefined;
                if (dayData) {
                    totalAdmissions += dayData.admissions || 0;
                    totalShowtimes += dayData.showtimes || 0;
                    totalSeats += dayData.total_seats || 0;
                }
            });

            metrics[id] = {
                totalAdmissions,
                totalShowtimes,
                avgOccupancy: totalSeats > 0 ? (totalAdmissions / totalSeats) * 100 : 0,
                admissionsPerShowtime: totalShowtimes > 0 ? totalAdmissions / totalShowtimes : 0
            };
        });

        return metrics;
    }, [compareData, selectedMovieIds]);

    // Prepare Chart Data
    const chartData = useMemo(() => {
        if (!compareData || !compareData.data) return [];

        return compareData.data.map((day: Record<string, CompareMovieDayData | string>) => {
            const formattedDay: CompareChartDataItem = { date: day.date as string };

            selectedMovieIds.forEach(id => {
                const dayData = day[id] as CompareMovieDayData | undefined;
                if (dayData) {
                    formattedDay[`${id}_admissions`] = dayData.admissions;
                    formattedDay[`${id}_showtimes`] = dayData.showtimes;
                    formattedDay[`${id}_occupancy`] = dayData.occupancy;
                }
            });

            return formattedDay;
        });
    }, [compareData, selectedMovieIds]);

    const pieData = useMemo(() => {
        if (!summaryMetrics || selectedMovieIds.length === 0) return { admissions: [], showtimes: [] };

        const admissions = selectedMovieIds.map(id => ({
            name: abbreviateTitle(compareData?.movies?.[id]?.title || id),
            value: summaryMetrics[id]?.totalAdmissions || 0,
            color: movieColorsMap[id]
        })).filter(d => d.value > 0);

        const showtimes = selectedMovieIds.map(id => ({
            name: abbreviateTitle(compareData?.movies?.[id]?.title || id),
            value: summaryMetrics[id]?.totalShowtimes || 0,
            color: movieColorsMap[id]
        })).filter(d => d.value > 0);

        return { admissions, showtimes };
    }, [summaryMetrics, selectedMovieIds, compareData, movieColorsMap]);

    // Derived selected movies details (for table headers — needs movie list from control panel)
    const selectedMoviesDetails: Movie[] = useMemo(() => {
        return selectedMovieIds.map(id => ({ id, title: `Movie ${id}`, poster: '' }));
    }, [selectedMovieIds]);

    // URL update handler
    const updateUrl = (newIds: string[], range?: DateRange, customColorsMap?: Record<string, string>) => {
        const params = new URLSearchParams(searchParams.toString());

        if (newIds.length > 0) {
            params.set('m', newIds.join(','));

            const colorsArray = newIds.map(id => {
                const color = customColorsMap ? customColorsMap[id] : movieColorsMap[id];
                return color ? color.replace('#', '') : CHART_COLORS[newIds.indexOf(id) % CHART_COLORS.length].replace('#', '');
            });
            params.set('c', colorsArray.join(','));
        } else {
            params.delete('m');
            params.delete('c');
        }

        if (range?.from) params.set('start', format(range.from, 'yyyy-MM-dd'));
        if (range?.to) params.set('end', format(range.to, 'yyyy-MM-dd'));

        const queryString = params.toString().replace(/%2C/g, ',');
        router.push(`${pathname}?${queryString}`);
    };

    const handleAddMovie = (movie: Movie | TrendingMovie) => {
        if (selectedMovieIds.length >= 8) return;
        if (selectedMovieIds.includes(movie.id)) return;
        updateUrl([...selectedMovieIds, movie.id], dateRange);
    };

    const handleRemoveMovie = (id: string) => {
        updateUrl(selectedMovieIds.filter(mId => mId !== id), dateRange);
    };

    const handleColorChange = (id: string, newColor: string) => {
        const newMap = { ...movieColorsMap, [id]: newColor };
        updateUrl(selectedMovieIds, dateRange, newMap);
    };

    const handleDateRangeChange = (range: DateRange | undefined) => {
        if (range) updateUrl(selectedMovieIds, range);
    };

    const handleCompareTop = (count: number) => {
        if (trendingMovies.length < count) return;
        const topIds = trendingMovies.slice(0, count).map((m) => m.id);
        updateUrl(topIds, dateRange);
    };

    return (
        <div className="p-6 space-y-6 max-w-[1600px] mx-auto">
            <PageHeader
                title="Head-to-Head Compare"
                description="Compare admissions and showtime performance across multiple movies."
            />

            <CompareControlPanel
                selectedMovieIds={selectedMovieIds}
                movieColorsMap={movieColorsMap}
                dateRange={dateRange}
                isLoadingTrending={isLoadingTrending}
                onAddMovie={handleAddMovie}
                onRemoveMovie={handleRemoveMovie}
                onColorChange={handleColorChange}
                onDateRangeChange={handleDateRangeChange}
                onClearAll={() => updateUrl([], dateRange)}
            />

            {selectedMovieIds.length > 0 ? (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    {compareError ? (
                        <div className="flex flex-col items-center justify-center p-24 text-red-600 gap-4 border-2 border-dashed rounded-xl bg-red-500/5">
                            <AlertCircle className="w-8 h-8" />
                            <div className="text-center">
                                <p className="font-semibold">Failed to load comparison data</p>
                                <p className="text-sm text-muted-foreground">{compareError.message}</p>
                            </div>
                        </div>
                    ) : isComparing ? (
                        <div className="flex flex-col items-center justify-center p-24 text-muted-foreground gap-4 border-2 border-dashed rounded-xl">
                            <Loader2 className="w-8 h-8 animate-spin text-primary" />
                            <div className="text-center">
                                <p className="font-semibold text-foreground">Analyzing Head-to-Head Performance</p>
                                <p className="text-sm">Fetching daily admissions, showtimes, and occupancy data...</p>
                            </div>
                        </div>
                    ) : (
                        <>
                            <SummaryMetricsCards
                                selectedMovieIds={selectedMovieIds}
                                movieColorsMap={movieColorsMap}
                                summaryMetrics={summaryMetrics}
                                compareData={safeCompareData}
                            />

                            <ShareDistributionCharts
                                admissions={pieData.admissions}
                                showtimes={pieData.showtimes}
                            />

                            <PerformanceTimelines
                                selectedMovieIds={selectedMovieIds}
                                movieColorsMap={movieColorsMap}
                                chartData={chartData}
                                compareData={safeCompareData}
                            />

                            <DayByDayTable
                                selectedMovieIds={selectedMovieIds}
                                selectedMoviesDetails={selectedMoviesDetails}
                                movieColorsMap={movieColorsMap}
                                chartData={chartData}
                            />
                        </>
                    )}
                </div>
            ) : (
                <TrendingGrid
                    trendingMovies={trendingMovies}
                    isLoading={isLoadingTrending}
                    error={trendingError}
                    onAddMovie={handleAddMovie}
                    onCompareTop={handleCompareTop}
                />
            )}
        </div>
    );
}

export default function ComparePage() {
    return (
        <Suspense fallback={<div className="p-8">Loading compare dashboard...</div>}>
            <CompareDashboard />
        </Suspense>
    );
}
