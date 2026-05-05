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
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

import { DailyPerformance } from '../types/performance';

interface PerformanceTrendChartsProps {
    history: DailyPerformance[];
}

// Helper to calculate percentage change
function calculateDelta(current: number, previous: number) {
    if (!previous || previous === 0) return null;
    return ((current - previous) / previous) * 100;
}

// Helper to format delta for UI
const DeltaBadge = ({ value }: { value: number | null }) => {
    if (value === null) return null;
    const isPositive = value > 0;
    const isNeutral = Math.abs(value) < 0.1;
    const Icon = isPositive ? TrendingUp : isNeutral ? Minus : TrendingDown;
    
    return (
        <span className={cn(
            "inline-flex items-center gap-0.5 text-[10px] font-bold ml-1.5 px-1 rounded-md",
            isPositive ? "text-green-500 bg-green-500/5" : isNeutral ? "text-muted-foreground bg-muted" : "text-red-500 bg-red-500/5"
        )}>
            <Icon className="w-2.5 h-2.5" />
            {Math.abs(value).toFixed(1)}%
        </span>
    );
};

// Custom tooltip for charts
const CustomTooltip = ({ active, payload, label }: { active?: boolean, payload?: any[], label?: string }) => {
    if (active && payload && payload.length) {
        return (
            <div className="bg-background/95 backdrop-blur-md border border-border/40 rounded-xl shadow-2xl p-4 min-w-[220px] animate-in fade-in zoom-in-95 duration-200">
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-3 border-b border-border/20 pb-2">{label}</p>
                <div className="space-y-3">
                    {payload.map((entry, index) => {
                        // Extract pre-calculated delta from the original data object
                        const dataKey = entry.dataKey;
                        const deltaKey = `${dataKey}_delta`;
                        const deltaValue = entry.payload[deltaKey] ?? null;

                        return (
                            <div key={index} className="flex flex-col gap-0.5">
                                <div className="flex items-center justify-between gap-6">
                                    <div className="flex items-center gap-1.5 flex-1 min-w-0">
                                        <div
                                            className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                                            style={{ backgroundColor: entry.color }}
                                        />
                                        <span className="text-[10px] font-bold uppercase tracking-tight text-muted-foreground/80 truncate">{entry.name}</span>
                                    </div>
                                    <div className="flex items-center flex-shrink-0">
                                        <span className="font-mono text-xs font-black text-foreground">
                                            {entry.name.includes('Occupancy')
                                                ? `${Number(entry.value).toFixed(1)}%`
                                                : Number(entry.value).toLocaleString()}
                                        </span>
                                    </div>
                                </div>
                                <div className="flex justify-end mt-0.5">
                                    <DeltaBadge value={deltaValue} />
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    }
    return null;
};

export function PerformanceTrendCharts({ history }: PerformanceTrendChartsProps) {
    if (history.length < 1) return null; 

    // 1. Sort history oldest to newest for chronological chart mapping
    const sortedHistory = [...history].sort((a, b) => a.date.localeCompare(b.date));

    // 2. Enrich with deltas
    const chartData = sortedHistory.map((day, i) => {
        const prevDay = i > 0 ? sortedHistory[i - 1] : null;
        
        return {
            ...day,
            shortDate: day.date.substring(5),
            // Pre-calculate deltas for all key metrics
            avg_occupancy_pct_delta: prevDay ? calculateDelta(day.avg_occupancy_pct, prevDay.avg_occupancy_pct) : null,
            total_sold_delta: prevDay ? calculateDelta(day.total_sold, prevDay.total_sold) : null,
            total_seats_delta: prevDay ? calculateDelta(day.total_seats, prevDay.total_seats) : null,
        };
    });

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
