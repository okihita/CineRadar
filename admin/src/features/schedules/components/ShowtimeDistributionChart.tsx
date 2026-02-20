"use client";

import { useMemo } from "react";
import { CitySchedule } from "../types";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

interface ShowtimeDistributionChartProps {
    cityData: CitySchedule;
}

export function ShowtimeDistributionChart({ cityData }: ShowtimeDistributionChartProps) {
    const data = useMemo(() => {
        const buckets = new Map<string, { available: number; unavailable: number }>();

        // Initialize buckets from 10:00 to 23:00 in 5-minute intervals
        for (let h = 10; h <= 23; h++) {
            for (let m = 0; m < 60; m += 5) {
                const timeStr = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
                buckets.set(timeStr, { available: 0, unavailable: 0 });
            }
        }

        // Fill buckets with actual showtime data
        Object.values(cityData || {}).forEach(theatres => {
            theatres.forEach(theatre => {
                theatre.rooms.forEach(room => {
                    (room.all_showtimes || []).forEach(show => {
                        if (!show.time) return;
                        const [hStr, mStr] = show.time.split(':');
                        const h = parseInt(hStr, 10);
                        const m = parseInt(mStr, 10);
                        if (!isNaN(h) && !isNaN(m) && h >= 10 && h <= 23) {
                            const mRounded = Math.floor(m / 5) * 5;
                            const bucketKey = `${h.toString().padStart(2, '0')}:${mRounded.toString().padStart(2, '0')}`;
                            const bucket = buckets.get(bucketKey);
                            if (bucket) {
                                if (show.is_available) {
                                    bucket.available++;
                                } else {
                                    bucket.unavailable++;
                                }
                            }
                        }
                    });
                });
            });
        });

        // Return all buckets (including zeros) to maintain consistent x-axis
        return Array.from(buckets.entries()).map(([time, counts]) => ({
            time,
            available: counts.available,
            unavailable: counts.unavailable,
            total: counts.available + counts.unavailable
        }));
    }, [cityData]);

    if (data.length === 0) return null;

    return (
        <div>
            <div className="flex justify-between items-center mb-2">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Showtime Distribution (10am - 11pm)
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
            <div className="h-[120px]">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data}>
                        <XAxis
                            dataKey="time"
                            tick={{ fontSize: 10 }}
                            interval={Math.floor(data.length / 8)}
                            stroke="hsl(var(--muted-foreground))"
                            tickLine={false}
                            axisLine={false}
                        />
                        <YAxis
                            tick={{ fontSize: 10 }}
                            width={28}
                            stroke="hsl(var(--muted-foreground))"
                            allowDecimals={false}
                            tickLine={false}
                            axisLine={false}
                        />
                        <Tooltip
                            contentStyle={{
                                backgroundColor: 'hsl(var(--popover))',
                                borderRadius: '4px',
                                border: '1px solid hsl(var(--border))',
                                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.05)',
                                fontSize: '11px',
                                padding: '6px 10px'
                            }}
                            itemStyle={{ color: 'hsl(var(--popover-foreground))', padding: '1px 0' }}
                            cursor={{ fill: 'hsl(var(--muted))' }}
                            labelStyle={{ color: 'hsl(var(--muted-foreground))', marginBottom: '2px', fontWeight: 500 }}
                            formatter={(value: number, name: string) => [value, name === 'available' ? 'Available' : 'Closed']}
                        />
                        <Bar dataKey="available" stackId="a" fill="hsl(var(--primary))" radius={[0, 0, 0, 0]} />
                        <Bar dataKey="unavailable" stackId="a" fill="hsl(var(--muted-foreground))" opacity={0.2} radius={[2, 2, 0, 0]} />
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}
