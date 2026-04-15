/**
 * Performance Page
 * Pulls from Firestore movie_performance_v2
 */
'use client';

import { Film } from 'lucide-react';

// Feature imports from the duplicated V2 feature folder
import {
    PerformanceTab,
} from '@/features/performances';

export default function PerformancePage() {
    return (
        <div className="min-h-screen bg-background text-foreground p-6">
            {/* Header */}
            <div className="mb-6">
                <div className="flex items-center gap-3 mb-2">
                    <Film className="w-6 h-6 text-primary" />
                    <h1 className="text-2xl font-bold">Performance Intelligence</h1>
                </div>
                <p className="text-muted-foreground text-sm">
                    Performance analytics and box office tracking.
                </p>
            </div>

            {/* Main Content */}
            <PerformanceTab />
        </div>
    );
}
