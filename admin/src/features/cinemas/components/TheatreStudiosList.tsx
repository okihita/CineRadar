'use client';

import { useState } from 'react';
import { useTheatreStudios } from '../hooks/useTheatreStudios';
import { StudioLayoutViewer } from './StudioLayoutViewer';
import { CheckCircle2, AlertCircle, Database, Zap, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

import { getStudioDisplayName } from '../utils';

interface TheatreStudiosListProps {
    theatreId: string;
    merchant?: string;
}

export function TheatreStudiosList({ theatreId, merchant }: TheatreStudiosListProps) {
    const { studios, isLoading, isError, refresh } = useTheatreStudios(theatreId);
    const [confirmingId, setConfirmingId] = useState<string | null>(null);

    if (isLoading) {
        return <div className="text-sm text-muted-foreground animate-pulse mt-4">Loading studios...</div>;
    }

    if (isError) {
        return <div className="text-sm text-red-500 mt-4">Failed to load studios</div>;
    }

    if (studios.length === 0) {
        return <div className="text-sm text-muted-foreground mt-4 italic">No studios mapped yet for this theatre.</div>;
    }

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
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {studios.map(studio => {
                    const isConfirmed = studio.audit?.is_confirmed || studio.is_locked;
                    const isRaw = studio.audit?.source === 'raw_initial_layout' || studio.version === 3;
                    
                    return (
                        <div key={studio.studio_id} className="flex flex-col h-full border rounded-xl overflow-hidden bg-card/30 shadow-sm hover:shadow-md transition-shadow">
                            <div className="flex items-center justify-between p-4 bg-muted/10 border-b">
                                <div className="flex items-center gap-3">
                                    <div className="flex flex-col">
                                        <div className="flex items-center gap-2">
                                            <span className="font-bold text-foreground text-sm uppercase tracking-tight">
                                                {getStudioDisplayName(studio, merchant)}
                                            </span>
                                            {isRaw ? (
                                                <span title="Ground Truth">
                                                    <Zap className="w-3.5 h-3.5 text-blue-500" />
                                                </span>
                                            ) : (
                                                <span title="Guessed">
                                                    <Database className="w-3.5 h-3.5 text-amber-500" />
                                                </span>
                                            )}
                                        </div>
                                        <span className="text-[10px] text-muted-foreground font-mono">
                                            ID: {studio.studio_id} • {studio.total_seats || 0} seats
                                        </span>
                                    </div>
                                </div>
                                
                                {isConfirmed ? (
                                    <Badge variant="outline" className="bg-green-500/5 text-green-600 border-green-500/20 gap-1 px-2 py-0 text-[9px] font-bold">
                                        <CheckCircle2 className="w-3 h-3" /> VERIFIED
                                    </Badge>
                                ) : (
                                    <Button 
                                        size="sm" 
                                        variant="outline" 
                                        className="h-6 text-[9px] font-bold bg-amber-500/5 hover:bg-amber-500/10 text-amber-600 border-amber-500/20"
                                        onClick={(e) => handleConfirm(e, studio.studio_id)}
                                        disabled={confirmingId === studio.studio_id}
                                    >
                                        {confirmingId === studio.studio_id ? (
                                            <Loader2 className="w-2.5 h-2.5 animate-spin mr-1" />
                                        ) : (
                                            <AlertCircle className="w-2.5 h-2.5 mr-1" />
                                        )}
                                        CONFIRM
                                    </Button>
                                )}
                            </div>
                            
                            <div className="p-4 bg-background/20 flex-1">
                                <div className="text-[9px] text-muted-foreground italic mb-3 flex items-center justify-between">
                                    <span>{studio.room_category || 'REGULAR'}</span>
                                    <span>Updated: {studio.last_updated ? new Date(studio.last_updated).toLocaleDateString() : 'Never'}</span>
                                </div>
                                <StudioLayoutViewer studio={studio} />
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
