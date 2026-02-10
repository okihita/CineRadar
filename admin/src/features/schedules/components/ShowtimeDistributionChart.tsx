"use client";

import { useMemo } from "react";
import { CitySchedule } from "../types";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";

interface ShowtimeDistributionChartProps {
    cityData: CitySchedule;
}

export function ShowtimeDistributionChart({ cityData }: ShowtimeDistributionChartProps) {
    const data = useMemo(() => {
        const buckets = new Map<string, number>();

        // Initialize buckets from 10:00 to 23:00 in 5-minute intervals
        for (let h = 10; h <= 23; h++) {
            for (let m = 0; m < 60; m += 5) {
                const timeStr = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
                buckets.set(timeStr, 0);
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
                            if (buckets.has(bucketKey)) {
                                buckets.set(bucketKey, (buckets.get(bucketKey) || 0) + 1);
                            }
                        }
                    });
                });
            });
        });

        // Return all buckets (including zeros) to maintain consistent x-axis
        return Array.from(buckets.entries()).map(([time, count]) => ({
            time,
            count
        }));
    }, [cityData]);

    if (data.length === 0) return null;

    const maxCount = Math.max(...data.map(d => d.count), 1);

    return (
        <div>
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                Showtime Distribution (10am - 11pm)
            </h4>
            <div className="h-[120px]">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data}>
                        <XAxis
                            dataKey="time"
                            tick={{ fontSize: 10 }}
                            interval={Math.floor(data.length / 8)}
                            stroke="#888888"
                        />
                        <YAxis
                            tick={{ fontSize: 10 }}
                            width={28}
                            stroke="#888888"
                            allowDecimals={false}
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
                        />
                        <Bar dataKey="count" radius={[2, 2, 0, 0]}>
                            {data.map((entry, index) => (
                                <Cell
                                    key={`cell-${index}`}
                                    fill={entry.count > maxCount * 0.7 ? "hsl(var(--primary))" : "hsl(var(--primary)/0.5)"}
                                />
                            ))}
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}
