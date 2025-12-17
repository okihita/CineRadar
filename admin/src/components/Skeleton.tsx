'use client';

/**
 * Skeleton loading components for consistent loading states
 */

import { cn } from '@/lib/utils';

interface SkeletonProps {
    className?: string;
}

export function Skeleton({ className }: SkeletonProps) {
    return (
        <div className={cn('animate-pulse bg-muted rounded', className)} />
    );
}

export function SkeletonCard({ className }: SkeletonProps) {
    return (
        <div className={cn('rounded-lg border bg-card p-4', className)}>
            <Skeleton className="h-4 w-32 mb-4" />
            <div className="space-y-2">
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
            </div>
        </div>
    );
}

export function SkeletonChart({ className }: SkeletonProps) {
    return (
        <div className={cn('rounded-lg border bg-card', className)}>
            <div className="p-3 border-b">
                <Skeleton className="h-4 w-40" />
            </div>
            <div className="p-4">
                <Skeleton className="h-[200px] w-full rounded-lg" />
            </div>
        </div>
    );
}

export function SkeletonTable({ rows = 5, className }: SkeletonProps & { rows?: number }) {
    return (
        <div className={cn('rounded-lg border bg-card', className)}>
            <div className="p-3 border-b flex justify-between">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-8 w-32" />
            </div>
            <div className="p-4 space-y-3">
                {[...Array(rows)].map((_, i) => (
                    <div key={i} className="flex items-center gap-4">
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-6 w-16" />
                        <Skeleton className="h-4 w-24" />
                        <Skeleton className="h-4 w-16 ml-auto" />
                    </div>
                ))}
            </div>
        </div>
    );
}

export function SkeletonKPI({ className }: SkeletonProps) {
    return (
        <div className={cn('rounded-lg border bg-card p-4', className)}>
            <Skeleton className="h-3 w-20 mb-2" />
            <Skeleton className="h-8 w-24 mb-1" />
            <Skeleton className="h-4 w-16" />
        </div>
    );
}

export function SkeletonPage({ title }: { title?: string }) {
    return (
        <div className="min-h-screen bg-background text-foreground p-4 md:p-6">
            {/* Header */}
            <div className="mb-6 flex items-center gap-3">
                <Skeleton className="h-6 w-6 rounded" />
                <div>
                    <Skeleton className="h-6 w-48 mb-1" />
                    <Skeleton className="h-3 w-64" />
                </div>
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <SkeletonKPI />
                <SkeletonKPI />
                <SkeletonKPI />
                <SkeletonKPI />
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                <SkeletonChart />
                <SkeletonChart />
            </div>

            {/* Table */}
            <SkeletonTable rows={8} />
        </div>
    );
}

export default Skeleton;
