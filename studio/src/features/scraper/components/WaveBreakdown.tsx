'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { JITSummary, WaveStats } from '../types';
import { CheckCircle2, XCircle, Info } from 'lucide-react';

interface WaveBreakdownProps {
    summary: JITSummary | null | undefined;
}

const WaveProgress = ({ label, stats, description }: { label: string; stats: WaveStats; description: string }) => {
    return (
        <div className="space-y-3">
            <div className="flex justify-between items-end">
                <div>
                    <h4 className="font-bold text-sm">{label}</h4>
                    <p className="text-xs text-muted-foreground">{description}</p>
                </div>
                <div className="text-right">
                    <span className="text-lg font-bold">{stats.rate}%</span>
                </div>
            </div>
            
            <Progress value={stats.rate} className="h-2" />
            
            <div className="grid grid-cols-2 gap-2 pt-1">
                <div className="flex items-center gap-1.5 text-xs">
                    <CheckCircle2 className="w-3 h-3 text-green-500" />
                    <span className="text-muted-foreground">Success:</span>
                    <span className="font-medium">{stats.success.toLocaleString()}</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs">
                    <XCircle className="w-3 h-3 text-red-500" />
                    <span className="text-muted-foreground">Errors:</span>
                    <span className="font-medium">{stats.error.toLocaleString()}</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs col-span-2">
                    <Info className="w-3 h-3 text-blue-500" />
                    <span className="text-muted-foreground">Found in Window:</span>
                    <span className="font-medium">{stats.found.toLocaleString()}</span>
                </div>
            </div>
        </div>
    );
};

export const WaveBreakdown = ({ summary }: WaveBreakdownProps) => {
    if (!summary || !summary.waveBreakdown) {
        return null;
    }

    const { t30, t20, t10 } = summary.waveBreakdown;

    return (
        <Card className="col-span-full">
            <CardHeader className="pb-4">
                <CardTitle className="text-base flex items-center gap-2">
                    Wave Performance Breakdown
                </CardTitle>
                <CardDescription>
                    Real-time success rates for each of the three scraping waves before showtime.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    <WaveProgress 
                        label="T-30 Wave" 
                        stats={t30} 
                        description="Initial snapshot (30m before)" 
                    />
                    <WaveProgress 
                        label="T-20 Wave" 
                        stats={t20} 
                        description="Mid-range trend (20m before)" 
                    />
                    <WaveProgress 
                        label="T-10 Wave" 
                        stats={t10} 
                        description="Final pre-show (10m before)" 
                    />
                </div>
            </CardContent>
        </Card>
    );
};
