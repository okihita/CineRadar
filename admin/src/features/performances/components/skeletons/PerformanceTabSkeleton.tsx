'use client';

import { Skeleton } from "@/components/ui/skeleton";

export function PerformanceTabSkeleton() {
    return (
        <div className="space-y-10">
            {/* National HUD Skeleton */}
            <Skeleton className="h-16 w-full rounded-2xl" />
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Main Bento Skeleton */}
                <Skeleton className="md:col-span-2 h-[400px] rounded-2xl" />
                
                <div className="space-y-6">
                    {/* Secondary Bento Skeletons */}
                    <Skeleton className="h-[190px] rounded-2xl" />
                    <Skeleton className="h-[190px] rounded-2xl" />
                </div>
            </div>
        </div>
    );
}
