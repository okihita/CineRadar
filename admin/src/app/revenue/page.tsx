'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { DollarSign, TrendingUp, TrendingDown, Building2, ArrowUpRight, ArrowDownRight } from 'lucide-react';

interface RevenueData {
    stats: {
        total_revenue: number;
        ticket_revenue: number;
        concession_revenue: number;
        tickets_sold: number;
        avg_ticket_price: number;
        theatres: number;
    };
    revenueByChain: Array<{ chain: string; total_revenue: number; ticket_revenue: number; concession_revenue: number; tickets_sold: number; avg_ticket_price: number }>;
    revenueByCity: Array<{ city: string; region: string; total_revenue: number; tickets_sold: number; revenue_per_ticket: number }>;
    dailyTrend: Array<{ date: string; total_revenue: number; tickets_sold: number }>;
    topTheatres: Array<{ name: string; chain: string; city: string; total_revenue: number; daily_rps: number }>;
    bottomTheatres: Array<{ name: string; chain: string; city: string; total_revenue: number; daily_rps: number }>;
    priceElasticity: Array<{ price_tier: string; theatres: number; avg_occupancy: number; total_revenue: number }>;
}

function formatRupiah(value: number): string {
    if (value >= 1_000_000_000) return `Rp${(value / 1_000_000_000).toFixed(1)}B`;
    if (value >= 1_000_000) return `Rp${(value / 1_000_000).toFixed(1)}M`;
    if (value >= 1_000) return `Rp${(value / 1_000).toFixed(0)}K`;
    return `Rp${value}`;
}

export default function RevenuePage() {
    const [data, setData] = useState<RevenueData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        async function fetchData() {
            try {
                const res = await fetch('/api/revenue');
                const json = await res.json();
                if (json.error) setError(json.error);
                else setData(json);
            } catch { setError('Failed to load revenue data'); }
            finally { setLoading(false); }
        }
        fetchData();
    }, []);

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-center">
                    <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-muted-foreground text-sm">Loading revenue data...</p>
                </div>
            </div>
        );
    }

    if (error || !data) {
        return (
            <div className="min-h-screen flex items-center justify-center p-6">
                <Card className="max-w-md border-destructive">
                    <CardContent className="pt-6 text-center">
                        <p className="text-destructive mb-4">{error}</p>
                        <p className="text-sm text-muted-foreground">Run: <code className="bg-muted px-2 py-1 rounded">python backend/mock_data_generator.py</code></p>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background text-foreground p-6">
            {/* Header */}
            <div className="mb-6">
                <div className="flex items-center gap-3 mb-2">
                    <DollarSign className="w-6 h-6 text-green-500" />
                    <h1 className="text-2xl font-bold">Revenue Intelligence</h1>
                    <Badge variant="outline" className="ml-2">Mock Data</Badge>
                </div>
                <p className="text-muted-foreground text-sm">Pricing optimization and revenue forecasting</p>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <Card className="bg-green-500/10 border-green-500/30">
                    <CardContent className="pt-4">
                        <p className="text-xs text-muted-foreground">Total Revenue (30d)</p>
                        <p className="text-2xl font-bold text-green-600">{formatRupiah(data.stats.total_revenue)}</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-4">
                        <p className="text-xs text-muted-foreground">Ticket Revenue</p>
                        <p className="text-2xl font-bold">{formatRupiah(data.stats.ticket_revenue)}</p>
                        <p className="text-xs text-muted-foreground">{Math.round(data.stats.ticket_revenue / data.stats.total_revenue * 100)}% of total</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-4">
                        <p className="text-xs text-muted-foreground">Concession Revenue</p>
                        <p className="text-2xl font-bold">{formatRupiah(data.stats.concession_revenue)}</p>
                        <p className="text-xs text-muted-foreground">{Math.round(data.stats.concession_revenue / data.stats.total_revenue * 100)}% of total</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-4">
                        <p className="text-xs text-muted-foreground">Avg Ticket Price</p>
                        <p className="text-2xl font-bold">Rp{data.stats.avg_ticket_price.toLocaleString()}</p>
                        <p className="text-xs text-muted-foreground">{data.stats.tickets_sold.toLocaleString()} tickets sold</p>
                    </CardContent>
                </Card>
            </div>

            {/* Main Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                {/* Revenue by Chain */}
                <Card>
                    <CardHeader className="py-3">
                        <CardTitle className="text-sm flex items-center gap-2">
                            <DollarSign className="w-4 h-4 text-green-500" />
                            Revenue by Chain
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                        <Table>
                            <TableHeader>
                                <TableRow className="text-xs">
                                    <TableHead>Chain</TableHead>
                                    <TableHead>Total Revenue</TableHead>
                                    <TableHead>Tickets</TableHead>
                                    <TableHead>Avg Price</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {data.revenueByChain.map((chain) => (
                                    <TableRow key={chain.chain}>
                                        <TableCell>
                                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${chain.chain === 'XXI' ? 'bg-amber-500 text-white' :
                                                    chain.chain === 'CGV' ? 'bg-red-600 text-white' : 'bg-blue-600 text-white'
                                                }`}>{chain.chain}</span>
                                        </TableCell>
                                        <TableCell className="font-mono">{formatRupiah(chain.total_revenue)}</TableCell>
                                        <TableCell className="font-mono">{chain.tickets_sold.toLocaleString()}</TableCell>
                                        <TableCell className="font-mono">Rp{chain.avg_ticket_price.toLocaleString()}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>

                {/* Price Elasticity */}
                <Card>
                    <CardHeader className="py-3">
                        <CardTitle className="text-sm flex items-center gap-2">
                            <TrendingUp className="w-4 h-4 text-blue-500" />
                            Price Elasticity Analysis
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                        <Table>
                            <TableHeader>
                                <TableRow className="text-xs">
                                    <TableHead>Price Tier</TableHead>
                                    <TableHead>Theatres</TableHead>
                                    <TableHead>Avg Occupancy</TableHead>
                                    <TableHead>Revenue</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {data.priceElasticity.map((tier) => (
                                    <TableRow key={tier.price_tier}>
                                        <TableCell className="font-medium">{tier.price_tier}</TableCell>
                                        <TableCell>{tier.theatres}</TableCell>
                                        <TableCell>
                                            <span className={`font-mono ${tier.avg_occupancy > 60 ? 'text-green-600' : tier.avg_occupancy > 45 ? 'text-amber-600' : 'text-red-600'}`}>
                                                {tier.avg_occupancy}%
                                            </span>
                                        </TableCell>
                                        <TableCell className="font-mono">{formatRupiah(tier.total_revenue)}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                        <p className="text-xs text-muted-foreground mt-3">
                            💡 <strong>Insight:</strong> Lower prices correlate with higher occupancy. Find the sweet spot!
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Theatre Performance */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                {/* Top Performers */}
                <Card>
                    <CardHeader className="py-3">
                        <CardTitle className="text-sm flex items-center gap-2">
                            <ArrowUpRight className="w-4 h-4 text-green-500" />
                            Top 10 Theatres (by Revenue Per Seat/Day)
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                        <Table>
                            <TableHeader>
                                <TableRow className="text-xs">
                                    <TableHead>Theatre</TableHead>
                                    <TableHead>Chain</TableHead>
                                    <TableHead>City</TableHead>
                                    <TableHead>Daily RPS</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {data.topTheatres.map((t, idx) => (
                                    <TableRow key={t.name}>
                                        <TableCell className="font-medium">
                                            {idx < 3 && <span className="text-green-500 mr-1">🏆</span>}
                                            {t.name}
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="outline" className="text-xs">{t.chain}</Badge>
                                        </TableCell>
                                        <TableCell>{t.city}</TableCell>
                                        <TableCell className="font-mono text-green-600">{formatRupiah(t.daily_rps)}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>

                {/* Bottom Performers */}
                <Card className="border-red-500/30">
                    <CardHeader className="py-3">
                        <CardTitle className="text-sm flex items-center gap-2 text-red-600">
                            <ArrowDownRight className="w-4 h-4" />
                            Bottom 10 Theatres (Optimization Opportunity)
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                        <Table>
                            <TableHeader>
                                <TableRow className="text-xs">
                                    <TableHead>Theatre</TableHead>
                                    <TableHead>Chain</TableHead>
                                    <TableHead>City</TableHead>
                                    <TableHead>Daily RPS</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {data.bottomTheatres.map((t) => (
                                    <TableRow key={t.name}>
                                        <TableCell className="font-medium">⚠️ {t.name}</TableCell>
                                        <TableCell><Badge variant="outline" className="text-xs">{t.chain}</Badge></TableCell>
                                        <TableCell>{t.city}</TableCell>
                                        <TableCell className="font-mono text-red-600">{formatRupiah(t.daily_rps)}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                        <p className="text-xs text-muted-foreground mt-3">
                            💡 <strong>Action:</strong> Consider pricing adjustments, promotions, or showtime optimization
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Revenue by City */}
            <Card>
                <CardHeader className="py-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-purple-500" />
                        Revenue by City
                    </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow className="text-xs">
                                    <TableHead>City</TableHead>
                                    <TableHead>Region</TableHead>
                                    <TableHead>Total Revenue</TableHead>
                                    <TableHead>Tickets Sold</TableHead>
                                    <TableHead>Revenue/Ticket</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {data.revenueByCity.map((city, idx) => (
                                    <TableRow key={city.city}>
                                        <TableCell className="font-medium">
                                            {idx < 3 && <span className="mr-1">{idx === 0 ? '🥇' : idx === 1 ? '🥈' : '🥉'}</span>}
                                            {city.city}
                                        </TableCell>
                                        <TableCell className="text-muted-foreground">{city.region}</TableCell>
                                        <TableCell className="font-mono">{formatRupiah(city.total_revenue)}</TableCell>
                                        <TableCell className="font-mono">{city.tickets_sold.toLocaleString()}</TableCell>
                                        <TableCell className="font-mono">Rp{city.revenue_per_ticket.toLocaleString()}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
