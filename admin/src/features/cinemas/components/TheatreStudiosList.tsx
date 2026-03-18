'use client';

import { useState } from 'react';
import { useTheatreStudios } from '../hooks/useTheatreStudios';
import { StudioLayoutViewer } from './StudioLayoutViewer';
import { ChevronDown, ChevronRight } from 'lucide-react';

interface TheatreStudiosListProps {
    theatreId: string;
}

export function TheatreStudiosList({ theatreId }: TheatreStudiosListProps) {
    const { studios, isLoading, isError } = useTheatreStudios(theatreId);
    const [expandedStudioId, setExpandedStudioId] = useState<string | null>(null);

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

    return (
        <div className="mt-6 space-y-3 border-t pt-4">
            <h4 className="font-semibold text-sm">Studios ({studios.length})</h4>
            <div className="space-y-2">
                {studios.map(studio => {
                    const isExpanded = expandedStudioId === studio.studio_id;
                    return (
                        <div key={studio.studio_id} className="border rounded-md bg-secondary/10 overflow-hidden">
                            <div 
                                className="flex items-center justify-between p-2 text-sm cursor-pointer hover:bg-secondary/30 transition-colors"
                                onClick={() => toggleStudio(studio.studio_id)}
                            >
                                <div className="flex items-center space-x-2">
                                    {isExpanded ? (
                                        <ChevronDown className="w-4 h-4 text-muted-foreground" />
                                    ) : (
                                        <ChevronRight className="w-4 h-4 text-muted-foreground" />
                                    )}
                                    <span className="font-medium truncate max-w-[150px]" title={studio.name}>{studio.name}</span>
                                </div>
                                <div className="flex items-center space-x-3 text-xs text-muted-foreground">
                                    {studio.total_seats ? <span>{studio.total_seats} seats</span> : <span>0 seats</span>}
                                    {studio.is_locked ? (
                                        <span className="text-green-600 font-medium" title="Locked by Admin">🔒 Locked</span>
                                    ) : (
                                        <span className="text-amber-500" title="Auto-managed">🔓 Auto</span>
                                    )}
                                </div>
                            </div>
                            
                            {isExpanded && (
                                <div className="p-3 pt-0 bg-background/50 border-t">
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
