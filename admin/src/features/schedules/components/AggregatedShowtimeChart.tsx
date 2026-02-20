"use client";

import { useMemo } from "react";
import { MovieSchedule } from "../types";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, CartesianGrid } from "recharts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

interface AggregatedShowtimeChartProps {
    movies: MovieSchedule[];
}

export function AggregatedShowtimeChart({ movies }: AggregatedShowtimeChartProps) {
    const { data, totalShowtimes, totalAvailable } = useMemo(() => {
        // Re-initializing with 5 min intervals to match existing style
        const bucketMap = new Map<string, { available: number; unavailable: number }>();
        for (let h = 9; h <= 23; h++) {
            for (let m = 0; m < 60; m += 5) {
                const timeStr = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
                bucketMap.set(timeStr, { available: 0, unavailable: 0 });
            }
        }

        let total = 0;
        let available = 0;

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
                                    const bucket = bucketMap.get(bucketKey);
                                    if (bucket) {
                                        if (show.is_available) {
                                            bucket.available++;
                                            available++;
                                        } else {
                                            bucket.unavailable++;
                                        }
                                        total++;
                                    }
                                }
                            }
                        });
                    });
                });
            });
        });

        const formattedData = Array.from(bucketMap.entries()).map(([time, counts]) => ({
            time,
            available: counts.available,
            unavailable: counts.unavailable,
            total: counts.available + counts.unavailable
        }));

        return { data: formattedData, totalShowtimes: total, totalAvailable: available };
    }, [movies]);

    if (totalShowtimes === 0) return null;

    const maxCount = Math.max(...data.map(d => d.total), 1);

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
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={data} margin={{ top: 10, right: 0, left: 0, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" opacity={0.4} />
                            <XAxis
                                dataKey="time"
                                tick={{ fontSize: 10 }}
                                interval={23} // Show rough hourly ticks (12 * 5min = 60min)
                                stroke="hsl(var(--muted-foreground))"
                                minTickGap={30}
                                tickLine={false}
                                axisLine={false}
                            />
                            <YAxis
                                tick={{ fontSize: 10 }}
                                stroke="hsl(var(--muted-foreground))"
                                allowDecimals={false}
                                width={30}
                                tickLine={false}
                                axisLine={false}
                            />
                            <Tooltip
                                contentStyle={{
                                    backgroundColor: 'hsl(var(--popover))',
                                    borderRadius: '4px',
                                    border: '1px solid hsl(var(--border))',
                                    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.05)',
                                    fontSize: '12px',
                                    padding: '8px 12px'
                                }}
                                itemStyle={{ color: 'hsl(var(--popover-foreground))', padding: '2px 0' }}
                                cursor={{ fill: 'hsl(var(--muted))' }}
                                labelStyle={{ color: 'hsl(var(--muted-foreground))', marginBottom: '4px', fontWeight: 500 }}
                                formatter={(value: number, name: string) => [value, name === 'available' ? 'Available' : 'Closed']}
                            />
                            <Bar dataKey="available" stackId="a" fill="hsl(var(--primary))" radius={[0, 0, 0, 0]} />
                            <Bar dataKey="unavailable" stackId="a" fill="hsl(var(--muted-foreground))" opacity={0.2} radius={[2, 2, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </CardContent>
        </Card>
    );
}
