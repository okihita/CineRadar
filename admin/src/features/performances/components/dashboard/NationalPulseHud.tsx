'use client';

import React from 'react';
import { Activity, Target, Users, Zap, Globe } from 'lucide-react';
import { formatCompactNumber } from '../../utils/format';
import { ForensicHealthSheet } from '../ForensicHealthSheet';
import { DiagnosticData } from '../../types/performance';

interface NationalPulseHudProps {
    avgOCR: number;
    totalSold: number;
    totalShows: number;
    activeCount: number;
    diagnostic?: DiagnosticData | null;
    telemetry?: { elapsed: number; size: number } | null;
}

export function NationalPulseHud({ 
    avgOCR, 
    totalSold, 
    totalShows, 
    activeCount,
    diagnostic,
    telemetry
}: NationalPulseHudProps) {
    return (
        <div className="flex flex-wrap items-center gap-6 px-6 py-4 bg-muted/20 border border-border/40 rounded-2xl shadow-sm">
            <div className="flex items-center gap-3 pr-6 border-r border-border/30">
                <div className="relative">
                    <Activity className="w-5 h-5 text-green-500 animate-pulse" />
                    <div className="absolute inset-0 bg-green-500/20 blur-md rounded-full animate-pulse" />
                </div>
                <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 leading-none mb-1">National Pulse Today</p>
                    <div className="flex items-center gap-2">
                        <div className="text-xs font-bold text-green-600 uppercase tracking-tight flex items-center gap-1.5">
                            <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                            Live
                        </div>
                        {telemetry && (
                            <div className="text-[9px] font-mono text-muted-foreground px-1.5 py-0.5 bg-background/50 rounded border border-border/30">
                                {telemetry.elapsed.toFixed(2)}s | {telemetry.size.toFixed(0)}KB
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <div className="flex items-center gap-8">
                <div className="flex flex-col">
                    <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/50 mb-0.5 flex items-center gap-1.5">
                        <Target className="w-2.5 h-2.5" /> Market OCR
                    </span>
                    <span className="text-xl font-black font-mono tracking-tighter text-foreground">
                        {avgOCR.toFixed(1)}<span className="text-xs opacity-30 ml-0.5">%</span>
                    </span>
                </div>

                <div className="flex flex-col">
                    <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/50 mb-0.5 flex items-center gap-1.5">
                        <Users className="w-2.5 h-2.5" /> Total Sales
                    </span>
                    <span className="text-xl font-black font-mono tracking-tighter text-foreground">
                        {formatCompactNumber(totalSold)}
                    </span>
                </div>

                <div className="flex flex-col">
                    <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/50 mb-0.5 flex items-center gap-1.5">
                        <Zap className="w-2.5 h-2.5" /> Active Shows
                    </span>
                    <span className="text-xl font-black font-mono tracking-tighter text-foreground">
                        {totalShows.toLocaleString()}
                    </span>
                </div>
            </div>

            <div className="ml-auto flex items-center gap-4">
                <div className="flex items-center gap-2 px-3 py-1.5 bg-background/50 rounded-xl border border-border/50">
                    <Globe className="w-3.5 h-3.5 text-primary opacity-60" />
                    <span className="text-[10px] font-black uppercase tracking-widest opacity-60">{activeCount} Active Titles</span>
                </div>
                {diagnostic && <ForensicHealthSheet diagnostic={diagnostic} />}
            </div>
        </div>
    );
}
