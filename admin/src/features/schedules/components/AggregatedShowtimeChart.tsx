"use client";

import { useMemo } from "react";
import { MovieSchedule } from "../types";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, CartesianGrid } from "recharts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

interface AggregatedShowtimeChartProps {
    movies: MovieSchedule[];
}

export function AggregatedShowtimeChart({ movies }: AggregatedShowtimeChartProps) {
    const { data, totalShowtimes } = useMemo(() => {
        // Re-initializing with 5 min intervals to match existing style
        const bucketMap = new Map<string, number>();
        for (let h = 9; h <= 23; h++) {
            for (let m = 0; m < 60; m += 5) {
                const timeStr = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
                bucketMap.set(timeStr, 0);
            }
        }

        let total = 0;

        movies.forEach(movie => {
            if (!movie.cities) return;
            Object.values(movie.cities).forEach(theatres => {
                theatres.forEach(theatre => {
                    theatre.rooms.forEach(room => {
                        (room.all_showtimes || []).forEach(show => {
                            if (!show.time) return;
                            const [hStr, mStr] = show.time.split(':');
                            const h = parseInt(hStr, 10);
                            const m = parseInt(mStr, 10);

                            // Filter valid times within our range
                            if (!isNaN(h) && !isNaN(m)) {
                                if (h >= 9 && h <= 23) {
                                    const mRounded = Math.floor(m / 5) * 5;
                                    const bucketKey = `${h.toString().padStart(2, '0')}:${mRounded.toString().padStart(2, '0')}`;
                                    if (bucketMap.has(bucketKey)) {
                                        bucketMap.set(bucketKey, (bucketMap.get(bucketKey) || 0) + 1);
                                        total++;
                                    }
                                }
                            }
                        });
                    });
                });
            });
        });

        const formattedData = Array.from(bucketMap.entries()).map(([time, count]) => ({
            time,
            count
        }));

        return { data: formattedData, totalShowtimes: total };
    }, [movies]);

    if (totalShowtimes === 0) return null;

    const maxCount = Math.max(...data.map(d => d.count), 1);

    return (
        <Card className="col-span-1">
            <CardHeader className="pb-2">
                <CardTitle className="text-base font-medium">Global Showtime Distribution</CardTitle>
                <CardDescription>
                    Aggregated volume across all {movies.length} movies ({totalShowtimes} showtimes)
                </CardDescription>
            </CardHeader>
            <CardContent>
                <div className="h-[200px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={data} margin={{ top: 10, right: 0, left: 0, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#333" opacity={0.2} />
                            <XAxis
                                dataKey="time"
                                tick={{ fontSize: 10 }}
                                interval={23} // Show rough hourly ticks (12 * 5min = 60min)
                                stroke="#888888"
                                minTickGap={30}
                            />
                            <YAxis
                                tick={{ fontSize: 10 }}
                                stroke="#888888"
                                allowDecimals={false}
                                width={30}
                            />
                            <Tooltip
                                contentStyle={{
                                    backgroundColor: 'hsl(var(--popover))',
                                    borderRadius: '6px',
                                    border: '1px solid hsl(var(--border))',
                                    fontSize: '12px'
                                }}
                                itemStyle={{ color: 'hsl(var(--popover-foreground))' }}
                                cursor={{ fill: 'hsl(var(--muted)/0.2)' }}
                                labelStyle={{ color: 'hsl(var(--muted-foreground))' }}
                            />
                            <Bar dataKey="count" radius={[2, 2, 0, 0]} maxBarSize={40}>
                                {data.map((entry, index) => (
                                    <Cell
                                        key={`cell-${index}`}
                                        fill={entry.count > maxCount * 0.8 ? "hsl(var(--primary))" : "hsl(var(--primary)/0.6)"}
                                    />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </CardContent>
        </Card>
    );
}
