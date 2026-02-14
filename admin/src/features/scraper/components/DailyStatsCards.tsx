'use client';

import React from 'react';
import { Activity, Calendar, Percent, AlertTriangle } from 'lucide-react';

interface DailyStatsCardsProps {
    totalSchedules: number;
    coveragePercent: number;
    totalDispatches: number;
    errorDispatches: number;
}

export const DailyStatsCards: React.FC<DailyStatsCardsProps> = ({
    totalSchedules,
    coveragePercent,
    totalDispatches,
    errorDispatches
}) => {
    const stats = [
        {
            label: 'Schedules Today',
            value: totalSchedules > 0 ? totalSchedules.toLocaleString() : '-',
            icon: Calendar,
            color: 'text-purple-500 dark:text-purple-400',
            bgColor: 'bg-purple-500/10 dark:bg-purple-500/10',
        },
        {
            label: 'Coverage',
            value: totalSchedules > 0 ? `${coveragePercent}%` : '-',
            sublabel: totalSchedules > 0 ? 'scraped' : undefined,
            icon: Percent,
            color: coveragePercent >= 80
                ? 'text-green-500 dark:text-green-400'
                : coveragePercent >= 50
                    ? 'text-amber-500 dark:text-amber-400'
                    : 'text-red-500 dark:text-red-400',
            bgColor: coveragePercent >= 80
                ? 'bg-green-500/10 dark:bg-green-500/10'
                : coveragePercent >= 50
                    ? 'bg-amber-500/10 dark:bg-amber-500/10'
                    : 'bg-red-500/10 dark:bg-red-500/10',
        },
        {
            label: 'Dispatches',
            value: totalDispatches,
            icon: Activity,
            color: 'text-blue-500 dark:text-blue-400',
            bgColor: 'bg-blue-500/10 dark:bg-blue-500/10',
        },
        {
            label: 'Errors',
            value: errorDispatches,
            icon: AlertTriangle,
            color: errorDispatches > 0
                ? 'text-red-500 dark:text-red-400'
                : 'text-muted-foreground',
            bgColor: errorDispatches > 0
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
                    <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${bgColor}`}>
                            <Icon className={`w-4 h-4 ${color}`} />
                        </div>
                        <div>
                            <div className="text-2xl font-bold text-foreground">
                                {value}
                                {sublabel && <span className="text-xs text-muted-foreground ml-1">{sublabel}</span>}
                            </div>
                            <div className="text-xs text-muted-foreground">{label}</div>
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
};

