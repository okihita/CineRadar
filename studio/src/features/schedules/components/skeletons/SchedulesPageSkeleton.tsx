"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { Loader2, Calendar } from "lucide-react";

/**
 * Skeleton loader that mirrors the schedules page layout:
 * Stats cards → Chart → Movie card list
 */
export function SchedulesPageSkeleton() {
    return (
        <div className="space-y-6 animate-in fade-in duration-300">
            {/* Stats cards skeleton */}
            <div className="grid gap-4 md:grid-cols-3">
                {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="rounded-xl border border-border/60 p-6 space-y-3">
                        <div className="flex items-center justify-between">
                            <Skeleton className="h-4 w-24" />
                            <Skeleton className="h-4 w-4 rounded" />
                        </div>
                        <Skeleton className="h-8 w-16" />
                        <Skeleton className="h-3 w-32" />
                    </div>
                ))}
            </div>

            {/* Chart card skeleton */}
            <div className="rounded-xl border border-border/60 p-6 space-y-4">
                <div className="flex justify-between items-start">
                    <div className="space-y-1">
                        <Skeleton className="h-5 w-48" />
                        <Skeleton className="h-3 w-72" />
                    </div>
                    <div className="flex gap-3">
                        <Skeleton className="h-3 w-20" />
                        <Skeleton className="h-3 w-20" />
                    </div>
                </div>
                <Skeleton className="h-[200px] w-full rounded" />
            </div>

            {/* Loading indicator */}
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground gap-3">
                <div className="relative">
                    <Calendar className="w-10 h-10 text-primary/20" />
                    <Loader2 className="w-5 h-5 animate-spin text-primary absolute -bottom-1 -right-1" />
                </div>
                <div className="text-center space-y-1">
                    <p className="text-sm font-bold uppercase tracking-widest text-foreground">
                        Loading Showtime Intelligence
                    </p>
                    <p className="text-sm opacity-60">
                        Aggregating daily schedule data across all cinema chains.
                    </p>
                </div>
            </div>

            {/* Movie cards skeleton */}
            <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="rounded-xl border border-border/60 p-3 flex gap-4" style={{ opacity: 1 - i * 0.12 }}>
                        <Skeleton className="w-16 h-24 flex-shrink-0 rounded" />
                        <div className="flex-1 space-y-2">
                            <Skeleton className="h-5 w-48" />
                            <div className="flex gap-2">
                                <Skeleton className="h-5 w-12 rounded" />
                                <Skeleton className="h-5 w-16 rounded" />
                            </div>
                            <div className="flex gap-4 pt-1">
                                <Skeleton className="h-4 w-16" />
                                <Skeleton className="h-4 w-20" />
                                <Skeleton className="h-4 w-16" />
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
