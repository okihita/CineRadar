'use client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
    LineChart,
    Line,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Legend
} from 'recharts';

import { DailyPerformance } from '../types/performance';

interface PerformanceTrendChartsProps {
    history: DailyPerformance[];
}

// Custom tooltip for charts
const CustomTooltip = ({ active, payload, label }: { active?: boolean, payload?: { color: string, name: string, value: number | string }[], label?: string }) => {
    if (active && payload && payload.length) {
        return (
            <div className="bg-background border rounded-lg shadow-lg p-3 text-sm">
                <p className="font-semibold mb-2">{label}</p>
                {payload.map((entry, index) => (
                    <div key={index} className="flex items-center gap-2">
                        <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: entry.color }}
                        />
                        <span className="text-muted-foreground">{entry.name}:</span>
                        <span className="font-mono font-medium">
                            {entry.name.includes('Occupancy')
                                ? `${Number(entry.value).toFixed(1)}%`
                                : Number(entry.value).toLocaleString()}
                        </span>
                    </div>
                ))}
            </div>
        );
    }
    return null;
};

export function PerformanceTrendCharts({ history }: PerformanceTrendChartsProps) {
    if (history.length < 2) return null; // Need at least 2 points for a meaningful trend

    // Recharts expects data to be sorted chronologically for line charts (left to right)
    // Assuming history is from newest to oldest based on typical API responses, we reverse it
    const chartData = [...history].reverse().map(day => ({
        ...day,
        // Shorten date for X-axis (e.g. "2026-02-23" -> "02-23")
        shortDate: day.date.substring(5),
    }));

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
            <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="text-base font-semibold">Average Occupancy Trend</CardTitle>
                    <CardDescription>Daily seat fill rate percentage</CardDescription>
                </CardHeader>
                <CardContent className="h-[250px] w-full pb-4">
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={chartData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                            <XAxis
                                dataKey="shortDate"
                                axisLine={false}
                                tickLine={false}
                                tick={{ fontSize: 12, fill: 'var(--muted-foreground)' }}
                                dy={10}
                            />
                            <YAxis
                                axisLine={false}
                                tickLine={false}
                                tick={{ fontSize: 12, fill: 'var(--muted-foreground)' }}
                                domain={[0, 100]}
                                tickFormatter={(value) => `${value}%`}
                            />
                            <Tooltip content={<CustomTooltip />} />
                            <Line
                                type="monotone"
                                name="Occupancy"
                                dataKey="avg_occupancy_pct"
                                stroke="var(--primary)"
                                strokeWidth={3}
                                dot={{ fill: "var(--primary)", strokeWidth: 2, r: 4 }}
                                activeDot={{ r: 6, strokeWidth: 0 }}
                            />
                        </LineChart>
                    </ResponsiveContainer>
                </CardContent>
            </Card>

            <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="text-base font-semibold">Volume Trend</CardTitle>
                    <CardDescription>Tickets sold vs Available capacity</CardDescription>
                </CardHeader>
                <CardContent className="h-[250px] w-full pb-4">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                            <XAxis
                                dataKey="shortDate"
                                axisLine={false}
                                tickLine={false}
                                tick={{ fontSize: 12, fill: 'var(--muted-foreground)' }}
                                dy={10}
                            />
                            <YAxis
                                axisLine={false}
                                tickLine={false}
                                tick={{ fontSize: 12, fill: 'var(--muted-foreground)' }}
                                tickFormatter={(value) => value > 999 ? `${(value / 1000).toFixed(0)}k` : value}
                            />
                            <Tooltip content={<CustomTooltip />} />
                            <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                            <Bar
                                name="Available Capacity"
                                dataKey="total_seats"
                                fill="var(--chart-2)"
                                radius={[4, 4, 0, 0]}
                                barSize={20}
                            />
                            <Bar
                                name="Tickets Sold"
                                dataKey="total_sold"
                                fill="var(--primary)"
                                radius={[4, 4, 0, 0]}
                                barSize={20}
                            />
                        </BarChart>
                    </ResponsiveContainer>
                </CardContent>
            </Card>
        </div>
    );
}
