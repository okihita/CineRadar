'use client';

import { RefreshCw, Gauge, HardDrive } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PerformanceMetrics } from '@/types';

interface PageHeaderProps {
    title: string;
    description?: string;
    icon?: React.ReactNode;
    lastUpdated?: string;
    onRefresh?: () => void;
    isRefreshing?: boolean;
    metrics?: PerformanceMetrics | null;
    children?: React.ReactNode;
}

export function PageHeader({
    title,
    description,
    icon,
    lastUpdated,
    onRefresh,
    isRefreshing,
    metrics,
    children,
}: PageHeaderProps) {
    return (
        <div className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            {/* Left: Title and description */}
            <div className="flex items-start gap-3">
                {icon && <div className="mt-1">{icon}</div>}
                <div>
                    <div className="flex items-center gap-2 flex-wrap">
                        <h1 className="text-2xl font-bold">{title}</h1>
                        {metrics && (
                            <div className="flex items-center gap-3 text-[10px] font-mono text-muted-foreground/40 ml-2 bg-muted/30 px-2 py-0.5 rounded-full border border-border/50">
                                <div className="flex items-center gap-1">
                                    <Gauge className="w-2.5 h-2.5" />
                                    <span>{metrics.latencyMs}ms</span>
                                </div>
                                <span className="opacity-20">|</span>
                                <div className="flex items-center gap-1">
                                    <HardDrive className="w-2.5 h-2.5" />
                                    <span>{metrics.sizeKB} KB</span>
                                </div>
                            </div>
                        )}
                    </div>
                    {description && (
                        <p className="text-muted-foreground text-sm mt-0.5">{description}</p>
                    )}
                    {lastUpdated && (
                        <p className="text-xs text-muted-foreground mt-1">
                            Last updated: {lastUpdated}
                        </p>
                    )}
                </div>
            </div>

            {/* Right: Actions */}
            <div className="flex items-center gap-3">
                {children}
                {onRefresh && (
                    <button
                        onClick={onRefresh}
                        disabled={isRefreshing}
                        className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50 border border-transparent hover:border-border"
                        title="Refresh data"
                    >
                        <RefreshCw className={cn('w-4 h-4', isRefreshing && 'animate-spin')} />
                    </button>
                )}
            </div>
        </div>
    );
}

// Re-export time utilities for backward compatibility
export { formatRelativeWIB as formatRelativeTime, formatWIB, formatWIBShort, formatWIBDate } from '@/lib/timeUtils';
