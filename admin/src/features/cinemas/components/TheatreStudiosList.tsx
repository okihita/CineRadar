'use client';

import { useTheatreStudios } from '../hooks/useTheatreStudios';

interface TheatreStudiosListProps {
    theatreId: string;
}

export function TheatreStudiosList({ theatreId }: TheatreStudiosListProps) {
    const { studios, isLoading, isError } = useTheatreStudios(theatreId);

    if (isLoading) {
        return <div className="text-sm text-muted-foreground animate-pulse mt-4">Loading studios...</div>;
    }

    if (isError) {
        return <div className="text-sm text-red-500 mt-4">Failed to load studios</div>;
    }

    if (studios.length === 0) {
        return <div className="text-sm text-muted-foreground mt-4">No studios mapped yet.</div>;
    }

    return (
        <div className="mt-6 space-y-3 border-t pt-4">
            <h4 className="font-semibold text-sm">Studios ({studios.length})</h4>
            <div className="space-y-2">
                {studios.map(studio => (
                    <div key={studio.studio_id} className="flex items-center justify-between p-2 text-sm border rounded-md bg-secondary/20">
                        <div className="flex items-center space-x-2">
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
                ))}
            </div>
        </div>
    );
}
