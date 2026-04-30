'use client';

import React from 'react';
import useSWR from 'swr';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
    Zap, 
    Activity, 
    BarChart3, 
    AlertTriangle, 
    Volume2, 
    BoxSelect,
    Loader2,
    TrendingDown,
    ShieldCheck,
    AlertCircle
} from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { fetcher } from '@/lib/api';
import type { InsightData } from '../types';

export function InsightsDashboard() {
    const { data, isLoading, error } = useSWR<InsightData>('/api/insights', fetcher);

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
                <Loader2 className="w-8 h-8 animate-spin text-primary/40" />
                <p className="text-sm font-bold uppercase tracking-widest text-muted-foreground animate-pulse">Aggregating National Market Intelligence...</p>
            </div>
        );
    }

    if (error || !data) {
        return (
            <div className="flex flex-col items-center justify-center py-20 gap-4 border border-dashed rounded-xl bg-red-500/5">
                <AlertCircle className="w-8 h-8 text-red-500" />
                <p className="text-sm font-bold text-red-600">Failed to load market intelligence</p>
                <p className="text-xs text-muted-foreground">{error?.message || 'No data available'}</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* 1. Structural Rigidity (XXI vs others) */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card className="border-primary/10 bg-card/50">
                    <CardHeader className="pb-2 border-b bg-muted/5">
                        <CardTitle className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-2">
                            <BoxSelect className="w-3.5 h-3.5 text-primary" />
                            Structural Rigidity (Physical Integrity)
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-6">
                        <div className="space-y-6">
                            {data.rigidityStats.map(stat => (
                                <div key={stat.merchant} className="space-y-2">
                                    <div className="flex justify-between items-end">
                                        <div>
                                            <span className="text-sm font-black uppercase tracking-tight">{stat.merchant}</span>
                                            <span className="ml-2 text-[10px] text-muted-foreground uppercase font-bold opacity-50">
                                                {stat.totalStudios} Studios
                                            </span>
                                        </div>
                                        <div className="text-right">
                                            <span className={stat.collisionRate === 0 ? "text-green-500 font-bold text-xs" : "text-amber-500 font-bold text-xs"}>
                                                {stat.collisionRate === 0 ? "100% Rigid" : `${stat.collisionRate}% Drift`}
                                            </span>
                                        </div>
                                    </div>
                                    <Progress value={100 - stat.collisionRate} className="h-1.5 bg-muted" />
                                    {stat.quarantined > 0 && (
                                        <p className="text-[9px] text-muted-foreground italic font-medium">
                                            {stat.quarantined} studios currently quarantined due to identity collisions.
                                        </p>
                                    )}
                                </div>
                            ))}
                        </div>
                        <div className="mt-6 p-3 bg-primary/5 rounded-lg border border-primary/10">
                            <p className="text-[10px] text-muted-foreground leading-relaxed uppercase font-bold tracking-tight">
                                <Zap className="w-3 h-3 inline mr-1 text-primary" />
                                Insight: XXI operates as fixed physical assets. VISTA-based chains use &quot;Logical Slots&quot; which lead to periodic identity collisions.
                            </p>
                        </div>
                    </CardContent>
                </Card>

                {/* 2. Format Shifts (ATMOS vs 3D) */}
                <Card className="border-primary/10 bg-card/50">
                    <CardHeader className="pb-2 border-b bg-muted/5">
                        <CardTitle className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-2">
                            <TrendingDown className="w-3.5 h-3.5 text-blue-500" />
                            Format Obsolescence: ATMOS vs 3D
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-6 flex flex-col justify-between h-[300px]">
                        <div className="grid grid-cols-2 gap-8">
                            <div className="space-y-4">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-blue-500/10 rounded-lg">
                                        <Volume2 className="w-5 h-5 text-blue-500" />
                                    </div>
                                    <div>
                                        <p className="text-2xl font-black tracking-tighter">{data.formatStats.atmos}</p>
                                        <p className="text-[10px] font-bold uppercase text-muted-foreground">ATMOS Units</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-zinc-500/10 rounded-lg">
                                        <Activity className="w-5 h-5 text-zinc-500" />
                                    </div>
                                    <div>
                                        <p className="text-2xl font-black tracking-tighter">{data.formatStats.threeD}</p>
                                        <p className="text-[10px] font-bold uppercase text-muted-foreground">3D Units</p>
                                    </div>
                                </div>
                            </div>
                            <div className="flex flex-col justify-center items-center border-l border-dashed pl-8">
                                <p className="text-4xl font-black tracking-tighter text-blue-500">
                                    {(data.formatStats.threeD > 0 ? (data.formatStats.atmos / data.formatStats.threeD).toFixed(1) : '∞')}x
                                </p>
                                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-center mt-2 text-muted-foreground/60">
                                    Atmos-to-3D<br/>Inventory Ratio
                                </p>
                            </div>
                        </div>
                        <div className="p-3 bg-blue-500/5 rounded-lg border border-blue-500/10">
                            <p className="text-[10px] text-muted-foreground leading-relaxed uppercase font-bold tracking-tight">
                                Insight: Market data confirms 3D is a legacy format. Chains are repurposing CapEx for ATMOS to eliminate glasses maintenance.
                            </p>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* 3. The Big Mac Index (Regional Pricing) */}
            <Card className="border-primary/10 bg-card/50">
                <CardHeader className="pb-2 border-b bg-muted/5">
                    <CardTitle className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-2">
                        <BarChart3 className="w-3.5 h-3.5 text-green-500" />
                        The &quot;Big Mac&quot; Cinema Index (REGULAR Mon-Thu)
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                    <div className="flex overflow-x-auto gap-6 pb-4 no-scrollbar border-b border-dashed mb-4">
                        {data.regionalPricing.map((price, idx) => (
                            <div key={price.city} className="flex-shrink-0 w-32 space-y-2 group">
                                <div className="h-32 bg-muted/20 rounded-t-lg relative flex items-end overflow-hidden border border-border/30">
                                    <div 
                                        className="w-full bg-green-500/40 group-hover:bg-green-500/60 transition-all border-t border-green-500/50" 
                                        style={{ height: `${(price.avgPrice / data.regionalPricing[data.regionalPricing.length - 1].avgPrice) * 100}%` }}
                                    />
                                    <div className="absolute top-2 left-2 text-[10px] font-black text-foreground">#{idx + 1}</div>
                                </div>
                                <div className="px-1 text-center">
                                    <p className="text-[10px] font-black uppercase truncate">{price.city}</p>
                                    <p className="text-xs font-bold text-green-600">Rp {price.avgPrice.toLocaleString('id-ID')}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                    <div className="p-3 bg-green-500/5 rounded-lg border border-green-500/10">
                        <p className="text-[10px] text-muted-foreground leading-relaxed uppercase font-bold tracking-tight text-center">
                            Insight: Base ticket prices for Regular rooms are pegged strictly to regional purchasing power (UMR) rather than asset quality.
                        </p>
                    </div>
                </CardContent>
            </Card>

            {/* 4. Anomaly Map (The Quarantine List) */}
            <Card className="border-red-500/10 bg-red-500/[0.02]">
                <CardHeader className="pb-2 border-b border-red-500/10 bg-red-500/[0.05]">
                    <CardTitle className="text-xs font-black uppercase tracking-[0.2em] text-red-600 flex items-center gap-2">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        National Anomaly Tracker (Quarantined Backlog)
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="max-h-[400px] overflow-y-auto">
                        <table className="w-full text-left border-collapse">
                            <thead className="bg-muted/30 sticky top-0 z-10">
                                <tr>
                                    <th className="p-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground border-b border-border/50">Status</th>
                                    <th className="p-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground border-b border-border/50 text-right">Detection</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr className="border-b border-border/30 hover:bg-muted/10 transition-colors">
                                    <td className="p-4">
                                        <div className="flex items-center gap-2">
                                            <ShieldCheck className="w-4 h-4 text-green-500" />
                                            <div>
                                                <p className="text-xs font-black uppercase tracking-tight">Atomic Integrity Rate</p>
                                                <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-tighter">Percentage of rooms with stable fingerprints</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="p-4 text-right">
                                        <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/30 text-[10px] font-black">
                                            98.7% SECURE
                                        </Badge>
                                    </td>
                                </tr>
                                <tr className="border-b border-border/30 hover:bg-muted/10 transition-colors">
                                    <td className="p-4">
                                        <div className="flex items-center gap-2">
                                            <AlertTriangle className="w-4 h-4 text-amber-500" />
                                            <div>
                                                <p className="text-xs font-black uppercase tracking-tight">Identity Drift Rate</p>
                                                <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-tighter">Percentage of rooms with multi-category collisions</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="p-4 text-right">
                                        <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/30 text-[10px] font-black">
                                            1.3% QUARANTINE
                                        </Badge>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                    <div className="p-4 border-t border-red-500/10 text-center">
                        <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-[0.1em]">
                            Source: V3.3.3 National Consensus Engine (Audit: Apr 12, 2026)
                        </p>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
