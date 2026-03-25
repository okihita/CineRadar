'use client';

import { useState } from 'react';
import { useTheatreStudios } from '../hooks/useTheatreStudios';
import { StudioLayoutViewer } from './StudioLayoutViewer';
import { ChevronDown, ChevronRight, CheckCircle2, AlertCircle, Database, Zap, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface TheatreStudiosListProps {
    theatreId: string;
}

export function TheatreStudiosList({ theatreId }: TheatreStudiosListProps) {
    const { studios, isLoading, isError, refresh } = useTheatreStudios(theatreId);
    const [expandedStudioId, setExpandedStudioId] = useState<string | null>(null);
    const [confirmingId, setConfirmingId] = useState<string | null>(null);

    if (isLoading) {
        return <div className="text-sm text-muted-foreground animate-pulse mt-4">Loading studios...</div>;
    }

    if (isError) {
        return <div className="text-sm text-red-500 mt-4">Failed to load studios</div>;
    }

    if (studios.length === 0) {
        return <div className="text-sm text-muted-foreground mt-4">No studios mapped yet.</div>;
    }

    const toggleStudio = (studioId: string) => {
        setExpandedStudioId(prev => prev === studioId ? null : studioId);
    };

    const handleConfirm = async (e: React.MouseEvent, studioId: string) => {
        e.stopPropagation();
        setConfirmingId(studioId);
        try {
            const res = await fetch(`/api/theatres/${theatreId}/studios/${studioId}/confirm`, {
                method: 'POST'
            });
            if (res.ok) {
                await refresh();
            }
        } catch (err) {
            console.error('Failed to confirm studio', err);
        } finally {
            setConfirmingId(null);
        }
    };

    return (
        <div className="mt-6 space-y-3 border-t pt-4">
            <div className="flex items-center justify-between">
                <h4 className="font-semibold text-sm text-foreground">Studios ({studios.length})</h4>
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                        <Zap className="w-3 h-3 text-blue-500" /> Ground Truth
                    </div>
                    <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                        <Database className="w-3 h-3 text-amber-500" /> Guessed
                    </div>
                </div>
            </div>
            <div className="space-y-2">
                {studios.map(studio => {
                    const isExpanded = expandedStudioId === studio.studio_id;
                    const isConfirmed = studio.audit?.is_confirmed || studio.is_locked;
                    const isRaw = studio.audit?.source === 'raw_initial_layout' || studio.version === 3;
                    
                    return (
                        <div key={studio.studio_id} className={`border rounded-lg overflow-hidden transition-all ${
                            isExpanded ? 'ring-1 ring-primary/20 bg-secondary/5' : 'bg-secondary/10'
                        }`}>
                            <div 
                                className="flex items-center justify-between p-3 text-sm cursor-pointer hover:bg-secondary/20 transition-colors"
                                onClick={() => toggleStudio(studio.studio_id)}
                            >
                                <div className="flex items-center gap-3">
                                    {isExpanded ? (
                                        <ChevronDown className="w-4 h-4 text-muted-foreground" />
                                    ) : (
                                        <ChevronRight className="w-4 h-4 text-muted-foreground" />
                                    )}
                                    <div className="flex flex-col">
                                        <div className="flex items-center gap-2">
                                            <span className="font-bold text-foreground">{studio.name}</span>
                                            {isRaw ? (
                                                <span title="Source: Raw API Layout (High Fidelity)">
                                                    <Zap className="w-3.5 h-3.5 text-blue-500" />
                                                </span>
                                            ) : (
                                                <span title="Source: Guessed from Snapshots (Low Fidelity)">
                                                    <Database className="w-3.5 h-3.5 text-amber-500" />
                                                </span>
                                            )}
                                        </div>
                                        <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
                                            {studio.total_seats || 0} seats • {isRaw ? 'V3 Ground Truth' : 'V2 Legacy'}
                                        </span>
                                    </div>
                                </div>
                                
                                <div className="flex items-center gap-3">
                                    {isConfirmed ? (
                                        <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/20 gap-1 px-2 py-0">
                                            <CheckCircle2 className="w-3 h-3" /> Confirmed
                                        </Badge>
                                    ) : (
                                        <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/20 gap-1 px-2 py-0">
                                            <AlertCircle className="w-3 h-3" /> Pending
                                        </Badge>
                                    )}
                                </div>
                            </div>
                            
                            {isExpanded && (
                                <div className="px-4 pb-4 bg-background/40">
                                    <div className="flex items-center justify-between mb-4 pt-2 border-t border-muted/30">
                                        <div className="text-[10px] text-muted-foreground italic">
                                            {studio.audit?.sample_count && `Derived from ${studio.audit.sample_count} movies • `}
                                            Last updated: {studio.last_updated ? new Date(studio.last_updated).toLocaleDateString() : 'Never'}
                                        </div>
                                        {!isConfirmed && (
                                            <Button 
                                                size="sm" 
                                                variant="outline" 
                                                className="h-7 text-[10px] bg-green-500/5 hover:bg-green-500/10 text-green-600 border-green-500/20"
                                                onClick={(e) => handleConfirm(e, studio.studio_id)}
                                                disabled={confirmingId === studio.studio_id}
                                            >
                                                {confirmingId === studio.studio_id ? (
                                                    <Loader2 className="w-3 h-3 animate-spin mr-1" />
                                                ) : (
                                                    <CheckCircle2 className="w-3 h-3 mr-1" />
                                                )}
                                                Confirm Physical Layout
                                            </Button>
                                        )}
                                    </div>
                                    <StudioLayoutViewer layout={studio.layout || []} totalSeats={studio.total_seats || 0} />
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
