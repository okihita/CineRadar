'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/PageHeader';
import { Heart, Gift, Users, TrendingUp, MessageSquare, TestTube } from 'lucide-react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie } from 'recharts';

interface EngagementData {
    promoPerformance: Array<{ promo_type: string; campaigns: number; redemptions: number; revenue_impact: number; roi: string }>;
    channelEffectiveness: Array<{ channel: string; sent: number; opened: number; clicked: number; converted: number; open_rate: string; ctr: string; conversion_rate: string }>;
    loyaltyTiers: Array<{ tier: string; members: number; avg_visits_month: number; avg_spend: number; churn_risk: string }>;
    clvSegments: Array<{ segment: string; members: number; avg_clv: number; annual_revenue: number }>;
    abTests: Array<{ test_name: string; variant_a: string; variant_b: string; metric: string; result_a: string; result_b: string; winner: string; lift: string }>;
    engagementTrend: Array<{ month: string; active_members: number; app_opens: number; purchases: number }>;
}

const TIER_COLORS: Record<string, string> = {
    'Bronze': '#CD7F32',
    'Silver': '#C0C0C0',
    'Gold': '#FFD700',
    'Platinum': '#E5E4E2',
};

export default function EngagementPage() {
    const [data, setData] = useState<EngagementData | null>(null);
    const [loading, setLoading] = useState(true);
    const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

    const fetchData = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/engagement');
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
                title="Engagement Intelligence"
                description="Loyalty programs, promotions, and customer lifetime value"
                icon={<Heart className="w-6 h-6 text-pink-500" />}
                lastUpdated={lastUpdated.toLocaleTimeString()}
                onRefresh={fetchData}
                isRefreshing={loading}
            />

            {/* Engagement Trend */}
            <Card className="mb-6">
                <CardHeader className="py-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                        <TrendingUp className="w-4 h-4 text-blue-500" />
                        Engagement Trend (12 months)
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="h-[250px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={data.engagementTrend}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                                <YAxis />
                                <Tooltip />
                                <Line type="monotone" dataKey="active_members" stroke="#3b82f6" strokeWidth={2} name="Active Members" />
                                <Line type="monotone" dataKey="purchases" stroke="#10b981" strokeWidth={2} name="Purchases" />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </CardContent>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                {/* Loyalty Tiers */}
                <Card>
                    <CardHeader className="py-3">
                        <CardTitle className="text-sm flex items-center gap-2">
                            <Users className="w-4 h-4 text-amber-500" />
                            Loyalty Tier Distribution
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                        <Table>
                            <TableHeader>
                                <TableRow className="text-xs">
                                    <TableHead>Tier</TableHead>
                                    <TableHead>Members</TableHead>
                                    <TableHead>Visits/Mo</TableHead>
                                    <TableHead>Avg Spend</TableHead>
                                    <TableHead>Churn Risk</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {data.loyaltyTiers.map((tier) => (
                                    <TableRow key={tier.tier}>
                                        <TableCell>
                                            <span className="inline-flex items-center gap-2">
                                                <span className="w-3 h-3 rounded-full" style={{ backgroundColor: TIER_COLORS[tier.tier] || '#888' }} />
                                                <span className="font-medium">{tier.tier}</span>
                                            </span>
                                        </TableCell>
                                        <TableCell className="font-mono">{tier.members.toLocaleString()}</TableCell>
                                        <TableCell className="font-mono">{tier.avg_visits_month}</TableCell>
                                        <TableCell className="font-mono">Rp{(tier.avg_spend / 1000).toFixed(0)}K</TableCell>
                                        <TableCell>
                                            <Badge variant={tier.churn_risk === 'Very Low' || tier.churn_risk === 'Low' ? 'default' : tier.churn_risk === 'Medium' ? 'secondary' : 'destructive'}
                                                className={tier.churn_risk === 'Very Low' || tier.churn_risk === 'Low' ? 'bg-green-600' : tier.churn_risk === 'Medium' ? 'bg-amber-500' : ''}>
                                                {tier.churn_risk}
                                            </Badge>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>

                {/* CLV Segments */}
                <Card>
                    <CardHeader className="py-3">
                        <CardTitle className="text-sm flex items-center gap-2">
                            <Gift className="w-4 h-4 text-purple-500" />
                            Customer Lifetime Value Segments
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="h-[180px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={data.clvSegments} layout="vertical" margin={{ left: 100 }}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis type="number" tickFormatter={(v) => `Rp${(v / 1000000).toFixed(0)}M`} />
                                    <YAxis dataKey="segment" type="category" tick={{ fontSize: 11 }} width={100} />
                                    <Tooltip formatter={(v: number) => [`Rp${(v / 1000000).toFixed(1)}M`, 'CLV']} />
                                    <Bar dataKey="avg_clv" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                {/* Promo Performance */}
                <Card>
                    <CardHeader className="py-3">
                        <CardTitle className="text-sm flex items-center gap-2">
                            <Gift className="w-4 h-4 text-green-500" />
                            Promotion Performance
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                        <Table>
                            <TableHeader>
                                <TableRow className="text-xs">
                                    <TableHead>Type</TableHead>
                                    <TableHead>Campaigns</TableHead>
                                    <TableHead>Redemptions</TableHead>
                                    <TableHead>Revenue</TableHead>
                                    <TableHead>ROI</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {data.promoPerformance.map((promo) => (
                                    <TableRow key={promo.promo_type}>
                                        <TableCell className="font-medium">{promo.promo_type}</TableCell>
                                        <TableCell className="font-mono">{promo.campaigns}</TableCell>
                                        <TableCell className="font-mono">{promo.redemptions.toLocaleString()}</TableCell>
                                        <TableCell className="font-mono">Rp{(promo.revenue_impact / 1000000).toFixed(0)}M</TableCell>
                                        <TableCell>
                                            <Badge variant="default" className="bg-green-600">{promo.roi}</Badge>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>

                {/* Channel Effectiveness */}
                <Card>
                    <CardHeader className="py-3">
                        <CardTitle className="text-sm flex items-center gap-2">
                            <MessageSquare className="w-4 h-4 text-blue-500" />
                            Channel Effectiveness
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                        <Table>
                            <TableHeader>
                                <TableRow className="text-xs">
                                    <TableHead>Channel</TableHead>
                                    <TableHead>Sent</TableHead>
                                    <TableHead>Open Rate</TableHead>
                                    <TableHead>CTR</TableHead>
                                    <TableHead>Conv.</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {data.channelEffectiveness.map((ch) => (
                                    <TableRow key={ch.channel}>
                                        <TableCell className="font-medium">{ch.channel}</TableCell>
                                        <TableCell className="font-mono text-xs">{(ch.sent / 1000).toFixed(1)}K</TableCell>
                                        <TableCell className="font-mono text-xs">{ch.open_rate}%</TableCell>
                                        <TableCell className="font-mono text-xs">{ch.ctr}%</TableCell>
                                        <TableCell className="font-mono text-xs">{ch.conversion_rate}%</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            </div>

            {/* A/B Test Results */}
            <Card className="border-pink-500/30">
                <CardHeader className="py-3">
                    <CardTitle className="text-sm flex items-center gap-2 text-pink-600">
                        <TestTube className="w-4 h-4" />
                        A/B Test Results
                    </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                    <Table>
                        <TableHeader>
                            <TableRow className="text-xs">
                                <TableHead>Test Name</TableHead>
                                <TableHead>Variant A</TableHead>
                                <TableHead>Variant B</TableHead>
                                <TableHead>Metric</TableHead>
                                <TableHead>Result A</TableHead>
                                <TableHead>Result B</TableHead>
                                <TableHead>Winner</TableHead>
                                <TableHead>Lift</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {data.abTests.map((test) => (
                                <TableRow key={test.test_name}>
                                    <TableCell className="font-medium">{test.test_name}</TableCell>
                                    <TableCell className="text-xs">{test.variant_a}</TableCell>
                                    <TableCell className="text-xs">{test.variant_b}</TableCell>
                                    <TableCell className="text-xs">{test.metric}</TableCell>
                                    <TableCell className={`font-mono text-xs ${test.winner === 'A' ? 'text-green-600 font-bold' : ''}`}>{test.result_a}</TableCell>
                                    <TableCell className={`font-mono text-xs ${test.winner === 'B' ? 'text-green-600 font-bold' : ''}`}>{test.result_b}</TableCell>
                                    <TableCell>
                                        <Badge variant="default" className="bg-green-600">
                                            Variant {test.winner}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="font-mono text-green-600">{test.lift}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                    <p className="text-xs text-muted-foreground mt-3 p-3 bg-muted/50 rounded-lg">
                        💡 <strong>Action:</strong> Implement winning variants. Flash Sales work best 1 hour before showtime (+62% conversion). CTA buttons perform better in red (+14%).
                    </p>
                </CardContent>
            </Card>
        </div>
    );
}
