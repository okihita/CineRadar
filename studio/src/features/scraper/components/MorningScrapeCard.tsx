'use client';

import React from 'react';
import { Sun, CheckCircle, AlertTriangle, XCircle, Loader2 } from 'lucide-react';
import type { MorningRunLog } from '@/features/scraper/types';

interface MorningScrapeCardProps {
    morningRun?: MorningRunLog;
}

export const MorningScrapeCard: React.FC<MorningScrapeCardProps> = ({ morningRun }) => {
    if (!morningRun) {
        return (
            <div className="bg-card border border-border rounded-xl p-4">
                <div className="flex items-center gap-3 text-muted-foreground">
                    <Sun className="w-5 h-5" />
                    <span className="text-sm">Morning scrape not run yet</span>
                </div>
            </div>
        );
    }

    const getStatusDisplay = () => {
        switch (morningRun.status) {
            case 'running':
                return {
                    icon: Loader2,
                    color: 'text-blue-500 dark:text-blue-400',
                    bgColor: 'bg-blue-500/10',
                    borderColor: 'border-blue-500/20',
                    label: 'Running...',
                    animate: true,
                };
            case 'success':
                return {
                    icon: CheckCircle,
                    color: 'text-green-500 dark:text-green-400',
                    bgColor: 'bg-green-500/10',
                    borderColor: 'border-green-500/20',
                    label: 'Success',
                    animate: false,
                };
            case 'partial':
                return {
                    icon: AlertTriangle,
                    color: 'text-amber-500 dark:text-amber-400',
                    bgColor: 'bg-amber-500/10',
                    borderColor: 'border-amber-500/20',
                    label: 'Partial',
                    animate: false,
                };
            case 'failed':
                return {
                    icon: XCircle,
                    color: 'text-red-500 dark:text-red-400',
                    bgColor: 'bg-red-500/10',
                    borderColor: 'border-red-500/20',
                    label: 'Failed',
                    animate: false,
                };
            default:
                return {
                    icon: Sun,
                    color: 'text-muted-foreground',
                    bgColor: 'bg-muted',
                    borderColor: 'border-border',
                    label: 'Unknown',
                    animate: false,
                };
        }
    };

    const status = getStatusDisplay();
    const StatusIcon = status.icon;

    // Format duration
    const formatDuration = (seconds?: number) => {
        if (!seconds) return '-';
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}m ${secs}s`;
    };

    // Format time
    const formatTime = (isoString?: string) => {
        if (!isoString) return '-';
        return new Date(isoString).toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            timeZone: 'Asia/Jakarta',
        });
    };

    return (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
            {/* Header */}
            <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <Sun className="w-4 h-4 text-amber-500" />
                    Morning Scrape
                </h3>
                <div className={`flex items-center gap-2 px-2 py-1 rounded-lg ${status.bgColor} border ${status.borderColor}`}>
                    <StatusIcon className={`w-3.5 h-3.5 ${status.color} ${status.animate ? 'animate-spin' : ''}`} />
                    <span className={`text-xs font-medium ${status.color}`}>{status.label}</span>
                </div>
            </div>

            {/* Content */}
            <div className="p-4">
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    {/* Movies */}
                    <div>
                        <span className="text-muted-foreground text-xs block mb-1">Movies</span>
                        <span className="text-foreground text-lg font-semibold">
                            {morningRun.movies_found || 0}
                        </span>
                    </div>

                    {/* Theatres */}
                    <div>
                        <span className="text-muted-foreground text-xs block mb-1">Theatres</span>
                        <span className="text-foreground text-lg font-semibold">
                            {morningRun.theatres_total || 0}
                        </span>
                    </div>

                    {/* Cities */}
                    <div>
                        <span className="text-muted-foreground text-xs block mb-1">Cities</span>
                        <span className="text-foreground text-lg font-semibold">
                            {morningRun.cities_covered || 0}
                        </span>
                    </div>

                    {/* Duration */}
                    <div>
                        <span className="text-muted-foreground text-xs block mb-1">Duration</span>
                        <span className="text-foreground text-lg font-semibold">
                            {formatDuration(morningRun.duration_seconds)}
                        </span>
                    </div>

                    {/* Start time */}
                    <div>
                        <span className="text-muted-foreground text-xs block mb-1">Started</span>
                        <span className="text-foreground text-lg font-semibold">
                            {formatTime(morningRun.start_time)}
                        </span>
                    </div>
                </div>

                {/* Error message */}
                {morningRun.error && (
                    <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                        <span className="text-xs text-red-500 dark:text-red-400 font-mono">{morningRun.error}</span>
                    </div>
                )}
            </div>
        </div>
    );
};

