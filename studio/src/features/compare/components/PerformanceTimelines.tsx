import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer } from 'recharts';
import { abbreviateTitle, RechartsTooltipEntry, CompareMovieMeta } from '../types';

interface CustomTooltipProps {
    active?: boolean;
    payload?: RechartsTooltipEntry[];
    label?: string;
}

const CustomTooltip = ({ active, payload, label }: CustomTooltipProps) => {
    if (active && payload && payload.length) {
        return (
            <div className="bg-background border border-border p-3 rounded-lg shadow-lg">
                <p className="font-bold mb-2 text-sm">{label}</p>
                <div className="space-y-1.5">
                    {payload.map((entry: RechartsTooltipEntry, index: number) => (
                        <div key={index} className="flex items-center justify-between gap-6" style={{ color: entry.stroke || entry.color }}>
                            <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.stroke || entry.color }} />
                                <span className="text-sm font-medium">{abbreviateTitle(entry.name)}:</span>
                            </div>
                            <span className="text-sm font-bold text-right">
                                {entry.dataKey.includes('occupancy')
                                    ? `${entry.value.toFixed(1)}%`
                                    : entry.value.toLocaleString()}
                            </span>
                        </div>
                    ))}
                </div>
            </div>
        );
    }
    return null;
};

interface PerformanceTimelinesProps {
    selectedMovieIds: string[];
    movieColorsMap: Record<string, string>;
    chartData: Record<string, unknown>[];
    compareData: {
        movies?: Record<string, CompareMovieMeta>;
    } | null;
}

interface TimelineTabConfig {
    value: string;
    dataKeySuffix: string;
    tickFormatter?: (val: number) => string;
}

const TIMELINE_TABS: TimelineTabConfig[] = [
    { value: 'admissions', dataKeySuffix: 'admissions', tickFormatter: (val) => val >= 1000 ? `${(val/1000).toFixed(1)}k` : String(val) },
    { value: 'showtimes', dataKeySuffix: 'showtimes' },
    { value: 'occupancy', dataKeySuffix: 'occupancy', tickFormatter: (val) => `${val}%` },
];

export function PerformanceTimelines({
    selectedMovieIds,
    movieColorsMap,
    chartData,
    compareData,
}: PerformanceTimelinesProps) {
    return (
        <Card className="col-span-full shadow-sm">
            <CardHeader>
                <CardTitle>Performance Timelines</CardTitle>
                <CardDescription>
                    Daily trends for selected metrics over the chosen period.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <Tabs defaultValue="admissions" className="w-full">
                    <TabsList className="mb-4">
                        <TabsTrigger value="admissions">Admissions</TabsTrigger>
                        <TabsTrigger value="showtimes">Showtimes</TabsTrigger>
                        <TabsTrigger value="occupancy">Occupancy %</TabsTrigger>
                    </TabsList>

                    {TIMELINE_TABS.map((tab) => (
                        <TabsContent key={tab.value} value={tab.value} className="mt-4 border rounded-md p-4 bg-card">
                            <div style={{ width: '100%', height: 600 }}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                                        <XAxis dataKey="date" stroke="#6b7280" fontSize={12} tickLine={false} axisLine={false} />
                                        <YAxis
                                            stroke="#6b7280"
                                            fontSize={12}
                                            tickLine={false}
                                            axisLine={false}
                                            tickFormatter={tab.tickFormatter}
                                        />
                                        <RechartsTooltip content={<CustomTooltip />} />
                                        <Legend />
                                        {selectedMovieIds.map((id) => (
                                            <Line
                                                key={id}
                                                type="linear"
                                                dataKey={`${id}_${tab.dataKeySuffix}`}
                                                name={abbreviateTitle(compareData?.movies?.[id]?.title || id)}
                                                stroke={movieColorsMap[id]}
                                                strokeWidth={4}
                                                dot={{ r: 4, strokeWidth: 2 }}
                                                activeDot={{ r: 6 }}
                                            />
                                        ))}
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                        </TabsContent>
                    ))}
                </Tabs>
            </CardContent>
        </Card>
    );
}
