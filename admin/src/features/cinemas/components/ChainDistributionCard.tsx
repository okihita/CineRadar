/**
 * Chain Distribution Card component
 * Shows theatre distribution by chain across regions
 */
'use client';

import { Card } from '@/components/ui/card';
import { CHAIN_COLORS } from '@/lib/constants';
import { getRegion } from '@/lib/regions';
import type { Theatre, RegionBreakdown } from '../types';

interface ChainDistributionCardProps {
    theatres: Theatre[];
    regionBreakdown: RegionBreakdown[];
}

export function ChainDistributionCard({ theatres, regionBreakdown }: ChainDistributionCardProps) {
    // Indonesia total
    const xxiTotal = theatres.filter((t) => t.merchant === 'XXI').length;
    const cgvTotal = theatres.filter((t) => t.merchant === 'CGV').length;
    const cineTotal = theatres.filter((t) => t.merchant === 'Cinépolis').length;
    const total = theatres.length || 1;

    return (
        <Card className="p-3">
            <p className="text-xs text-muted-foreground mb-2">CHAIN DISTRIBUTION</p>
            <div className="space-y-2.5 text-sm">
                {/* Indonesia total row */}
                <div className="pb-2 border-b border-border/50 mb-2">
                    <div className="flex justify-between mb-1">
                        <span className="font-medium text-foreground">Indonesia</span>
                        <span className="font-mono font-bold">{theatres.length}</span>
                    </div>
                    <div className="flex h-2.5 rounded-full overflow-hidden bg-muted mb-1.5">
                        <div style={{ width: `${(xxiTotal / total) * 100}%`, backgroundColor: CHAIN_COLORS.XXI }} />
                        <div style={{ width: `${(cgvTotal / total) * 100}%`, backgroundColor: CHAIN_COLORS.CGV }} />
                        <div style={{ width: `${(cineTotal / total) * 100}%`, backgroundColor: CHAIN_COLORS.Cinépolis }} />
                    </div>
                    <div className="flex justify-between text-xs">
                        <span style={{ color: CHAIN_COLORS.XXI }}>XXI: {xxiTotal}</span>
                        <span style={{ color: CHAIN_COLORS.CGV }}>CGV: {cgvTotal}</span>
                        <span style={{ color: CHAIN_COLORS.Cinépolis }}>Cinépolis: {cineTotal}</span>
                    </div>
                </div>

                {/* Region rows */}
                {regionBreakdown.map((r) => {
                    const regionTheatres = theatres.filter((t) => getRegion(t.city) === r.name);
                    const xxi = regionTheatres.filter((t) => t.merchant === 'XXI').length;
                    const cgv = regionTheatres.filter((t) => t.merchant === 'CGV').length;
                    const cine = regionTheatres.filter((t) => t.merchant === 'Cinépolis').length;
                    const regionTotal = regionTheatres.length || 1;

                    return (
                        <div key={r.name}>
                            <div className="flex justify-between mb-0.5 text-xs">
                                <span className="text-muted-foreground">{r.name}</span>
                                <div className="flex gap-2 font-mono">
                                    <span style={{ color: CHAIN_COLORS.XXI }}>{xxi}</span>
                                    <span style={{ color: CHAIN_COLORS.CGV }}>{cgv}</span>
                                    <span style={{ color: CHAIN_COLORS.Cinépolis }}>{cine}</span>
                                    <span className="text-foreground font-medium">{r.count}</span>
                                </div>
                            </div>
                            <div className="flex h-2 rounded-full overflow-hidden bg-muted">
                                <div style={{ width: `${(xxi / regionTotal) * 100}%`, backgroundColor: CHAIN_COLORS.XXI }} />
                                <div style={{ width: `${(cgv / regionTotal) * 100}%`, backgroundColor: CHAIN_COLORS.CGV }} />
                                <div style={{ width: `${(cine / regionTotal) * 100}%`, backgroundColor: CHAIN_COLORS.Cinépolis }} />
                            </div>
                        </div>
                    );
                })}
            </div>
        </Card>
    );
}
