'use client';

import { useEffect } from 'react';
import { useTheatreStudios, type PerformanceMetrics } from '../hooks/useTheatreStudios';
import { StudioLayoutViewer } from './StudioLayoutViewer';
import { AlertCircle, Search, Star, Loader2, Calendar, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

import { getStudioDisplayName } from '../utils';

interface TheatreStudiosListProps {
    theatreId: string;
    merchant?: string;
    onMetricsLoad?: (metrics: PerformanceMetrics) => void;
}

export function TheatreStudiosList({ theatreId, merchant, onMetricsLoad }: TheatreStudiosListProps) {
    const { studios, isLoading, isError, metrics } = useTheatreStudios(theatreId);

    useEffect(() => {
        if (metrics && onMetricsLoad) {
            onMetricsLoad(metrics);
        }
    }, [metrics, onMetricsLoad]);

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center py-20 bg-muted/5 border border-dashed rounded-2xl gap-4">
                <Loader2 className="w-8 h-8 animate-spin text-primary/40" />
                <div className="text-center">
                    <p className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Scanning Physical Registry</p>
                    <p className="text-[10px] text-muted-foreground/60 italic mt-1 font-mono">Querying Firestore collection group...</p>
                </div>
            </div>
        );
    }

    if (isError) {
        return (
            <div className="flex flex-col items-center justify-center py-12 bg-red-500/5 border border-red-500/20 rounded-2xl gap-3">
                <AlertCircle className="w-6 h-6 text-red-500" />
                <p className="text-sm font-bold text-red-600 uppercase tracking-tighter">Registry Query Failed</p>
            </div>
        );
    }

    if (studios.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-12 bg-muted/10 border border-dashed rounded-2xl">
                <p className="text-sm text-muted-foreground italic font-medium uppercase tracking-widest opacity-50">No physical assets mapped</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {studios.map(studio => {
                    const evidence = studio.evidence || [];
                    const sampleCount = evidence.length;
                    const isVerified = sampleCount > 0;
                    const isIdeal = sampleCount >= 7;
                    const isV3 = (studio.version || 0) >= 3.2;
                    const totalCapacity = studio.physical_layout?.total_capacity || 0;
                    
                    let evidenceSpan = 'No history recorded';
                    if (evidence.length > 0) {
                        const dates = evidence.map(e => e.date).sort();
                        const first = new Date(dates[0]).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                        const last = new Date(dates[dates.length - 1]).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                        evidenceSpan = `${first} — ${last}`;
                    }
                    
                    return (
                        <div key={studio.id} className="group flex flex-col h-full border rounded-xl overflow-hidden bg-card/30 shadow-sm hover:shadow-md transition-all">
                            <div className="flex items-start justify-between p-4 bg-muted/10 border-b min-h-[72px]">
                                {/* LEFT SIDE: Operational Context (High Contrast) */}
                                <div className="space-y-1">
                                    <div className="flex items-center gap-2">
                                        <span className="font-black text-foreground text-sm uppercase tracking-tight">
                                            {getStudioDisplayName(studio, merchant)}
                                            {totalCapacity > 0 && (
                                                <span className="ml-2 text-muted-foreground/60 font-medium">({totalCapacity} seats)</span>
                                            )}
                                        </span>
                                        {!isV3 && (
                                            <span title="Legacy V2 Layout">
                                                <AlertCircle className="w-3.5 h-3.5 text-amber-500/50" />
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest opacity-40">
                                            {studio.room_category || 'REGULAR'}
                                        </span>
                                        <span className="text-[10px] text-muted-foreground opacity-20">|</span>
                                        <span className="text-[10px] text-muted-foreground font-mono opacity-40 uppercase">ID: {studio.id}</span>
                                    </div>
                                </div>
                                
                                {/* RIGHT SIDE: Technical Context (Low Contrast / Subdued) */}
                                <div className="flex flex-col items-end gap-1 text-right">
                                    <div className="flex items-center gap-3">
                                        {/* Verification Seal */}
                                        <div className="flex items-center gap-1.5 py-0.5">
                                            {isIdeal ? (
                                                <div className="flex items-center gap-1 text-amber-600/60" title="Gold Standard Verification">
                                                    <span className="text-[9px] font-black uppercase tracking-tighter">7d+</span>
                                                    <Star className="w-3.5 h-3.5 fill-amber-500/40 border-none" />
                                                </div>
                                            ) : isVerified ? (
                                                <div className="flex items-center gap-1 text-green-600/40" title="Baseline Verified">
                                                    <span className="text-[9px] font-black uppercase tracking-tighter">{sampleCount}d</span>
                                                    <CheckCircle2 className="w-3 h-3" />
                                                </div>
                                            ) : (
                                                <span className="text-[9px] font-bold uppercase tracking-tighter text-muted-foreground/30 italic">Unverified</span>
                                            )}
                                        </div>

                                        {/* Stealth Audit Trigger */}
                                        <Link href={`/cinemas/${theatreId}/studios/${studio.id}/audit`}>
                                            <Button 
                                                variant="ghost" 
                                                size="sm" 
                                                className="h-7 w-7 p-0 text-muted-foreground/30 group-hover:text-primary/60 hover:bg-primary/5 transition-all"
                                                title="Forensic Audit"
                                            >
                                                <Search className="w-4 h-4" />
                                            </Button>
                                        </Link>
                                    </div>

                                    {/* Temporal Evidence Badge */}
                                    <div className="flex items-center gap-1 text-[8px] font-bold text-muted-foreground/40 uppercase tracking-tight">
                                        <Calendar className="w-2.5 h-2.5 opacity-40" />
                                        {evidenceSpan}
                                    </div>
                                </div>
                            </div>
                            
                            <div className="p-4 bg-background/20 flex-1">
                                <StudioLayoutViewer studio={studio} />
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
