'use client';

import { useEffect } from 'react';
import { useTheatreStudios, type PerformanceMetrics } from '../hooks/useTheatreStudios';
import { StudioLayoutViewer } from './StudioLayoutViewer';
import { CheckCircle2, AlertCircle, Zap, Search, Star, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
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

    // Bubble up metrics to parent header
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
                    
                    // Derive freshness from the latest evidence date
                    const latestEvidenceDate = evidence.length > 0 
                        ? [...evidence].sort((a, b) => b.date.localeCompare(a.date))[0].date 
                        : null;
                    
                    return (
                        <div key={studio.id} className="flex flex-col h-full border rounded-xl overflow-hidden bg-card/30 shadow-sm hover:shadow-md transition-shadow">
                            <div className="flex items-center justify-between p-4 bg-muted/10 border-b">
                                <div className="flex items-center gap-3">
                                    <div className="flex flex-col">
                                        <div className="flex items-center gap-2">
                                            <span className="font-bold text-foreground text-sm uppercase tracking-tight">
                                                {getStudioDisplayName(studio, merchant)}
                                            </span>
                                            {isV3 ? (
                                                <span title="Digital Twin (V3.2+)">
                                                    <Zap className="w-3.5 h-3.5 text-blue-500 shadow-sm" />
                                                </span>
                                            ) : (
                                                <span title="Legacy Layout">
                                                    <AlertCircle className="w-3.5 h-3.5 text-amber-500" />
                                                </span>
                                            )}
                                        </div>
                                        <span className="text-[10px] text-muted-foreground font-mono uppercase">
                                            ID: {studio.id} • {studio.room_category || 'REGULAR'}
                                        </span>
                                    </div>
                                </div>
                                
                                <div className="flex flex-col items-end gap-1">
                                    <div className="flex items-center gap-2">
                                        <Link href={`/cinemas/${theatreId}/studios/${studio.id}/audit`}>
                                            <Button 
                                                size="sm" 
                                                variant="outline" 
                                                className="h-6 px-2 text-[9px] font-bold gap-1.5 bg-blue-500/5 hover:bg-blue-500/10 text-blue-600 border-blue-500/20 shadow-sm transition-all"
                                            >
                                                <Search className="w-3 h-3" />
                                                AUDIT
                                            </Button>
                                        </Link>

                                        {isIdeal ? (
                                            <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/30 gap-1 px-2 py-0 text-[9px] font-bold shadow-sm">
                                                <Star className="w-3 h-3 fill-amber-500" /> GOLD VERIFIED
                                            </Badge>
                                        ) : isVerified ? (
                                            <Badge variant="outline" className="bg-green-500/5 text-green-600 border-green-500/20 gap-1 px-2 py-0 text-[9px] font-bold">
                                                <CheckCircle2 className="w-3 h-3" /> VERIFIED ({sampleCount}d)
                                            </Badge>
                                        ) : (
                                            <Badge variant="outline" className="bg-muted text-muted-foreground border-border gap-1 px-2 py-0 text-[9px] font-bold">
                                                UNVERIFIED
                                            </Badge>
                                        )}
                                    </div>
                                    <span className="text-[8px] text-muted-foreground font-medium uppercase tracking-tighter">
                                        Refreshed: {latestEvidenceDate ? new Date(latestEvidenceDate).toLocaleDateString() : 'Never'}
                                    </span>
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
