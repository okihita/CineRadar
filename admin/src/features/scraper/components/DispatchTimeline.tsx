'use client';

import React, { useState, useEffect, useRef } from 'react';
import { ChevronDown, ChevronRight, Clock, CheckCircle, AlertTriangle, XCircle, AlertCircle, Loader2 } from 'lucide-react';
import type { DispatchEntry, ErrorCounts } from '@/features/scraper/types';

interface DispatchTimelineProps {
    dispatches: Record<string, DispatchEntry>;
    selectedId?: string | null;
    onDispatchClick?: (slot: string) => void;
    date?: string;  // Date string for fetching error details
}

interface TimelineSlot {
    slot: string;  // Keep for internal key (doc ID)
    showtimeBucket: string;  // e.g., "12:15-12:20"
    dispatch: DispatchEntry;
}

// Component to display error type breakdown
const ErrorTypeBadges: React.FC<{
    errorCounts: ErrorCounts | null;
    isLoading: boolean;
}> = ({ errorCounts, isLoading }) => {
    if (isLoading) {
        return <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />;
    }

    if (!errorCounts || (errorCounts["401"] === 0 && errorCounts["400"] === 0 && errorCounts["other"] === 0)) {
        return null;
    }

    return (
        <div className="flex items-center gap-1">
            {/* 401 errors - DANGER (auth/token issues) */}
            {errorCounts["401"] > 0 && (
                <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded text-xs font-medium bg-red-500/20 text-red-500 dark:text-red-400">
                    <AlertCircle className="w-3 h-3" />
                    401:{errorCounts["401"]}
                </span>
            )}
            {/* 400 errors - WARNING (operational) */}
            {errorCounts["400"] > 0 && (
                <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded text-xs font-medium bg-amber-500/20 text-amber-600 dark:text-amber-400">
                    <AlertTriangle className="w-3 h-3" />
                    400:{errorCounts["400"]}
                </span>
            )}
            {/* Other errors */}
            {errorCounts["other"] > 0 && (
                <span className="px-1.5 py-0.5 rounded text-xs font-medium bg-gray-500/20 text-gray-600 dark:text-gray-400">
                    ?:{errorCounts["other"]}
                </span>
            )}
        </div>
    );
};

export const DispatchTimeline: React.FC<DispatchTimelineProps> = ({
    dispatches,
    onDispatchClick,
    date,
}) => {
    const [expandedSlot, setExpandedSlot] = useState<string | null>(null);
    const [showAll, setShowAll] = useState(false);
    const [errorCountsCache, setErrorCountsCache] = useState<Record<string, ErrorCounts>>({});
    const [loadingErrors, setLoadingErrors] = useState<Record<string, boolean>>({});

    // Convert dispatches to sorted timeline
    const timeline: TimelineSlot[] = Object.entries(dispatches)
        .map(([slot, dispatch]) => ({
            slot,
            showtimeBucket: `${dispatch.window_start}-${dispatch.window_end}`,
            dispatch,
        }))
        .sort((a, b) => a.slot.localeCompare(b.slot));

    // Track pending fetch to avoid race conditions
    const pendingFetchRef = useRef<string | null>(null);

    // Fetch error counts when a slot is expanded
    useEffect(() => {
        if (!expandedSlot || !date) return;

        const dispatch = dispatches[expandedSlot];
        if (!dispatch || dispatch.total_errors === 0) return;

        // Already cached?
        if (errorCountsCache[expandedSlot]) return;

        // Avoid duplicate fetches
        if (pendingFetchRef.current === expandedSlot) return;
        pendingFetchRef.current = expandedSlot;

        // Use setTimeout to defer setState outside of effect cycle
        const timeoutId = setTimeout(() => {
            setLoadingErrors(prev => ({ ...prev, [expandedSlot]: true }));

            fetch(`/api/scraper/errors?date=${date}&slot=${expandedSlot}`)
                .then(res => res.json())
                .then(data => {
                    if (data.error_counts) {
                        setErrorCountsCache(prev => ({
                            ...prev,
                            [expandedSlot]: data.error_counts
                        }));
                    }
                })
                .catch(console.error)
                .finally(() => {
                    setLoadingErrors(prev => ({ ...prev, [expandedSlot]: false }));
                    pendingFetchRef.current = null;
                });
        }, 0);

        return () => {
            clearTimeout(timeoutId);
            pendingFetchRef.current = null;
        };
    }, [expandedSlot, date, dispatches, errorCountsCache]);

    if (timeline.length === 0) {
        return (
            <div className="bg-card border border-border rounded-xl p-6 text-center">
                <Clock className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-muted-foreground text-sm">No dispatches recorded for this day</p>
            </div>
        );
    }

    // Calculate max showtimes for bar scaling
    const maxShowtimes = Math.max(...timeline.map(t => t.dispatch.showtimes_found || 0), 1);

    // Show first 10 by default, or all if showAll is true
    const visibleTimeline = showAll ? timeline : timeline.slice(0, 10);
    const hiddenCount = timeline.length - 10;

    // Status icon and color - now considers 401 errors specially
    const getStatusDisplay = (dispatch: DispatchEntry, errorCounts: ErrorCounts | null) => {
        const has401Errors = errorCounts?.["401"] && errorCounts["401"] > 0;

        if (dispatch.status === 'error' || dispatch.total_errors > 0) {
            const hasPartial = dispatch.total_successes > 0;

            // If we have 401 errors, this is critical (logic issue)
            if (has401Errors) {
                return {
                    icon: XCircle,
                    color: 'text-red-500 dark:text-red-400',
                    bgColor: 'bg-red-500/10 dark:bg-red-500/10',
                    borderColor: 'border-red-500/30',
                    label: 'Auth Issue',
                };
            }

            return {
                icon: hasPartial ? AlertTriangle : XCircle,
                color: hasPartial ? 'text-amber-500 dark:text-amber-400' : 'text-red-500 dark:text-red-400',
                bgColor: 'bg-amber-500/10 dark:bg-amber-500/10',
                borderColor: 'border-amber-500/20',
                label: hasPartial ? 'Partial' : 'Error',
            };
        }
        return {
            icon: CheckCircle,
            color: 'text-green-500 dark:text-green-400',
            bgColor: 'bg-green-500/10 dark:bg-green-500/10',
            borderColor: 'border-green-500/20',
            label: 'OK',
        };
    };

    const toggleExpand = (slot: string) => {
        setExpandedSlot(expandedSlot === slot ? null : slot);
    };

    return (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
            {/* Header */}
            <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <Clock className="w-4 h-4 text-blue-500" />
                    Showtime Coverage
                </h3>
                <span className="text-xs text-muted-foreground">
                    {timeline.length} time slots
                </span>
            </div>

            {/* Timeline */}
            <div className="divide-y divide-border/50">
                {visibleTimeline.map(({ slot, showtimeBucket, dispatch }) => {
                    const cachedErrors = errorCountsCache[slot];
                    const isLoading = loadingErrors[slot];
                    const status = getStatusDisplay(dispatch, cachedErrors);
                    const StatusIcon = status.icon;
                    const barWidth = ((dispatch.showtimes_found || 0) / maxShowtimes) * 100;
                    const isExpanded = expandedSlot === slot;
                    const has401 = Boolean(cachedErrors?.["401"] && cachedErrors["401"] > 0);

                    return (
                        <div key={slot} className="group">
                            {/* Timeline row */}
                            <div
                                onClick={() => {
                                    toggleExpand(slot);
                                    onDispatchClick?.(slot);
                                }}
                                className={`flex items-center justify-between p-4 cursor-pointer transition-all ${isExpanded
                                    ? 'bg-muted'
                                    : 'hover:bg-muted/50'
                                    }`}
                            >
                                {/* Time and bar */}
                                <div className="flex items-center gap-4 flex-1">
                                    <div className="w-24 text-sm font-mono text-foreground">
                                        {showtimeBucket}
                                    </div>
                                    <div className="flex-1 max-w-xs">
                                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                                            <div
                                                className={`h-full transition-all ${has401
                                                    ? 'bg-red-500'
                                                    : dispatch.status === 'error'
                                                        ? 'bg-red-500'
                                                        : dispatch.total_errors > 0
                                                            ? 'bg-amber-500'
                                                            : 'bg-green-500'
                                                    }`}
                                                style={{ width: `${barWidth}%` }}
                                            />
                                        </div>
                                    </div>
                                    <div className="text-sm text-muted-foreground w-32">
                                        {dispatch.showtimes_found || 0} showtimes
                                    </div>
                                </div>

                                {/* Status */}
                                <div className="flex items-center gap-3">
                                    {/* Error type breakdown */}
                                    {dispatch.total_errors > 0 && (
                                        <ErrorTypeBadges
                                            errorCounts={cachedErrors || null}
                                            isLoading={isLoading}
                                        />
                                    )}

                                    <div className={`flex items-center gap-2 px-2 py-1 rounded-lg ${status.bgColor} border ${status.borderColor}`}>
                                        <StatusIcon className={`w-3.5 h-3.5 ${status.color}`} />
                                        <span className={`text-xs font-medium ${status.color}`}>
                                            {status.label}
                                        </span>
                                        {dispatch.total_errors > 0 && !cachedErrors && (
                                            <span className="text-xs text-red-500 dark:text-red-400">
                                                {dispatch.total_errors} err
                                            </span>
                                        )}
                                    </div>
                                    {isExpanded ? (
                                        <ChevronDown className="w-4 h-4 text-muted-foreground" />
                                    ) : (
                                        <ChevronRight className="w-4 h-4 text-muted-foreground" />
                                    )}
                                </div>
                            </div>

                            {/* Expanded details */}
                            {isExpanded && (
                                <div className="bg-muted/30 px-4 py-3 border-t border-border/50">
                                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
                                        <div>
                                            <span className="text-muted-foreground text-xs">Dispatch Time</span>
                                            <div className="text-foreground font-mono">
                                                {dispatch.time_slot || '-'}
                                            </div>
                                        </div>
                                        <div>
                                            <span className="text-muted-foreground text-xs">Dispatched At</span>
                                            <div className="text-foreground font-mono">
                                                {dispatch.dispatched_at
                                                    ? new Date(dispatch.dispatched_at).toLocaleTimeString('en-US', {
                                                        hour: '2-digit',
                                                        minute: '2-digit',
                                                        timeZone: 'Asia/Jakarta',
                                                    })
                                                    : '-'}
                                            </div>
                                        </div>
                                        <div>
                                            <span className="text-muted-foreground text-xs">Jobs Published</span>
                                            <div className="text-foreground">{dispatch.jobs_published || 0}</div>
                                        </div>
                                        <div>
                                            <span className="text-muted-foreground text-xs">Successes</span>
                                            <div className="text-green-500 dark:text-green-400">{dispatch.total_successes || 0}</div>
                                        </div>
                                        <div>
                                            <span className="text-muted-foreground text-xs">Errors</span>
                                            <div className={dispatch.total_errors > 0 ? 'text-red-500 dark:text-red-400' : 'text-muted-foreground'}>
                                                {dispatch.total_errors || 0}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Error breakdown in expanded view */}
                                    {cachedErrors && dispatch.total_errors > 0 && (
                                        <div className="mt-3 p-2 bg-red-500/5 border border-red-500/10 rounded-lg">
                                            <div className="text-xs text-muted-foreground mb-1">Error Breakdown:</div>
                                            <div className="flex flex-wrap gap-2">
                                                {cachedErrors["401"] > 0 && (
                                                    <span className="text-xs text-red-500 dark:text-red-400">
                                                        🔴 {cachedErrors["401"]} auth/token issues (401)
                                                    </span>
                                                )}
                                                {cachedErrors["400"] > 0 && (
                                                    <span className="text-xs text-amber-600 dark:text-amber-400">
                                                        🟡 {cachedErrors["400"]} operational (400)
                                                    </span>
                                                )}
                                                {cachedErrors["other"] > 0 && (
                                                    <span className="text-xs text-gray-600 dark:text-gray-400">
                                                        ⚪ {cachedErrors["other"]} other
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    {dispatch.error && (
                                        <div className="mt-3 p-2 bg-red-500/10 border border-red-500/20 rounded-lg">
                                            <span className="text-xs text-red-500 dark:text-red-400 font-mono">{dispatch.error}</span>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Show more button */}
            {!showAll && hiddenCount > 0 && (
                <div className="p-3 border-t border-border">
                    <button
                        onClick={() => setShowAll(true)}
                        className="w-full py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-lg transition-colors"
                    >
                        Show {hiddenCount} more time slots
                    </button>
                </div>
            )}
        </div>
    );
};

