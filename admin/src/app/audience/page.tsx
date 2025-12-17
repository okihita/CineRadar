'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Users, TrendingDown, Clock, Building2, Film, AlertTriangle, Target, Megaphone } from 'lucide-react';

interface BiData {
    stats: {
        cities: number;
        theatres: number;
        movies: number;
        showtimes: number;
        overall_occupancy: number;
    };
    lowPerformingCities: Array<{
        name: string;
        region: string;
        avg_occupancy: number;
        theatres: number;
    }>;
    bottomTheatres: Array<{
        name: string;
        chain: string;
        city: string;
        avg_occupancy: number;
    }>;
    timeSlots: Array<{
        time_slot: string;
        avg_occupancy: number;
        count: number;
    }>;
    chainPerformance: Array<{
        chain: string;
        theatres: number;
        avg_occupancy: number;
        avg_price: number;
    }>;
    underperformingMovies: Array<{
        title: string;
        genre: string;
        avg_occupancy: number;
    }>;
    marketingTriggers: Array<{
        theatre: string;
        city: string;
        movie: string;
        show_time: string;
        room_type: string;
        occupancy: number;
        empty_seats: number;
    }>;
}

function OccupancyBar({ value, max = 100 }: { value: number; max?: number }) {
    const pct = (value / max) * 100;
    const color = pct < 40 ? 'bg-red-500' : pct < 60 ? 'bg-amber-500' : 'bg-green-500';
    return (
        <div className="flex items-center gap-2">
            <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
                <div className={`h-full ${color}`} style={{ width: `${pct}%` }} />
            </div>
            <span className="text-sm font-mono">{value}%</span>
        </div>
    );
}

export default function AudiencePage() {
    const [data, setData] = useState<BiData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        async function fetchData() {
            try {
                const res = await fetch('/api/audience');
                const json = await res.json();
                if (json.error) {
                    setError(json.error);
                } else {
                    setData(json);
                }
            } catch (err) {
                setError('Failed to load BI data');
            } finally {
                setLoading(false);
            }
        }
        fetchData();
    }, []);

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-center">
                    <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-muted-foreground text-sm">Loading BI data from mock database...</p>
                </div>
            </div>
        );
    }

    if (error || !data) {
        return (
            <div className="min-h-screen p-6">
                <Card className="max-w-2xl mx-auto mt-20 border-destructive">
                    <CardContent className="pt-6 text-center">
                        <AlertTriangle className="w-12 h-12 text-destructive mx-auto mb-4" />
                        <h2 className="text-xl font-semibold mb-2">Database Not Found</h2>
                        <p className="text-muted-foreground mb-4">{error}</p>
                        <p className="text-sm text-muted-foreground">
                            Run: <code className="bg-muted px-2 py-1 rounded">python backend/mock_data_generator.py</code>
                        </p>
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
                    <Users className="w-6 h-6 text-primary" />
                    <h1 className="text-2xl font-bold">Audience Intelligence</h1>
                    <Badge variant="outline" className="ml-2">Mock Data</Badge>
                </div>
                <p className="text-muted-foreground text-sm">
                    Seat occupancy analytics and real-time marketing triggers
                </p>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
                <Card>
                    <CardContent className="pt-4">
                        <div className="flex items-center gap-2 text-muted-foreground text-xs">
                            <Building2 className="w-4 h-4" />
                            <span>Cities</span>
                        </div>
                        <p className="text-2xl font-bold">{data.stats.cities}</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-4">
                        <div className="flex items-center gap-2 text-muted-foreground text-xs">
                            <Target className="w-4 h-4" />
                            <span>Theatres</span>
                        </div>
                        <p className="text-2xl font-bold">{data.stats.theatres}</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-4">
                        <div className="flex items-center gap-2 text-muted-foreground text-xs">
                            <Film className="w-4 h-4" />
                            <span>Movies</span>
                        </div>
                        <p className="text-2xl font-bold">{data.stats.movies}</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-4">
                        <div className="flex items-center gap-2 text-muted-foreground text-xs">
                            <Clock className="w-4 h-4" />
                            <span>Showtimes</span>
                        </div>
                        <p className="text-2xl font-bold">{data.stats.showtimes.toLocaleString()}</p>
                    </CardContent>
                </Card>
                <Card className="bg-primary/10 border-primary/30">
                    <CardContent className="pt-4">
                        <div className="flex items-center gap-2 text-muted-foreground text-xs">
                            <TrendingDown className="w-4 h-4" />
                            <span>Avg Occupancy</span>
                        </div>
                        <p className="text-2xl font-bold">{data.stats.overall_occupancy}%</p>
                    </CardContent>
                </Card>
            </div>

            {/* Marketing Triggers Alert */}
            <Card className="mb-6 border-red-500/50 bg-red-500/5">
                <CardHeader className="py-3">
                    <CardTitle className="text-sm flex items-center gap-2 text-red-600 dark:text-red-400">
                        <AlertTriangle className="w-4 h-4" />
                        Real-Time Marketing Triggers
                        <Badge variant="destructive" className="ml-2">{data.marketingTriggers.length} Active</Badge>
                    </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                    <p className="text-xs text-muted-foreground mb-3">
                        Showtimes with &lt;30% occupancy - Push notification or flash sale recommended
                    </p>
                    <div className="overflow-x-auto max-h-[200px]">
                        <Table>
                            <TableHeader>
                                <TableRow className="text-xs">
                                    <TableHead>City</TableHead>
                                    <TableHead>Theatre</TableHead>
                                    <TableHead>Movie</TableHead>
                                    <TableHead>Time</TableHead>
                                    <TableHead>Occupancy</TableHead>
                                    <TableHead>Empty Seats</TableHead>
                                    <TableHead>Action</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {data.marketingTriggers.slice(0, 8).map((trigger, idx) => (
                                    <TableRow key={idx} className="text-sm">
                                        <TableCell className="font-medium">{trigger.city}</TableCell>
                                        <TableCell className="max-w-[150px] truncate">{trigger.theatre}</TableCell>
                                        <TableCell className="max-w-[150px] truncate">{trigger.movie}</TableCell>
                                        <TableCell className="font-mono">{trigger.show_time}</TableCell>
                                        <TableCell>
                                            <Badge variant="destructive" className="font-mono">
                                                {trigger.occupancy}%
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="font-mono">{trigger.empty_seats}</TableCell>
                                        <TableCell>
                                            <Badge variant="outline" className="text-xs cursor-pointer hover:bg-primary hover:text-primary-foreground">
                                                <Megaphone className="w-3 h-3 mr-1" />
                                                Push Sale
                                            </Badge>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>

            {/* Main Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                {/* Low-Performing Cities */}
                <Card>
                    <CardHeader className="py-3">
                        <CardTitle className="text-sm flex items-center gap-2">
                            <TrendingDown className="w-4 h-4 text-red-500" />
                            City Performance Ranking
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                        <Table>
                            <TableHeader>
                                <TableRow className="text-xs">
                                    <TableHead>City</TableHead>
                                    <TableHead>Region</TableHead>
                                    <TableHead>Theatres</TableHead>
                                    <TableHead>Occupancy</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {data.lowPerformingCities.map((city, idx) => (
                                    <TableRow key={city.name} className="text-sm">
                                        <TableCell className="font-medium">
                                            {idx < 3 && <span className="text-red-500 mr-1">⚠️</span>}
                                            {city.name}
                                        </TableCell>
                                        <TableCell className="text-muted-foreground">{city.region}</TableCell>
                                        <TableCell>{city.theatres}</TableCell>
                                        <TableCell>
                                            <OccupancyBar value={city.avg_occupancy} />
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>

                {/* Bottom Theatres */}
                <Card>
                    <CardHeader className="py-3">
                        <CardTitle className="text-sm flex items-center gap-2">
                            <Building2 className="w-4 h-4 text-amber-500" />
                            Bottom 10 Theatres
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                        <Table>
                            <TableHeader>
                                <TableRow className="text-xs">
                                    <TableHead>Theatre</TableHead>
                                    <TableHead>Chain</TableHead>
                                    <TableHead>City</TableHead>
                                    <TableHead>Occupancy</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {data.bottomTheatres.map((theatre) => (
                                    <TableRow key={theatre.name} className="text-sm">
                                        <TableCell className="font-medium max-w-[150px] truncate">
                                            {theatre.name}
                                        </TableCell>
                                        <TableCell>
                                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${theatre.chain === 'XXI' ? 'bg-amber-500/20 text-amber-600' :
                                                    theatre.chain === 'CGV' ? 'bg-red-500/20 text-red-600' :
                                                        'bg-blue-500/20 text-blue-600'
                                                }`}>
                                                {theatre.chain}
                                            </span>
                                        </TableCell>
                                        <TableCell>{theatre.city}</TableCell>
                                        <TableCell>
                                            <OccupancyBar value={theatre.avg_occupancy} />
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            </div>

            {/* Bottom Row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Time Slot Analysis */}
                <Card>
                    <CardHeader className="py-3">
                        <CardTitle className="text-sm flex items-center gap-2">
                            <Clock className="w-4 h-4 text-blue-500" />
                            Time Slot Analysis
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                        <div className="space-y-3">
                            {data.timeSlots.map((slot) => (
                                <div key={slot.time_slot} className="flex items-center justify-between">
                                    <span className="text-sm font-medium w-24">{slot.time_slot}</span>
                                    <div className="flex-1 mx-4">
                                        <div className="w-full h-4 bg-muted rounded-full overflow-hidden">
                                            <div
                                                className={`h-full ${slot.avg_occupancy >= 60 ? 'bg-green-500' :
                                                        slot.avg_occupancy >= 50 ? 'bg-amber-500' : 'bg-red-500'
                                                    }`}
                                                style={{ width: `${slot.avg_occupancy}%` }}
                                            />
                                        </div>
                                    </div>
                                    <span className="text-sm font-mono w-12 text-right">{slot.avg_occupancy}%</span>
                                </div>
                            ))}
                        </div>
                        <p className="text-xs text-muted-foreground mt-4">
                            💡 <strong>Insight:</strong> Morning shows underperform. Consider "Early Bird" discounts.
                        </p>
                    </CardContent>
                </Card>

                {/* Chain Performance */}
                <Card>
                    <CardHeader className="py-3">
                        <CardTitle className="text-sm flex items-center gap-2">
                            <Target className="w-4 h-4 text-purple-500" />
                            Chain Performance
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                        <Table>
                            <TableHeader>
                                <TableRow className="text-xs">
                                    <TableHead>Chain</TableHead>
                                    <TableHead>Sites</TableHead>
                                    <TableHead>Occ.</TableHead>
                                    <TableHead>Avg Price</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {data.chainPerformance.map((chain) => (
                                    <TableRow key={chain.chain} className="text-sm">
                                        <TableCell>
                                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${chain.chain === 'XXI' ? 'bg-amber-500 text-white' :
                                                    chain.chain === 'CGV' ? 'bg-red-600 text-white' :
                                                        'bg-blue-600 text-white'
                                                }`}>
                                                {chain.chain}
                                            </span>
                                        </TableCell>
                                        <TableCell>{chain.theatres}</TableCell>
                                        <TableCell>
                                            <OccupancyBar value={chain.avg_occupancy} />
                                        </TableCell>
                                        <TableCell className="font-mono text-xs">
                                            Rp{chain.avg_price.toLocaleString()}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>

                {/* Underperforming Movies */}
                <Card>
                    <CardHeader className="py-3">
                        <CardTitle className="text-sm flex items-center gap-2">
                            <Film className="w-4 h-4 text-orange-500" />
                            Movies Needing Push
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                        <Table>
                            <TableHeader>
                                <TableRow className="text-xs">
                                    <TableHead>Movie</TableHead>
                                    <TableHead>Genre</TableHead>
                                    <TableHead>Occupancy</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {data.underperformingMovies.map((movie) => (
                                    <TableRow key={movie.title} className="text-sm">
                                        <TableCell className="font-medium max-w-[120px] truncate" title={movie.title}>
                                            {movie.title}
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="outline" className="text-xs">{movie.genre}</Badge>
                                        </TableCell>
                                        <TableCell>
                                            <OccupancyBar value={movie.avg_occupancy} />
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                        <p className="text-xs text-muted-foreground mt-4">
                            💡 <strong>Action:</strong> TikTok challenges, group discounts, review incentives
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Actionable Insights */}
            <Card className="mt-6">
                <CardHeader className="py-3">
                    <CardTitle className="text-sm">💡 Actionable Marketing Playbook</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20">
                            <h4 className="font-semibold text-red-600 dark:text-red-400 mb-2">🎯 Flash Sales</h4>
                            <p className="text-xs text-muted-foreground">
                                Target theatres with &lt;30% occupancy 2 hours before showtime.
                                Push 20-30% discount via app notification.
                            </p>
                        </div>
                        <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/20">
                            <h4 className="font-semibold text-amber-600 dark:text-amber-400 mb-2">📱 Geo-Targeting</h4>
                            <p className="text-xs text-muted-foreground">
                                Low cities: Pontianak, Manado, Balikpapan.
                                Partner with local influencers, geo-fenced social ads.
                            </p>
                        </div>
                        <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/20">
                            <h4 className="font-semibold text-blue-600 dark:text-blue-400 mb-2">⏰ Early Bird</h4>
                            <p className="text-xs text-muted-foreground">
                                Morning slots (10-12) underperform at 50.6%.
                                Offer combo deals, lower base price for AM shows.
                            </p>
                        </div>
                        <div className="p-4 rounded-lg bg-purple-500/10 border border-purple-500/20">
                            <h4 className="font-semibold text-purple-600 dark:text-purple-400 mb-2">🎬 Movie Push</h4>
                            <p className="text-xs text-muted-foreground">
                                SIKSA NERAKA at 39.9% - needs promotion.
                                Review incentives, TikTok challenges, group tickets.
                            </p>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
