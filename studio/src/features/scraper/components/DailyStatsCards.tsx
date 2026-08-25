'use client';

import React from 'react';
import { Activity, Calendar, AlertTriangle, CheckCircle } from 'lucide-react';

interface DailyStatsCardsProps {
    totalSchedules: number;
    availableSchedules: number;
    waveMultiplier: number;
    coveragePercent: number;
    totalDispatches: number;
    totalSuccesses: number;
    totalErrors: number;
    errorBreakdown?: {
        auth: number;      // 401 - token/auth issues (CRITICAL)
        closed: number;    // 400 - seating closed/passed (expected)
        other: number;     // Other errors (network, schema, etc.)
    };
}

export const DailyStatsCards: React.FC<DailyStatsCardsProps> = ({
    totalSchedules,
    availableSchedules,
    waveMultiplier = 1,
    totalDispatches,
    totalSuccesses,
    totalErrors,
    errorBreakdown
}) => {
    // Calculate actual scrape success rate (successes / (available schedules * multiplier))
    const totalExpectedScrapes = availableSchedules * waveMultiplier;
    const scrapeSuccessRate = totalExpectedScrapes > 0
        ? Math.round((totalSuccesses / totalExpectedScrapes) * 100)
        : 0;

    // Calculate error percentages
    const errorPct = totalErrors > 0 ? {
        auth: Math.round((errorBreakdown?.auth || 0) / totalErrors * 100),
        closed: Math.round((errorBreakdown?.closed || 0) / totalErrors * 100),
        other: Math.round((errorBreakdown?.other || 0) / totalErrors * 100),
    } : { auth: 0, closed: 0, other: 0 };

    // Build error breakdown subtitle
    const errorSublabel = totalErrors > 0 ? (
        <span className="text-xs ml-1">
            <span className="text-red-500">{errorPct.auth}% 401</span>
            <span className="text-muted-foreground">, </span>
            <span className="text-amber-500">{errorPct.closed}% 400</span>
            <span className="text-muted-foreground">, </span>
            <span className="text-slate-400">{errorPct.other}% other</span>
        </span>
    ) : undefined;

    const stats = [
        {
            label: 'Available Today',
            value: availableSchedules > 0 ? availableSchedules.toLocaleString() : '-',
            sublabel: totalSchedules > availableSchedules
                ? <span className="text-xs text-muted-foreground ml-1">out of {totalSchedules.toLocaleString()} showtimes</span>
                : undefined,
            icon: Calendar,
            color: 'text-purple-500 dark:text-purple-400',
            bgColor: 'bg-purple-500/10 dark:bg-purple-500/10',
        },
        {
            label: 'Scraped',
            value: totalSuccesses > 0 ? totalSuccesses.toLocaleString() : '0',
            sublabel: availableSchedules > 0
                ? <span className="text-xs text-muted-foreground ml-1">{scrapeSuccessRate}% success</span>
                : undefined,
            icon: CheckCircle,
            color: totalSuccesses > 0
                ? 'text-green-500 dark:text-green-400'
                : 'text-muted-foreground',
            bgColor: totalSuccesses > 0
                ? 'bg-green-500/10 dark:bg-green-500/10'
                : 'bg-muted',
        },
        {
            label: 'Dispatches',
            value: totalDispatches,
            sublabel: undefined,
            icon: Activity,
            color: 'text-blue-500 dark:text-blue-400',
            bgColor: 'bg-blue-500/10 dark:bg-blue-500/10',
        },
        {
            label: 'Errors',
            value: totalErrors > 0 ? totalErrors.toLocaleString() : '0',
            sublabel: errorSublabel,
            icon: AlertTriangle,
            color: totalErrors > 0
                ? 'text-red-500 dark:text-red-400'
                : 'text-muted-foreground',
            bgColor: totalErrors > 0
                ? 'bg-red-500/10 dark:bg-red-500/10'
                : 'bg-muted',
        },
    ];

    return (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {stats.map(({ label, value, sublabel, icon: Icon, color, bgColor }) => (
                <div
                    key={label}
                    className="bg-card border border-border rounded-xl p-4"
                >
                    <div className="flex flex-col gap-3">
                        <div className="flex items-center gap-2">
                            <div className={`p-2 rounded-lg ${bgColor}`}>
                                <Icon className={`w-4 h-4 ${color}`} />
                            </div>
                            <div className="text-xs font-medium text-muted-foreground">{label}</div>
                        </div>
                        <div>
                            <div className="text-2xl font-bold text-foreground">
                                {value}
                            </div>
                            {sublabel && <div className="mt-1">{sublabel}</div>}
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
};

