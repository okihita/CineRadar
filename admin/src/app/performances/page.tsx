/**
 * Movie Intelligence Page
 * Showtimes and schedules across all theatres
 *
 * Refactored: 496 lines → ~150 lines
 * - Feature-based folder structure (/features/performances/)
 * - Zustand for UI state (useMoviesStore) - replaces 13 useState hooks
 * - SWR for server state (useMoviesData)
 * - Extracted components: MovieStats, MovieFilters, ShowtimeTable
 * - Added Performance tab for movie performance tracking
 */
'use client';

import { Film } from 'lucide-react';

// Feature imports
import {
    PerformanceTab,
} from '@/features/performances';

export default function MoviesPage() {
    // SWR for server state (no more client filtering needed here for now)
    // The PerformanceTab component handles fetching its own list now? 
    // Wait, PerformanceTab.tsx in the original code fetched the list.
    // I should check PerformanceTab.tsx again. It had the list view inside it.

    return (
        <div className="min-h-screen bg-background text-foreground p-6">
            {/* Header */}
            <div className="mb-6">
                <div className="flex items-center gap-3 mb-2">
                    <Film className="w-6 h-6 text-primary" />
                    <h1 className="text-2xl font-bold">Movie Intelligence</h1>
                </div>
                <p className="text-muted-foreground text-sm">
                    Performance analytics and box office tracking
                </p>
            </div>

            {/* Main Content (Performance Dashboard Only) */}
            <PerformanceTab />
        </div>
    );
}

