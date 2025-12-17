'use client';

import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/PageHeader';
import { CollapsibleCard } from '@/components/CollapsibleCard';
import { DateRangePicker, getDefaultDateRange } from '@/components/DateRangePicker';
import { exportTableAsCSV } from '@/lib/export';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, FunnelChart, Funnel, LabelList, Cell } from 'recharts';
import { Brain, TrendingUp, Filter, AlertTriangle, Lightbulb, Grid3X3 } from 'lucide-react';

interface AnalyticsData {
    cohortAnalysis: Array<Record<string, string | number>>;
    funnel: Array<{ stage: string; users: number; percentage: number }>;
    seatHeatmap: Array<{ row: string; seat: number; seatId: string; occupancy_pct: string }>;
    whatIf: {
        current: { avg_price: number; avg_occupancy: number; revenue: number };
        scenarios: Array<{ name: string; price: number; predicted_occupancy: number; predicted_revenue: number; delta: string }>;
        elasticity: number;
    };
    anomalies: Array<{ date: string; type: string; metric: string; value: string; location: string; cause: string }>;
    forecast: Array<{ date: string; day: string; predicted_occupancy: number; predicted_revenue: number; confidence: number }>;
}

const HEATMAP_COLORS = [
    { threshold: 30, color: '#ef4444' },
    { threshold: 50, color: '#f59e0b' },
    { threshold: 70, color: '#eab308' },
    { threshold: 85, color: '#84cc16' },
    { threshold: 100, color: '#22c55e' },
];

function getHeatmapColor(value: number) {
    for (const { threshold, color } of HEATMAP_COLORS) {
        if (value <= threshold) return color;
    }
    return '#22c55e';
}

export default function AnalyticsPage() {
    const [data, setData] = useState<AnalyticsData | null>(null);
    const [loading, setLoading] = useState(true);
    const [dateRange, setDateRange] = useState(getDefaultDateRange());
    const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
    const [selectedScenario, setSelectedScenario] = useState(2); // Current
    const funnelRef = useRef<HTMLDivElement>(null);
    const heatmapRef = useRef<HTMLDivElement>(null);

    const fetchData = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/analytics');
            const json = await res.json();
            setData(json);
            setLastUpdated(new Date());
        } catch (e) { }
        finally { setLoading(false); }
    };

    useEffect(() => { fetchData(); }, []);

    if (loading || !data) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    const seatsByRow = data.seatHeatmap.reduce((acc, seat) => {
        if (!acc[seat.row]) acc[seat.row] = [];
        acc[seat.row].push(seat);
        return acc;
    }, {} as Record<string, typeof data.seatHeatmap>);

    return (
        <div className="min-h-screen bg-background text-foreground p-4 md:p-6">
            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-6">
                <PageHeader
                    title="Advanced Analytics"
                    description="Deep insights, predictions, and what-if scenarios"
                    icon={<Brain className="w-6 h-6 text-violet-500" />}
                    lastUpdated={lastUpdated.toLocaleTimeString()}
                    onRefresh={fetchData}
                    isRefreshing={loading}
                />
                <DateRangePicker value={dateRange} onChange={setDateRange} />
            </div>

            {/* Anomaly Alerts */}
            <Card className="mb-6 border-amber-500/50 bg-amber-500/5">
                <CardHeader className="py-3">
                    <CardTitle className="text-sm flex items-center gap-2 text-amber-600">
                        <AlertTriangle className="w-4 h-4" />
                        Detected Anomalies
                        <Badge variant="outline" className="ml-2">{data.anomalies.length}</Badge>
                    </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                    <div className="flex gap-3 overflow-x-auto pb-2">
                        {data.anomalies.map((a, i) => (
                            <div key={i} className={`flex-shrink-0 p-3 rounded-lg border ${a.type === 'spike' ? 'bg-green-500/10 border-green-500/30' : 'bg-red-500/10 border-red-500/30'}`}>
                                <div className="flex items-center gap-2 mb-1">
                                    <Badge variant={a.type === 'spike' ? 'default' : 'destructive'} className="text-xs">
                                        {a.type === 'spike' ? '📈' : '📉'} {a.value}
                                    </Badge>
                                    <span className="text-xs text-muted-foreground">{a.date}</span>
                                </div>
                                <p className="text-sm font-medium">{a.metric} @ {a.location}</p>
                                <p className="text-xs text-muted-foreground">{a.cause}</p>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                {/* Funnel */}
                <CollapsibleCard
                    title="Conversion Funnel"
                    icon={<Filter className="w-4 h-4 text-blue-500" />}
                    id="funnel"
                    chartRef={funnelRef}
                    onExport={() => exportTableAsCSV(data.funnel, 'funnel')}
                >
                    <div ref={funnelRef} className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={data.funnel} layout="vertical" margin={{ left: 100 }}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis type="number" domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                                <YAxis dataKey="stage" type="category" width={100} tick={{ fontSize: 11 }} />
                                <Tooltip formatter={(v: number) => [`${v}%`, 'Conversion']} />
                                <Bar dataKey="percentage" radius={[0, 4, 4, 0]}>
                                    {data.funnel.map((_, i) => (
                                        <Cell key={i} fill={`hsl(${220 - i * 30}, 70%, ${50 + i * 5}%)`} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                        💡 <strong>Drop-off:</strong> 47% lose interest at "Select Showtime". Consider better showtime filtering.
                    </p>
                </CollapsibleCard>

                {/* Forecast */}
                <CollapsibleCard
                    title="14-Day Revenue Forecast"
                    icon={<TrendingUp className="w-4 h-4 text-green-500" />}
                    id="forecast"
                    onExport={() => exportTableAsCSV(data.forecast, 'forecast', [
                        { key: 'date', label: 'Date' },
                        { key: 'day', label: 'Day' },
                        { key: 'predicted_revenue', label: 'Predicted Revenue' },
                        { key: 'confidence', label: 'Confidence' },
                    ])}
                >
                    <div className="h-[250px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={data.forecast}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="day" tick={{ fontSize: 10 }} />
                                <YAxis tickFormatter={(v) => `${(v / 1000000).toFixed(0)}M`} />
                                <Tooltip formatter={(v: number) => [`Rp${(v / 1000000).toFixed(1)}M`, 'Revenue']} />
                                <Line type="monotone" dataKey="predicted_revenue" stroke="#22c55e" strokeWidth={2} dot={{ r: 3 }} />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </CollapsibleCard>
            </div>

            {/* Seat Heatmap */}
            <CollapsibleCard
                title="Seat Popularity Heatmap"
                icon={<Grid3X3 className="w-4 h-4 text-orange-500" />}
                id="heatmap"
                chartRef={heatmapRef}
                className="mb-6"
            >
                <div ref={heatmapRef} className="overflow-x-auto">
                    <div className="flex justify-center mb-4">
                        <div className="bg-muted px-8 py-2 rounded-lg text-center">
                            <span className="text-xs text-muted-foreground">🎬 SCREEN 🎬</span>
                        </div>
                    </div>
                    <div className="flex flex-col gap-1 items-center">
                        {Object.entries(seatsByRow).map(([row, seats]) => (
                            <div key={row} className="flex items-center gap-1">
                                <span className="w-6 text-xs text-muted-foreground text-right">{row}</span>
                                {seats.map((seat) => (
                                    <div
                                        key={seat.seatId}
                                        className="w-5 h-5 rounded text-[8px] flex items-center justify-center text-white font-bold cursor-pointer hover:ring-2 hover:ring-white"
                                        style={{ backgroundColor: getHeatmapColor(parseFloat(seat.occupancy_pct)) }}
                                        title={`${seat.seatId}: ${seat.occupancy_pct}% occupancy`}
                                    >
                                        {seat.seat}
                                    </div>
                                ))}
                            </div>
                        ))}
                    </div>
                    <div className="flex justify-center gap-4 mt-4">
                        {HEATMAP_COLORS.map(({ threshold, color }) => (
                            <div key={threshold} className="flex items-center gap-1 text-xs">
                                <div className="w-4 h-4 rounded" style={{ backgroundColor: color }} />
                                <span>≤{threshold}%</span>
                            </div>
                        ))}
                    </div>
                </div>
            </CollapsibleCard>

            {/* What-If Simulator */}
            <CollapsibleCard
                title="What-If Price Simulator"
                icon={<Lightbulb className="w-4 h-4 text-yellow-500" />}
                id="whatif"
                className="mb-6"
            >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <p className="text-sm text-muted-foreground mb-4">
                            Elasticity coefficient: <strong>{data.whatIf.elasticity}</strong> (1% price ↑ = {Math.abs(data.whatIf.elasticity)}% occupancy ↓)
                        </p>
                        <div className="space-y-2">
                            {data.whatIf.scenarios.map((scenario, i) => (
                                <button
                                    key={scenario.name}
                                    onClick={() => setSelectedScenario(i)}
                                    className={`w-full p-3 rounded-lg border text-left transition-colors ${selectedScenario === i
                                            ? 'border-primary bg-primary/10'
                                            : 'border-muted hover:border-muted-foreground/30'
                                        }`}
                                >
                                    <div className="flex justify-between items-center">
                                        <span className="font-medium">{scenario.name}</span>
                                        <Badge variant={scenario.delta.startsWith('+') ? 'default' : scenario.delta === '0%' ? 'secondary' : 'destructive'}
                                            className={scenario.delta.startsWith('+') ? 'bg-green-600' : ''}>
                                            {scenario.delta}
                                        </Badge>
                                    </div>
                                    <div className="flex justify-between text-xs text-muted-foreground mt-1">
                                        <span>Price: Rp{scenario.price.toLocaleString()}</span>
                                        <span>Occ: {scenario.predicted_occupancy}%</span>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="flex flex-col justify-center">
                        <div className="text-center p-6 rounded-lg bg-muted/50">
                            <p className="text-sm text-muted-foreground mb-2">Predicted Revenue</p>
                            <p className="text-4xl font-bold">
                                Rp{(data.whatIf.scenarios[selectedScenario].predicted_revenue / 1000000000).toFixed(2)}B
                            </p>
                            <p className={`text-lg font-medium ${data.whatIf.scenarios[selectedScenario].delta.startsWith('+') ? 'text-green-600' :
                                    data.whatIf.scenarios[selectedScenario].delta === '0%' ? 'text-muted-foreground' : 'text-red-600'
                                }`}>
                                {data.whatIf.scenarios[selectedScenario].delta} vs current
                            </p>
                        </div>
                        <p className="text-xs text-muted-foreground mt-4 text-center">
                            💡 <strong>Recommendation:</strong> A 10% price reduction could increase revenue by 1.4%
                        </p>
                    </div>
                </div>
            </CollapsibleCard>

            {/* Cohort Analysis */}
            <CollapsibleCard
                title="Cohort Retention Analysis"
                icon={<TrendingUp className="w-4 h-4 text-purple-500" />}
                id="cohort"
                onExport={() => exportTableAsCSV(data.cohortAnalysis, 'cohort')}
            >
                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow className="text-xs">
                                <TableHead>Cohort</TableHead>
                                <TableHead>New Users</TableHead>
                                <TableHead className="text-center">Month 0</TableHead>
                                <TableHead className="text-center">Month 1</TableHead>
                                <TableHead className="text-center">Month 2</TableHead>
                                <TableHead className="text-center">Month 3</TableHead>
                                <TableHead className="text-center">Month 4</TableHead>
                                <TableHead className="text-center">Month 5</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {data.cohortAnalysis.map((cohort) => (
                                <TableRow key={String(cohort.month)}>
                                    <TableCell className="font-medium">{cohort.month}</TableCell>
                                    <TableCell className="font-mono">{Number(cohort.new_users).toLocaleString()}</TableCell>
                                    {[0, 1, 2, 3, 4, 5].map((m) => {
                                        const value = cohort[`month_${m}`];
                                        if (value === undefined) return <TableCell key={m} className="text-center">-</TableCell>;
                                        const numValue = parseFloat(String(value));
                                        return (
                                            <TableCell key={m} className="text-center">
                                                <span className={`px-2 py-1 rounded text-xs ${numValue > 70 ? 'bg-green-500/20 text-green-600' :
                                                        numValue > 50 ? 'bg-amber-500/20 text-amber-600' :
                                                            'bg-red-500/20 text-red-600'
                                                    }`}>
                                                    {value}%
                                                </span>
                                            </TableCell>
                                        );
                                    })}
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            </CollapsibleCard>
        </div>
    );
}
