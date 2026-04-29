"use client";

import { useMemo } from "react";
import { MovieSchedule } from "../types";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
    buildEmptyBuckets,
    fillBucketsFromCities,
    tooltipContentStyle,
    tooltipItemStyle,
    tooltipLabelStyle,
    tooltipFormatter,
    xAxisTickProps,
    yAxisTickProps,
    axisStroke,
} from "../utils/chart-config";

interface AggregatedShowtimeChartProps {
    movies: MovieSchedule[];
}

export function AggregatedShowtimeChart({ movies }: AggregatedShowtimeChartProps) {
    const { data, totalShowtimes, totalAvailable } = useMemo(() => {
        const bucketMap = buildEmptyBuckets();
        let total = 0;
        let available = 0;

        for (const movie of movies) {
            const counts = fillBucketsFromCities(bucketMap, movie.cities as Record<string, unknown[]>);
            total += counts.total;
            available += counts.available;
        }

        const formattedData = Array.from(bucketMap.entries()).map(([time, counts]) => ({
            time,
            available: counts.available,
            unavailable: counts.unavailable,
        }));

        return { data: formattedData, totalShowtimes: total, totalAvailable: available };
    }, [movies]);

    if (totalShowtimes === 0) return null;

    return (
        <Card className="col-span-1 border-border/60 shadow-sm">
            <CardHeader className="pb-2">
                <div className="flex justify-between items-start">
                    <div>
                        <CardTitle className="text-base font-medium">Global Showtime Distribution</CardTitle>
                        <CardDescription>
                            Aggregated volume across all {movies.length} movies ({totalShowtimes} showtimes)
                        </CardDescription>
                    </div>
                    <div className="text-xs flex gap-3 text-muted-foreground mt-1">
                        <div className="flex items-center gap-1.5">
                            <div className="w-2.5 h-2.5 rounded-sm bg-primary"></div>
                            <span>Available ({totalAvailable.toLocaleString()})</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <div className="w-2.5 h-2.5 rounded-sm bg-muted-foreground/20"></div>
                            <span>Closed ({Math.max(0, totalShowtimes - totalAvailable).toLocaleString()})</span>
                        </div>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                <div className="h-[200px] w-full mt-2">
                    <ResponsiveContainer width="99%" height={200}>
                        <BarChart data={data} margin={{ top: 10, right: 0, left: 0, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" opacity={0.4} />
                            <XAxis
                                dataKey="time"
                                tick={xAxisTickProps}
                                interval={23}
                                stroke={axisStroke}
                                minTickGap={30}
                                tickLine={false}
                                axisLine={false}
                            />
                            <YAxis
                                tick={yAxisTickProps}
                                stroke={axisStroke}
                                allowDecimals={false}
                                width={30}
                                tickLine={false}
                                axisLine={false}
                            />
                            <Tooltip
                                contentStyle={tooltipContentStyle}
                                itemStyle={tooltipItemStyle}
                                cursor={false}
                                labelStyle={tooltipLabelStyle}
                                formatter={tooltipFormatter}
                            />
                            <Bar dataKey="available" stackId="a" fill="var(--primary)" activeBar={{ fill: 'oklch(0.55 0.2 270)' }} />
                            <Bar dataKey="unavailable" stackId="a" fill="var(--muted-foreground)" opacity={0.2} radius={[2, 2, 0, 0]} activeBar={{ fill: 'var(--muted-foreground)', opacity: 0.5 }} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </CardContent>
        </Card>
    );
}
