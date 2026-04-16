/**
 * Performance Page
 * Pulls from Firestore movie_performance_v2
 */
'use client';

import { Film, Trophy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

// Feature imports from the duplicated V2 feature folder
import {
    PerformanceTab,
} from '@/features/performances';

export default function PerformancePage() {
    const today = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

    return (
        <div className="min-h-screen bg-background text-foreground p-6">
            {/* Header */}
            <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-primary/10 rounded-xl">
                            <Film className="w-6 h-6 text-primary" />
                        </div>
                        <h1 className="text-3xl font-black uppercase tracking-tighter">Market Pulse</h1>
                    </div>
                    <p className="text-muted-foreground text-sm font-medium">
                        Live box office performance for <span className="text-foreground font-bold">{today}</span>.
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    <Button variant="outline" size="sm" className="h-9 px-4 gap-2 rounded-xl border-border/60 hover:bg-muted transition-all" asChild>
                        <Link href="/performances/all-time">
                            <Trophy className="w-4 h-4 text-amber-500" />
                            <span className="text-xs font-bold uppercase tracking-wider">All-Time Leaders</span>
                        </Link>
                    </Button>
                </div>
            </div>

            {/* Main Content */}
            <PerformanceTab />
        </div>
    );
}
