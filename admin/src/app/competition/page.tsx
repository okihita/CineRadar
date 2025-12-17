'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Trophy, TrendingUp, Building2, Calendar, Target } from 'lucide-react';

interface CompetitionData {
    nationalShare: Array<{ chain: string; share_pct: number; theatres: number }>;
    cityShare: Array<{ city: string; chain: string; share_pct: number; theatre_count: number }>;
    shareTrend: Array<{ chain: string; month: string; share_pct: number }>;
    priceComparison: Array<{ chain: string; room_type: string; avg_price: number; min_price: number; max_price: number }>;
    priceTrend: Array<{ chain: string; month: string; avg_price: number }>;
    expansionEvents: Array<{ chain: string; city: string; event_type: string; event_date: string; theatre_name: string }>;
    chainDensity: Array<{ city: string; population: number; chain: string; theatres: number; per_100k: number }>;
    battlegrounds: Array<{ city: string; gap: number; breakdown: string }>;
}

const CHAIN_COLORS = {
    'XXI': { bg: 'bg-amber-500', text: 'text-amber-600', light: 'bg-amber-500/20' },
    'CGV': { bg: 'bg-red-600', text: 'text-red-600', light: 'bg-red-500/20' },
    'Cinépolis': { bg: 'bg-blue-600', text: 'text-blue-600', light: 'bg-blue-500/20' },
};

export default function CompetitionPage() {
    const [data, setData] = useState<CompetitionData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        async function fetchData() {
            try {
                const res = await fetch('/api/competition');
                const json = await res.json();
                if (json.error) setError(json.error);
                else setData(json);
            } catch { setError('Failed to load competition data'); }
            finally { setLoading(false); }
        }
        fetchData();
    }, []);

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-center">
                    <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-muted-foreground text-sm">Loading competition data...</p>
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
                    </CardContent>
                </Card>
            </div>
        );
    }

    // Group city share by city
    const cityShareGrouped: Record<string, typeof data.cityShare> = {};
    data.cityShare.forEach(cs => {
        if (!cityShareGrouped[cs.city]) cityShareGrouped[cs.city] = [];
        cityShareGrouped[cs.city].push(cs);
    });

    return (
        <div className="min-h-screen bg-background text-foreground p-6">
            {/* Header */}
            <div className="mb-6">
                <div className="flex items-center gap-3 mb-2">
                    <Trophy className="w-6 h-6 text-amber-500" />
                    <h1 className="text-2xl font-bold">Competition Intelligence</h1>
                    <Badge variant="outline" className="ml-2">Mock Data</Badge>
                </div>
                <p className="text-muted-foreground text-sm">Market share analysis and competitive landscape</p>
            </div>

            {/* National Market Share */}
            <Card className="mb-6">
                <CardHeader className="py-3">
                    <CardTitle className="text-sm">National Market Share</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex gap-4 items-end mb-4">
                        {data.nationalShare.map((chain) => {
                            const colors = CHAIN_COLORS[chain.chain as keyof typeof CHAIN_COLORS] || { bg: 'bg-gray-500' };
                            return (
                                <div key={chain.chain} className="flex-1 text-center">
                                    <div className="relative h-32 w-full rounded-t-lg overflow-hidden bg-muted">
                                        <div
                                            className={`absolute bottom-0 w-full ${colors.bg} transition-all`}
                                            style={{ height: `${chain.share_pct}%` }}
                                        />
                                    </div>
                                    <div className="mt-2">
                                        <span className={`inline-flex items-center px-3 py-1 rounded text-sm font-bold text-white ${colors.bg}`}>
                                            {chain.chain}
                                        </span>
                                        <p className="text-2xl font-bold mt-1">{chain.share_pct}%</p>
                                        <p className="text-xs text-muted-foreground">{chain.theatres} theatres</p>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </CardContent>
            </Card>

            {/* Main Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                {/* Expansion Events */}
                <Card>
                    <CardHeader className="py-3">
                        <CardTitle className="text-sm flex items-center gap-2">
                            <Calendar className="w-4 h-4 text-green-500" />
                            Expansion Tracker
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                        <div className="space-y-3 max-h-[300px] overflow-y-auto">
                            {data.expansionEvents.map((event, idx) => {
                                const colors = CHAIN_COLORS[event.chain as keyof typeof CHAIN_COLORS] || { bg: 'bg-gray-500', light: 'bg-gray-200' };
                                const isPast = new Date(event.event_date) < new Date();
                                return (
                                    <div key={idx} className={`p-3 rounded-lg ${colors.light} border`}>
                                        <div className="flex items-center justify-between mb-1">
                                            <span className={`px-2 py-0.5 rounded text-xs font-medium text-white ${colors.bg}`}>
                                                {event.chain}
                                            </span>
                                            <Badge variant={event.event_type === 'opening' ? 'default' : event.event_type === 'planned' ? 'secondary' : 'outline'}>
                                                {event.event_type}
                                            </Badge>
                                        </div>
                                        <p className="font-medium text-sm">{event.theatre_name || 'TBD'}</p>
                                        <p className="text-xs text-muted-foreground">{event.city} • {event.event_date}</p>
                                    </div>
                                );
                            })}
                        </div>
                    </CardContent>
                </Card>

                {/* Competitive Battlegrounds */}
                <Card className="border-amber-500/30">
                    <CardHeader className="py-3">
                        <CardTitle className="text-sm flex items-center gap-2 text-amber-600">
                            <Target className="w-4 h-4" />
                            Competitive Battlegrounds
                            <span className="text-xs font-normal text-muted-foreground ml-2">(Closest market share gaps)</span>
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                        <Table>
                            <TableHeader>
                                <TableRow className="text-xs">
                                    <TableHead>City</TableHead>
                                    <TableHead>Gap</TableHead>
                                    <TableHead>Market Breakdown</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {data.battlegrounds.map((bg) => (
                                    <TableRow key={bg.city}>
                                        <TableCell className="font-medium">🔥 {bg.city}</TableCell>
                                        <TableCell>
                                            <span className={`font-mono ${bg.gap < 10 ? 'text-red-600' : 'text-amber-600'}`}>
                                                {bg.gap.toFixed(1)}%
                                            </span>
                                        </TableCell>
                                        <TableCell className="text-xs text-muted-foreground">{bg.breakdown}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                        <p className="text-xs text-muted-foreground mt-3">
                            💡 <strong>Insight:</strong> Cities with small gaps = fierce competition. Monitor closely!
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Price Comparison */}
            <Card className="mb-6">
                <CardHeader className="py-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                        <TrendingUp className="w-4 h-4 text-purple-500" />
                        Price Positioning by Room Type
                    </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow className="text-xs">
                                    <TableHead>Room Type</TableHead>
                                    {data.nationalShare.map(c => (
                                        <TableHead key={c.chain} className="text-center">{c.chain}</TableHead>
                                    ))}
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {['2D', '3D', 'IMAX', 'GOLD CLASS'].map(roomType => {
                                    const prices = data.priceComparison.filter(p => p.room_type === roomType);
                                    return (
                                        <TableRow key={roomType}>
                                            <TableCell className="font-medium">{roomType}</TableCell>
                                            {data.nationalShare.map(c => {
                                                const price = prices.find(p => p.chain === c.chain);
                                                return (
                                                    <TableCell key={c.chain} className="text-center font-mono">
                                                        {price ? `Rp${price.avg_price.toLocaleString()}` : '-'}
                                                    </TableCell>
                                                );
                                            })}
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>

            {/* Market Share by City */}
            <Card>
                <CardHeader className="py-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-blue-500" />
                        Market Share by City
                    </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                        {Object.entries(cityShareGrouped).slice(0, 12).map(([city, shares]) => (
                            <div key={city} className="p-3 rounded-lg bg-muted/50">
                                <p className="font-medium text-sm mb-2">{city}</p>
                                <div className="space-y-1">
                                    {shares.sort((a, b) => b.share_pct - a.share_pct).map(s => {
                                        const colors = CHAIN_COLORS[s.chain as keyof typeof CHAIN_COLORS] || { bg: 'bg-gray-500' };
                                        return (
                                            <div key={s.chain} className="flex items-center gap-2">
                                                <div className={`w-2 h-2 rounded-full ${colors.bg}`} />
                                                <span className="text-xs flex-1">{s.chain}</span>
                                                <span className="text-xs font-mono">{s.share_pct}%</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
