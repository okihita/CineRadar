/**
 * Region Breakdown Card component
 * Shows theatres by region with donut chart
 */
'use client';

import { Card } from '@/components/ui/card';
import { REGION_COLORS } from '@/lib/constants';
import { DonutChart } from './DonutChart';
import type { RegionBreakdown } from '../types';

interface RegionBreakdownCardProps {
    regionBreakdown: RegionBreakdown[];
    totalTheatres: number;
}

export function RegionBreakdownCard({ regionBreakdown, totalTheatres }: RegionBreakdownCardProps) {
    return (
        <Card className="p-3">
            <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-muted-foreground">THEATRES BY REGION</p>
                <p className="text-lg font-bold font-mono">{totalTheatres}</p>
            </div>

            {/* Donut Chart */}
            <div className="flex justify-center mb-3">
                <DonutChart data={regionBreakdown} total={totalTheatres} />
            </div>

            {/* Legend */}
            <div className="space-y-1 text-xs">
                {regionBreakdown.map((r, i) => {
                    const percentage = Math.round((r.count / (totalTheatres || 1)) * 100);
                    return (
                        <div key={r.name} className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <span
                                    className="w-2.5 h-2.5 rounded-sm flex-shrink-0"
                                    style={{ backgroundColor: REGION_COLORS[i] }}
                                />
                                <span className="text-muted-foreground">{r.name}</span>
                            </div>
                            <span className="font-mono text-foreground">
                                {r.count} <span className="text-muted-foreground">({percentage}%)</span>
                            </span>
                        </div>
                    );
                })}
            </div>
        </Card>
    );
}
