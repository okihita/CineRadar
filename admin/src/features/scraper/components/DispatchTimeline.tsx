'use client';

import React, { useState } from 'react';
import { ChevronDown, ChevronRight, Clock, CheckCircle, AlertTriangle, XCircle } from 'lucide-react';
import type { DispatchEntry } from '@/features/scraper/types';

interface DispatchTimelineProps {
    dispatches: Record<string, DispatchEntry>;
    selectedId?: string | null;
    onDispatchClick?: (slot: string) => void;
}

interface TimelineSlot {
    slot: string;  // Keep for internal key (doc ID)
    showtimeBucket: string;  // e.g., "12:15-12:20"
    dispatch: DispatchEntry;
}

export const DispatchTimeline: React.FC<DispatchTimelineProps> = ({
    dispatches,
    onDispatchClick,
}) => {
    const [expandedSlot, setExpandedSlot] = useState<string | null>(null);
    const [showAll, setShowAll] = useState(false);

    // Convert dispatches to sorted timeline
    const timeline: TimelineSlot[] = Object.entries(dispatches)
        .map(([slot, dispatch]) => ({
            slot,
            showtimeBucket: `${dispatch.window_start}-${dispatch.window_end}`,
            dispatch,
        }))
        .sort((a, b) => a.slot.localeCompare(b.slot));

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

    // Status icon and color
    const getStatusDisplay = (dispatch: DispatchEntry) => {
        if (dispatch.status === 'error' || dispatch.total_errors > 0) {
            const hasPartial = dispatch.total_successes > 0;
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
                    const status = getStatusDisplay(dispatch);
                    const StatusIcon = status.icon;
                    const barWidth = ((dispatch.showtimes_found || 0) / maxShowtimes) * 100;
                    const isExpanded = expandedSlot === slot;

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
                                                className={`h-full transition-all ${dispatch.status === 'error'
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
                                    <div className={`flex items-center gap-2 px-2 py-1 rounded-lg ${status.bgColor} border ${status.borderColor}`}>
                                        <StatusIcon className={`w-3.5 h-3.5 ${status.color}`} />
                                        <span className={`text-xs font-medium ${status.color}`}>
                                            {status.label}
                                        </span>
                                        {dispatch.total_errors > 0 && (
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

