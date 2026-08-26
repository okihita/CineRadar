'use client';

import { Skeleton } from "@/components/ui/skeleton";
import { Loader2, Activity } from "lucide-react";
import { useElapsedTimer } from '../../hooks/useElapsedTimer';

export function PerformanceTabSkeleton() {
    const elapsed = useElapsedTimer();

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* Loading status card */}
            <div className="flex items-center justify-center gap-4 py-6 px-4 border border-dashed rounded-2xl bg-muted/5 text-muted-foreground">
                <div className="relative">
                    <Activity className="w-8 h-8 text-primary/20 animate-pulse" />
                    <Loader2 className="w-4 h-4 animate-spin text-primary absolute -bottom-1 -right-1" />
                </div>
                <div className="text-center space-y-1">
                    <p className="text-sm font-black uppercase tracking-widest text-foreground">
                        Aggregating Market Data
                    </p>
                    <p className="text-sm opacity-60 max-w-[360px]">
                        CineRadar is collecting today&apos;s performance snapshots from all cinema chains nationwide.
                    </p>
                </div>
                <span className="text-sm font-mono font-bold text-muted-foreground/40 tabular-nums">
                    {elapsed}s
                </span>
                {elapsed > 15 && (
                    <p className="text-sm font-bold text-amber-600 uppercase tracking-tight">
                        Large dataset — hang tight
                    </p>
                )}
            </div>

            {/* National HUD skeleton — horizontal pill bar */}
            <div className="flex items-center gap-6 px-6 py-4 rounded-2xl bg-muted/10 border border-border/20">
                <div className="flex items-center gap-3 pr-6 border-r border-border/20">
                    <Skeleton className="w-5 h-5 rounded-full" />
                    <div className="space-y-1">
                        <Skeleton className="h-2 w-14" />
                        <Skeleton className="h-4 w-20" />
                    </div>
                </div>
                <div className="flex items-center gap-3 pr-6 border-r border-border/20">
                    <Skeleton className="w-5 h-5 rounded-full" />
                    <div className="space-y-1">
                        <Skeleton className="h-2 w-14" />
                        <Skeleton className="h-4 w-20" />
                    </div>
                </div>
                <div className="flex items-center gap-3 pr-6 border-r border-border/20">
                    <Skeleton className="w-5 h-5 rounded-full" />
                    <div className="space-y-1">
                        <Skeleton className="h-2 w-14" />
                        <Skeleton className="h-4 w-20" />
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <Skeleton className="w-5 h-5 rounded-full" />
                    <div className="space-y-1">
                        <Skeleton className="h-2 w-14" />
                        <Skeleton className="h-4 w-16" />
                    </div>
                </div>
            </div>

            {/* Bento grid skeleton — top 3 cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Skeleton className="md:col-span-2 h-[280px] rounded-2xl" />
                <div className="space-y-6">
                    <Skeleton className="h-[132px] rounded-2xl" />
                    <Skeleton className="h-[132px] rounded-2xl" />
                </div>
            </div>

            {/* Market grid skeleton — fading table rows */}
            <div className="rounded-xl border border-dashed border-border/40 overflow-hidden">
                <div className="bg-muted/20 p-4 border-b border-dashed flex justify-between items-center">
                    <Skeleton className="h-3 w-40" />
                    <Skeleton className="h-3 w-24" />
                </div>
                <div className="divide-y divide-dashed divide-border/20">
                    {[...Array(8)].map((_, i) => (
                        <div
                            key={i}
                            className="p-4 flex items-center justify-between"
                            style={{ opacity: 1 - (i * 0.1) }}
                        >
                            <div className="flex items-center gap-4">
                                <Skeleton className="h-8 w-6 rounded" />
                                <div className="space-y-1.5">
                                    <Skeleton className="h-3 w-36" />
                                    <Skeleton className="h-2 w-20" />
                                </div>
                            </div>
                            <div className="flex items-center gap-6">
                                <Skeleton className="h-3 w-16" />
                                <Skeleton className="h-3 w-16" />
                                <Skeleton className="h-3 w-12" />
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
