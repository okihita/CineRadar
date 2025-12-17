'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/PageHeader';
import {
    LayoutDashboard, TrendingUp, TrendingDown, AlertTriangle, CheckCircle,
    XCircle, Film, Building2, MapPin, Lightbulb, ArrowRight, Clock
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface DashboardData {
    greeting: string;
    date: string;
    timestamp: string;
    kpis: {
        revenue: { value: number; delta: string };
        tickets: { value: number; delta: string };
        occupancy: { value: number; delta: string };
        topTheatre: string;
    };
    alerts: Array<{ type: string; title: string; subtitle?: string; action: string; link: string }>;
    timeline: Array<{ hour: string; occupancy: number; status: string; note: string; current?: boolean }>;
    hotMovies: Array<{ title: string; genre: string; occupancy: number; revenue: number }>;
    topTheatres: Array<{ name: string; chain: string; revenue: number; occupancy: number }>;
    cityPerformance: Array<{ name: string; region: string; occupancy: number; revenue: number }>;
    aiInsight: { type: string; text: string };
}

function formatRupiah(value: number): string {
    if (value >= 1_000_000_000) return `Rp${(value / 1_000_000_000).toFixed(1)}B`;
    if (value >= 1_000_000) return `Rp${(value / 1_000_000).toFixed(0)}M`;
    if (value >= 1_000) return `Rp${(value / 1_000).toFixed(0)}K`;
    return `Rp${value}`;
}

function DeltaBadge({ value }: { value: string }) {
    const isPositive = value.startsWith('+') || (!value.startsWith('-') && parseFloat(value) > 0);
    const isNegative = value.startsWith('-') || parseFloat(value) < 0;

    return (
        <span className={`inline-flex items-center gap-1 text-sm font-medium ${isPositive ? 'text-green-600' : isNegative ? 'text-red-600' : 'text-muted-foreground'
            }`}>
            {isPositive ? <TrendingUp className="w-4 h-4" /> : isNegative ? <TrendingDown className="w-4 h-4" /> : null}
            {isPositive && !value.startsWith('+') ? '+' : ''}{value}%
        </span>
    );
}

export default function ExecutiveDashboard() {
    const [data, setData] = useState<DashboardData | null>(null);
    const [loading, setLoading] = useState(true);
    const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

    const fetchData = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/dashboard');
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
                <div className="text-center">
                    <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-muted-foreground text-sm">Loading executive dashboard...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background text-foreground p-4 md:p-6">
            {/* Header */}
            <div className="mb-6">
                <PageHeader
                    title={`${data.greeting}, Admin`}
                    description={data.date}
                    icon={<LayoutDashboard className="w-6 h-6 text-primary" />}
                    lastUpdated={lastUpdated.toLocaleTimeString()}
                    onRefresh={fetchData}
                    isRefreshing={loading}
                    showMockBadge={true}
                />
            </div>

            {/* KPI Scoreboard */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <Card className="bg-gradient-to-br from-green-500/10 to-green-500/5 border-green-500/30">
                    <CardContent className="pt-4">
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                            💰 Revenue Today
                        </p>
                        <p className="text-2xl font-bold">{formatRupiah(data.kpis.revenue.value)}</p>
                        <DeltaBadge value={data.kpis.revenue.delta} />
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="pt-4">
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                            🎫 Tickets Sold
                        </p>
                        <p className="text-2xl font-bold">{data.kpis.tickets.value.toLocaleString()}</p>
                        <DeltaBadge value={data.kpis.tickets.delta} />
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="pt-4">
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                            📊 Avg Occupancy
                        </p>
                        <p className="text-2xl font-bold">{data.kpis.occupancy.value}%</p>
                        <DeltaBadge value={data.kpis.occupancy.delta} />
                    </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-amber-500/10 to-amber-500/5 border-amber-500/30">
                    <CardContent className="pt-4">
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                            🏆 Top Theatre
                        </p>
                        <p className="text-lg font-bold truncate">{data.kpis.topTheatre}</p>
                        <p className="text-xs text-muted-foreground">Highest revenue today</p>
                    </CardContent>
                </Card>
            </div>

            {/* Alerts Section */}
            <Card className="mb-6 border-amber-500/50 bg-amber-500/5">
                <CardHeader className="py-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-amber-500" />
                        Alerts & Actions
                        <Badge variant="outline" className="ml-2">{data.alerts.length}</Badge>
                    </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                    <div className="space-y-2">
                        {data.alerts.map((alert, i) => (
                            <div key={i} className={`flex items-center justify-between p-3 rounded-lg border ${alert.type === 'warning' ? 'bg-amber-500/10 border-amber-500/30' :
                                    alert.type === 'success' ? 'bg-green-500/10 border-green-500/30' :
                                        'bg-red-500/10 border-red-500/30'
                                }`}>
                                <div className="flex items-center gap-3">
                                    {alert.type === 'warning' && <AlertTriangle className="w-5 h-5 text-amber-500" />}
                                    {alert.type === 'success' && <CheckCircle className="w-5 h-5 text-green-500" />}
                                    {alert.type === 'danger' && <XCircle className="w-5 h-5 text-red-500" />}
                                    <div>
                                        <p className="text-sm font-medium">{alert.title}</p>
                                        {alert.subtitle && <p className="text-xs text-muted-foreground">{alert.subtitle}</p>}
                                    </div>
                                </div>
                                <Link href={alert.link}>
                                    <Badge variant="outline" className="cursor-pointer hover:bg-primary hover:text-primary-foreground transition-colors">
                                        {alert.action} <ArrowRight className="w-3 h-3 ml-1" />
                                    </Badge>
                                </Link>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
                {/* Today's Timeline */}
                <Card>
                    <CardHeader className="py-3">
                        <CardTitle className="text-sm flex items-center gap-2">
                            <Clock className="w-4 h-4 text-blue-500" />
                            Today's Timeline
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                        <div className="space-y-2">
                            {data.timeline.map((t) => (
                                <div key={t.hour} className={`flex items-center gap-3 p-2 rounded ${t.current ? 'bg-primary/10 border border-primary/30' : ''}`}>
                                    <span className="text-xs font-mono w-12">{t.hour}</span>
                                    <div className={`w-3 h-3 rounded-full ${t.status === 'peak' ? 'bg-green-500' :
                                            t.status === 'slow' ? 'bg-red-500' : 'bg-amber-500'
                                        }`} />
                                    <div className="flex-1">
                                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                                            <div
                                                className={`h-full ${t.status === 'peak' ? 'bg-green-500' : t.status === 'slow' ? 'bg-red-500' : 'bg-amber-500'}`}
                                                style={{ width: `${t.occupancy}%` }}
                                            />
                                        </div>
                                    </div>
                                    <span className="text-xs font-mono w-10">{t.occupancy}%</span>
                                    {t.current && <Badge variant="default" className="text-xs">Now</Badge>}
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>

                {/* What's Hot */}
                <Card>
                    <CardHeader className="py-3">
                        <CardTitle className="text-sm flex items-center gap-2">
                            <Film className="w-4 h-4 text-purple-500" />
                            What's Hot Today
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                        <div className="space-y-3">
                            {data.hotMovies.map((movie, i) => (
                                <div key={movie.title} className="flex items-center gap-3">
                                    <span className="text-lg">{['🥇', '🥈', '🥉', '4️⃣', '5️⃣'][i]}</span>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium truncate">{movie.title}</p>
                                        <p className="text-xs text-muted-foreground">{movie.genre}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className={`text-sm font-bold ${movie.occupancy >= 70 ? 'text-green-600' : movie.occupancy >= 50 ? 'text-amber-600' : 'text-red-600'}`}>
                                            {movie.occupancy}%
                                        </p>
                                        {movie.occupancy < 40 && (
                                            <Badge variant="destructive" className="text-xs">Push Promo</Badge>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                        <Link href="/movies" className="block mt-4">
                            <Badge variant="outline" className="w-full justify-center py-1.5 hover:bg-muted cursor-pointer">
                                View All Movies <ArrowRight className="w-3 h-3 ml-1" />
                            </Badge>
                        </Link>
                    </CardContent>
                </Card>

                {/* Top Theatres */}
                <Card>
                    <CardHeader className="py-3">
                        <CardTitle className="text-sm flex items-center gap-2">
                            <Building2 className="w-4 h-4 text-cyan-500" />
                            Theatre Pulse
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                        <div className="h-[200px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={data.topTheatres} layout="vertical" margin={{ left: 0, right: 10 }}>
                                    <XAxis type="number" hide />
                                    <YAxis
                                        dataKey="name"
                                        type="category"
                                        width={100}
                                        tick={{ fontSize: 10 }}
                                        tickFormatter={(v) => v.length > 15 ? v.slice(0, 15) + '...' : v}
                                    />
                                    <Tooltip formatter={(v: number) => [formatRupiah(v), 'Revenue']} />
                                    <Bar dataKey="revenue" radius={[0, 4, 4, 0]}>
                                        {data.topTheatres.map((t, i) => (
                                            <Cell key={i} fill={['#10b981', '#22c55e', '#84cc16', '#eab308', '#f59e0b'][i]} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                        <Link href="/cinemas" className="block mt-2">
                            <Badge variant="outline" className="w-full justify-center py-1.5 hover:bg-muted cursor-pointer">
                                View All Theatres <ArrowRight className="w-3 h-3 ml-1" />
                            </Badge>
                        </Link>
                    </CardContent>
                </Card>
            </div>

            {/* AI Insight */}
            <Card className="border-violet-500/30 bg-gradient-to-r from-violet-500/10 to-purple-500/10">
                <CardContent className="py-4">
                    <div className="flex items-start gap-4">
                        <div className="w-10 h-10 rounded-full bg-violet-500/20 flex items-center justify-center flex-shrink-0">
                            <Lightbulb className="w-5 h-5 text-violet-500" />
                        </div>
                        <div>
                            <p className="text-sm font-medium text-violet-600 dark:text-violet-400 mb-1">💡 AI Insight of the Day</p>
                            <p className="text-sm">{data.aiInsight.text}</p>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Quick Links */}
            <div className="mt-6 flex flex-wrap gap-2 justify-center">
                {[
                    { label: 'Cinemas', href: '/cinemas' },
                    { label: 'Movies', href: '/movies' },
                    { label: 'Audience', href: '/audience' },
                    { label: 'Revenue', href: '/revenue' },
                    { label: 'Competition', href: '/competition' },
                    { label: 'Trends', href: '/trends' },
                    { label: 'Analytics', href: '/analytics' },
                ].map((link) => (
                    <Link key={link.href} href={link.href}>
                        <Badge variant="outline" className="cursor-pointer hover:bg-muted px-3 py-1.5">
                            {link.label}
                        </Badge>
                    </Link>
                ))}
            </div>
        </div>
    );
}
