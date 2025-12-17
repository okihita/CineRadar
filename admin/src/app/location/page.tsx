'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/PageHeader';
import { Navigation, MapPin, Building2, Users, TrendingUp } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface LocationData {
    theatreDensity: Array<{ city: string; region: string; population: number; theatres: number; per_100k: number; seats_per_1k: number }>;
    competitorProximity: Array<{ city: string; xxi: number; cgv: number; cinepolis: number; total: number }>;
    underserved: Array<{ city: string; region: string; population: number; theatres: number; per_100k: number; gap: number }>;
    theatreAge: Array<{ age_group: string; count: number; avg_seats: number }>;
    recommendations: Array<{ city: string; region: string; population: number; current_theatres: number; recommended_min: number; additional_needed: number }>;
}

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444'];

export default function LocationPage() {
    const [data, setData] = useState<LocationData | null>(null);
    const [loading, setLoading] = useState(true);
    const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

    const fetchData = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/location');
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

    return (
        <div className="min-h-screen bg-background text-foreground p-4 md:p-6">
            <PageHeader
                title="Location Intelligence"
                description="Catchment analysis, market gaps, and expansion opportunities"
                icon={<Navigation className="w-6 h-6 text-cyan-500" />}
                lastUpdated={lastUpdated.toLocaleTimeString()}
                onRefresh={fetchData}
                isRefreshing={loading}
            />

            {/* Theatre Density Chart */}
            <Card className="mb-6">
                <CardHeader className="py-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-green-500" />
                        Theatre Density (per 100K population)
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={data.theatreDensity} layout="vertical" margin={{ left: 80 }}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis type="number" />
                                <YAxis dataKey="city" type="category" tick={{ fontSize: 12 }} width={80} />
                                <Tooltip formatter={(value: number) => [value.toFixed(2), 'per 100K']} />
                                <Bar dataKey="per_100k" fill="#10b981" radius={[0, 4, 4, 0]}>
                                    {data.theatreDensity.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.per_100k > 1 ? '#10b981' : entry.per_100k > 0.5 ? '#f59e0b' : '#ef4444'} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </CardContent>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                {/* Competitor Presence */}
                <Card>
                    <CardHeader className="py-3">
                        <CardTitle className="text-sm flex items-center gap-2">
                            <Building2 className="w-4 h-4 text-purple-500" />
                            Chain Presence by City
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                        <Table>
                            <TableHeader>
                                <TableRow className="text-xs">
                                    <TableHead>City</TableHead>
                                    <TableHead className="text-center">XXI</TableHead>
                                    <TableHead className="text-center">CGV</TableHead>
                                    <TableHead className="text-center">Cinépolis</TableHead>
                                    <TableHead className="text-center">Total</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {data.competitorProximity.map((city) => (
                                    <TableRow key={city.city}>
                                        <TableCell className="font-medium">{city.city}</TableCell>
                                        <TableCell className="text-center"><Badge variant="outline" className="bg-amber-500/20">{city.xxi}</Badge></TableCell>
                                        <TableCell className="text-center"><Badge variant="outline" className="bg-red-500/20">{city.cgv}</Badge></TableCell>
                                        <TableCell className="text-center"><Badge variant="outline" className="bg-blue-500/20">{city.cinepolis}</Badge></TableCell>
                                        <TableCell className="text-center font-bold">{city.total}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>

                {/* Theatre Age Distribution */}
                <Card>
                    <CardHeader className="py-3">
                        <CardTitle className="text-sm flex items-center gap-2">
                            <TrendingUp className="w-4 h-4 text-blue-500" />
                            Theatre Age Distribution
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="h-[200px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={data.theatreAge}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis dataKey="age_group" tick={{ fontSize: 10 }} />
                                    <YAxis />
                                    <Tooltip />
                                    <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]}>
                                        {data.theatreAge.map((_, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Expansion Recommendations */}
            <Card className="border-green-500/30">
                <CardHeader className="py-3">
                    <CardTitle className="text-sm flex items-center gap-2 text-green-600">
                        <TrendingUp className="w-4 h-4" />
                        Expansion Opportunities
                    </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                    <Table>
                        <TableHeader>
                            <TableRow className="text-xs">
                                <TableHead>City</TableHead>
                                <TableHead>Region</TableHead>
                                <TableHead>Population</TableHead>
                                <TableHead>Current</TableHead>
                                <TableHead>Recommended</TableHead>
                                <TableHead>Gap</TableHead>
                                <TableHead>Action</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {data.recommendations.filter(r => r.additional_needed > 0).map((rec) => (
                                <TableRow key={rec.city}>
                                    <TableCell className="font-medium">📍 {rec.city}</TableCell>
                                    <TableCell>{rec.region}</TableCell>
                                    <TableCell className="font-mono">{(rec.population / 1000000).toFixed(1)}M</TableCell>
                                    <TableCell className="font-mono">{rec.current_theatres}</TableCell>
                                    <TableCell className="font-mono">{rec.recommended_min}</TableCell>
                                    <TableCell className="font-mono text-green-600">+{rec.additional_needed}</TableCell>
                                    <TableCell>
                                        <Badge variant="default" className="bg-green-600 text-xs">Expand</Badge>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}
