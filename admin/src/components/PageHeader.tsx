'use client';

import { RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PageHeaderProps {
    title: string;
    description?: string;
    icon?: React.ReactNode;
    lastUpdated?: string;
    onRefresh?: () => void;
    isRefreshing?: boolean;
    showMockBadge?: boolean;
}

export function PageHeader({
    title,
    description,
    icon,
    lastUpdated,
    onRefresh,
    isRefreshing,
    showMockBadge = true,
}: PageHeaderProps) {
    return (
        <div className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            {/* Left: Title and description */}
            <div className="flex items-start gap-3">
                {icon && <div className="mt-1">{icon}</div>}
                <div>
                    <div className="flex items-center gap-2 flex-wrap">
                        <h1 className="text-2xl font-bold">{title}</h1>
                        {showMockBadge && (
                            <span className="px-2 py-0.5 text-xs font-medium rounded border bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400">
                                Mock Data
                            </span>
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

            {/* Right: Refresh only (theme toggle is in sidebar) */}
            {onRefresh && (
                <button
                    onClick={onRefresh}
                    disabled={isRefreshing}
                    className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                    title="Refresh data"
                >
                    <RefreshCw className={cn('w-4 h-4', isRefreshing && 'animate-spin')} />
                </button>
            )}
        </div>
    );
}

// Re-export time utilities for backward compatibility
export { formatRelativeWIB as formatRelativeTime, formatWIB, formatWIBShort, formatWIBDate } from '@/lib/timeUtils';

