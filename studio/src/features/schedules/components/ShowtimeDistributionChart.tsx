"use client";

import { useMemo } from "react";
import { CitySchedule } from "../types";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
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

interface ShowtimeDistributionChartProps {
    cityData: CitySchedule;
}

export function ShowtimeDistributionChart({ cityData }: ShowtimeDistributionChartProps) {
    const data = useMemo(() => {
        const buckets = buildEmptyBuckets();
        fillBucketsFromCities(buckets, cityData as Record<string, unknown[]>);

        return Array.from(buckets.entries()).map(([time, counts]) => ({
            time,
            available: counts.available,
            unavailable: counts.unavailable,
        }));
    }, [cityData]);

    if (data.length === 0) return null;

    return (
        <div>
            <div className="flex justify-between items-center mb-2">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Showtime Distribution (9am – 11pm)
                </h4>
                <div className="text-[10px] flex gap-2 text-muted-foreground">
                    <div className="flex items-center gap-1">
                        <div className="w-2 h-2 rounded-sm bg-primary"></div>
                        <span>Available</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <div className="w-2 h-2 rounded-sm bg-muted-foreground/20"></div>
                        <span>Closed</span>
                    </div>
                </div>
            </div>
            <div className="h-[120px] w-full">
                <ResponsiveContainer width="99%" height={120}>
                    <BarChart data={data}>
                        <XAxis
                            dataKey="time"
                            tick={xAxisTickProps}
                            interval={Math.floor(data.length / 8)}
                            stroke={axisStroke}
                            tickLine={false}
                            axisLine={false}
                        />
                        <YAxis
                            tick={yAxisTickProps}
                            width={28}
                            stroke={axisStroke}
                            allowDecimals={false}
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
        </div>
    );
}
