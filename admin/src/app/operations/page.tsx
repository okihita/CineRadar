'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/PageHeader';
import { Settings, Clock, Calendar, Layers, Users } from 'lucide-react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, AreaChart, Area } from 'recharts';

interface OperationsData {
    capacityUtilization: Array<{ name: string; chain: string; city: string; total_seats: number; avg_occupancy: number }>;
    peakHours: Array<{ hour: number; showtimes: number; avg_occupancy: number; total_tickets: number }>;
    dayOfWeek: Array<{ day_name: string; day_num: number; showtimes: number; avg_occupancy: number }>;
    roomUtilization: Array<{ room_type: string; showtimes: number; avg_occupancy: number; avg_price: number; total_tickets: number }>;
    concessionTiming: Array<{ hour: number; concession_revenue: number; ticket_revenue: number; concession_ratio: number }>;
    staffSchedule: Array<{ shift: string; avg_occupancy: number; showtimes: number; recommendation: string }>;
}

export default function OperationsPage() {
    const [data, setData] = useState<OperationsData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

    const fetchData = async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch('/api/operations');
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const json = await res.json();
            setData(json);
            setLastUpdated(new Date());
        } catch (e) {
            const msg = e instanceof Error ? e.message : 'Failed to load operations data';
            setError(msg);
            console.error('Operations fetch error:', e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchData(); }, []);

    if (error) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-center">
                    <p className="text-red-500 mb-2">⚠️ {error}</p>
                    <button onClick={fetchData} className="text-sm text-primary hover:underline">Retry</button>
                </div>
            </div>
        );
    }

    if (loading || !data) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background text-foreground p-4 md:p-6">
            <PageHeader
                title="Operations Intelligence"
                description="Scheduling optimization, capacity utilization, and staff planning"
                icon={<Settings className="w-6 h-6 text-orange-500" />}
                lastUpdated={lastUpdated.toLocaleTimeString()}
                onRefresh={fetchData}
                isRefreshing={loading}
            />

            {/* Peak Hours Chart */}
            <Card className="mb-6">
                <CardHeader className="py-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                        <Clock className="w-4 h-4 text-blue-500" />
                        Hourly Occupancy & Traffic Pattern
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={data.peakHours}>
                                <defs>
                                    <linearGradient id="colorOcc" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8} />
                                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="hour" tickFormatter={(h) => `${h}:00`} />
                                <YAxis yAxisId="left" orientation="left" />
                                <YAxis yAxisId="right" orientation="right" />
                                <Tooltip labelFormatter={(h) => `${h}:00`} />
                                <Area yAxisId="left" type="monotone" dataKey="avg_occupancy" stroke="#3b82f6" fillOpacity={1} fill="url(#colorOcc)" name="Occupancy %" />
                                <Line yAxisId="right" type="monotone" dataKey="total_tickets" stroke="#10b981" strokeWidth={2} name="Tickets" dot={false} />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2 text-center">
                        💡 Peak hours: 18:00-21:00 | Morning shows need promotional support
                    </p>
                </CardContent>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                {/* Day of Week Analysis */}
                <Card>
                    <CardHeader className="py-3">
                        <CardTitle className="text-sm flex items-center gap-2">
                            <Calendar className="w-4 h-4 text-purple-500" />
                            Day of Week Performance
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="h-[200px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={data.dayOfWeek}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis dataKey="day_name" tick={{ fontSize: 10 }} />
                                    <YAxis />
                                    <Tooltip />
                                    <Bar dataKey="avg_occupancy" radius={[4, 4, 0, 0]}>
                                        {data.dayOfWeek.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.avg_occupancy > 60 ? '#10b981' : entry.avg_occupancy > 50 ? '#f59e0b' : '#ef4444'} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>

                {/* Room Type Utilization */}
                <Card>
                    <CardHeader className="py-3">
                        <CardTitle className="text-sm flex items-center gap-2">
                            <Layers className="w-4 h-4 text-cyan-500" />
                            Room Type Utilization
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                        <Table>
                            <TableHeader>
                                <TableRow className="text-xs">
                                    <TableHead>Room Type</TableHead>
                                    <TableHead>Occupancy</TableHead>
                                    <TableHead>Avg Price</TableHead>
                                    <TableHead>Tickets</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {data.roomUtilization.map((room) => (
                                    <TableRow key={room.room_type}>
                                        <TableCell className="font-medium">{room.room_type}</TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                <div className="w-16 h-2 bg-muted rounded-full overflow-hidden">
                                                    <div className={`h-full ${room.avg_occupancy > 60 ? 'bg-green-500' : room.avg_occupancy > 45 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${room.avg_occupancy}%` }} />
                                                </div>
                                                <span className="font-mono text-xs">{room.avg_occupancy}%</span>
                                            </div>
                                        </TableCell>
                                        <TableCell className="font-mono text-xs">Rp{room.avg_price.toLocaleString()}</TableCell>
                                        <TableCell className="font-mono text-xs">{room.total_tickets.toLocaleString()}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            </div>

            {/* Staff Scheduling */}
            <Card className="border-orange-500/30">
                <CardHeader className="py-3">
                    <CardTitle className="text-sm flex items-center gap-2 text-orange-600">
                        <Users className="w-4 h-4" />
                        Staff Scheduling Recommendations
                    </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                    <Table>
                        <TableHeader>
                            <TableRow className="text-xs">
                                <TableHead>Shift</TableHead>
                                <TableHead>Avg Occupancy</TableHead>
                                <TableHead>Showtimes</TableHead>
                                <TableHead>Staff Level</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {data.staffSchedule.map((shift) => (
                                <TableRow key={shift.shift}>
                                    <TableCell className="font-medium">{shift.shift}</TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-2">
                                            <div className="w-20 h-3 bg-muted rounded-full overflow-hidden">
                                                <div className={`h-full ${shift.avg_occupancy > 60 ? 'bg-green-500' : shift.avg_occupancy > 50 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${shift.avg_occupancy}%` }} />
                                            </div>
                                            <span className="font-mono">{shift.avg_occupancy}%</span>
                                        </div>
                                    </TableCell>
                                    <TableCell className="font-mono">{shift.showtimes.toLocaleString()}</TableCell>
                                    <TableCell>
                                        <Badge variant={shift.recommendation === 'Full Staff' ? 'default' : shift.recommendation === 'Regular Staff' ? 'secondary' : 'outline'}
                                            className={shift.recommendation === 'Full Staff' ? 'bg-green-600' : shift.recommendation === 'Regular Staff' ? 'bg-amber-500' : ''}>
                                            {shift.recommendation}
                                        </Badge>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                    <p className="text-xs text-muted-foreground mt-3 p-3 bg-muted/50 rounded-lg">
                        💡 <strong>Cost Optimization:</strong> Reduce staff during Morning shifts (50% occupancy). Maximize coverage during Prime shifts (18-21) for best customer experience.
                    </p>
                </CardContent>
            </Card>
        </div>
    );
}
