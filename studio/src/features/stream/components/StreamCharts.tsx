'use client';

import { useState, useMemo } from 'react';
import {
    ResponsiveContainer,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    Tooltip as RechartsTooltip,
    Cell,
} from 'recharts';
import { Ticket, Users } from 'lucide-react';
import { StreamMovieItem } from '../types';
import { getPerformanceTier } from '@/lib/constants';

interface StreamChartsProps {
    movies: StreamMovieItem[];
}

interface CustomTooltipProps {
    active?: boolean;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    payload?: any[];
    metricType: 'showtimes' | 'sales';
}

function CustomChartTooltip({ active, payload, metricType }: CustomTooltipProps) {
    if (active && payload && payload.length) {
        const item = payload[0].payload as StreamMovieItem;
        return (
            <div className="bg-popover text-popover-foreground border border-border p-3 rounded-xl shadow-xl font-mono text-sm max-w-xs">
                <p className="font-bold text-base mb-1 truncate text-foreground">{item.title}</p>
                <div className="space-y-1">
                    <div className="flex items-center justify-between gap-4">
                        <span className="text-muted-foreground">Rank:</span>
                        <span className="font-black text-foreground">#{item.rank}</span>
                    </div>
                    {metricType === 'showtimes' ? (
                        <>
                            <div className="flex items-center justify-between gap-4">
                                <span className="text-muted-foreground">Showtimes:</span>
                                <span className="font-bold text-primary">{item.showtimes.toLocaleString()}</span>
                            </div>
                            <div className="flex items-center justify-between gap-4">
                                <span className="text-muted-foreground">Market Share:</span>
                                <span className="font-bold text-foreground">{item.showtimeSharePct}%</span>
                            </div>
                        </>
                    ) : (
                        <>
                            <div className="flex items-center justify-between gap-4">
                                <span className="text-muted-foreground">Audience Sold:</span>
                                <span className="font-bold text-emerald-500">
                                    {item.estimatedAdmissions > 0 ? item.estimatedAdmissions.toLocaleString() : 'Pending JIT'}
                                </span>
                            </div>
                            <div className="flex items-center justify-between gap-4">
                                <span className="text-muted-foreground">Occupancy Rate:</span>
                                <span className="font-bold text-foreground">{item.avgOccupancyPct}%</span>
                            </div>
                        </>
                    )}
                    <div className="flex items-center justify-between gap-4 pt-1 border-t border-border/50">
                        <span className="text-muted-foreground">Circuits:</span>
                        <span className="font-medium text-foreground">{item.merchants.join(', ')}</span>
                    </div>
                </div>
            </div>
        );
    }
    return null;
}

export function StreamCharts({ movies }: StreamChartsProps) {
    const [activeTab, setActiveTab] = useState<'both' | 'showtimes' | 'sales'>('both');

    // Sort by showtimes for showtime chart
    const showtimeData = useMemo(() => {
        return [...movies]
            .sort((a, b) => b.showtimes - a.showtimes)
            .slice(0, 12);
    }, [movies]);

    // Sort by admissions for sales chart
    const salesData = useMemo(() => {
        return [...movies]
            .sort((a, b) => b.estimatedAdmissions - a.estimatedAdmissions)
            .slice(0, 12);
    }, [movies]);

    return (
        <div className="flex flex-col gap-4 w-full">
            {/* Chart Mode Controls */}
            <div className="flex items-center justify-between gap-2 border-b border-border/60 pb-2">
                <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-black uppercase tracking-wider text-muted-foreground">
                        Theatrical Distribution Charts
                    </span>
                    <span className="font-mono text-sm text-muted-foreground/60 hidden sm:inline">
                        (Ranks #6 - #{movies.length})
                    </span>
                </div>

                <div className="flex items-center gap-1 bg-muted/40 p-1 rounded-xl border border-border/50">
                    <button
                        onClick={() => setActiveTab('both')}
                        className={`
                            px-3 py-1 rounded-lg text-sm font-mono font-bold transition-all
                            ${activeTab === 'both' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}
                        `}
                    >
                        Split View
                    </button>
                    <button
                        onClick={() => setActiveTab('showtimes')}
                        className={`
                            px-3 py-1 rounded-lg text-sm font-mono font-bold transition-all flex items-center gap-1.5
                            ${activeTab === 'showtimes' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}
                        `}
                    >
                        <Ticket className="w-3.5 h-3.5 text-primary" />
                        <span>Showtimes</span>
                    </button>
                    <button
                        onClick={() => setActiveTab('sales')}
                        className={`
                            px-3 py-1 rounded-lg text-sm font-mono font-bold transition-all flex items-center gap-1.5
                            ${activeTab === 'sales' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}
                        `}
                    >
                        <Users className="w-3.5 h-3.5 text-emerald-500" />
                        <span>Sales</span>
                    </button>
                </div>
            </div>

            {/* Charts Grid */}
            <div className={`grid gap-4 ${activeTab === 'both' ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1'}`}>
                
                {/* 1. Showtimes Allocation Chart */}
                {(activeTab === 'both' || activeTab === 'showtimes') && (
                    <div className="bg-card text-card-foreground border border-border/80 rounded-2xl p-4 shadow-sm flex flex-col justify-between">
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                                <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
                                    <Ticket className="w-4 h-4" />
                                </div>
                                <div>
                                    <h4 className="font-bold text-base tracking-tight">Showtimes Allocation</h4>
                                    <p className="text-sm text-muted-foreground">National screen scheduling volume</p>
                                </div>
                            </div>
                        </div>

                        <div className="h-[280px] w-full mt-2">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart
                                    data={showtimeData}
                                    layout="vertical"
                                    margin={{ top: 5, right: 30, left: 10, bottom: 5 }}
                                >
                                    <XAxis type="number" hide />
                                    <YAxis
                                        type="category"
                                        dataKey="title"
                                        width={120}
                                        tick={{ fill: 'currentColor', fontSize: 12, fontWeight: 600 }}
                                        tickFormatter={(val: string) => val.length > 15 ? `${val.slice(0, 14)}...` : val}
                                    />
                                    <RechartsTooltip
                                        content={<CustomChartTooltip metricType="showtimes" />}
                                        cursor={{ fill: 'currentColor', opacity: 0.05 }}
                                    />
                                    <Bar
                                        dataKey="showtimes"
                                        radius={[0, 6, 6, 0]}
                                        fill="hsl(var(--primary))"
                                    >
                                        {showtimeData.map((entry, index) => (
                                            <Cell
                                                key={`show-${entry.id}`}
                                                fill={index === 0 ? 'rgba(207, 171, 122, 0.95)' : index < 3 ? 'rgba(207, 171, 122, 0.75)' : 'hsl(var(--primary))'}
                                            />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                )}

                {/* 2. Audience Sales Chart */}
                {(activeTab === 'both' || activeTab === 'sales') && (
                    <div className="bg-card text-card-foreground border border-border/80 rounded-2xl p-4 shadow-sm flex flex-col justify-between">
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                                <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-500">
                                    <Users className="w-4 h-4" />
                                </div>
                                <div>
                                    <h4 className="font-bold text-base tracking-tight">Audience Sales (Admissions)</h4>
                                    <p className="text-sm text-muted-foreground">Estimated seats occupied today</p>
                                </div>
                            </div>
                        </div>

                        <div className="h-[280px] w-full mt-2">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart
                                    data={salesData}
                                    layout="vertical"
                                    margin={{ top: 5, right: 30, left: 10, bottom: 5 }}
                                >
                                    <XAxis type="number" hide />
                                    <YAxis
                                        type="category"
                                        dataKey="title"
                                        width={120}
                                        tick={{ fill: 'currentColor', fontSize: 12, fontWeight: 600 }}
                                        tickFormatter={(val: string) => val.length > 15 ? `${val.slice(0, 14)}...` : val}
                                    />
                                    <RechartsTooltip
                                        content={<CustomChartTooltip metricType="sales" />}
                                        cursor={{ fill: 'currentColor', opacity: 0.05 }}
                                    />
                                    <Bar
                                        dataKey="estimatedAdmissions"
                                        radius={[0, 6, 6, 0]}
                                        fill="#10b981"
                                    >
                                        {salesData.map((entry) => {
                                            const tier = getPerformanceTier(entry.avgOccupancyPct);
                                            return (
                                                <Cell
                                                    key={`sales-${entry.id}`}
                                                    fill={tier.color || '#10b981'}
                                                />
                                            );
                                        })}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                )}

            </div>
        </div>
    );
}
