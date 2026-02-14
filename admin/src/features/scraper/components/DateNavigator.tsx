'use client';

import React from 'react';
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react';

interface DateNavigatorProps {
    selectedDate: string; // YYYY-MM-DD format
    onDateChange: (date: string) => void;
    minDate?: string;
    maxDate?: string;
}

/**
 * Add days to a date string (YYYY-MM-DD) and return new date string
 * Handles timezone correctly by working with date parts directly
 */
function addDays(dateStr: string, days: number): string {
    const [year, month, day] = dateStr.split('-').map(Number);
    const date = new Date(year, month - 1, day); // Use local time constructor
    date.setDate(date.getDate() + days);
    // Format back to YYYY-MM-DD using local time
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

/**
 * Get today's date in YYYY-MM-DD format using WIB timezone
 */
function getTodayWIB(): string {
    const now = new Date();
    const wibOptions: Intl.DateTimeFormatOptions = {
        timeZone: 'Asia/Jakarta',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    };
    const parts = new Intl.DateTimeFormat('en-CA', wibOptions).formatToParts(now);
    const year = parts.find(p => p.type === 'year')?.value || '';
    const month = parts.find(p => p.type === 'month')?.value || '';
    const day = parts.find(p => p.type === 'day')?.value || '';
    return `${year}-${month}-${day}`;
}

/**
 * Format date for display
 */
function formatDisplay(dateStr: string): string {
    const [year, month, day] = dateStr.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return date.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
    });
}

export const DateNavigator: React.FC<DateNavigatorProps> = ({
    selectedDate,
    onDateChange,
    minDate,
    maxDate,
}) => {
    const today = maxDate || getTodayWIB();
    const isToday = selectedDate === today;

    // Navigate to previous/next day
    const navigateDay = (direction: 'prev' | 'next') => {
        const days = direction === 'next' ? 1 : -1;
        const newDateStr = addDays(selectedDate, days);

        // Check bounds using string comparison (YYYY-MM-DD format works lexicographically)
        if (minDate && newDateStr < minDate) return;
        if (maxDate && newDateStr > maxDate) return;

        onDateChange(newDateStr);
    };

    // Quick navigation
    const goToToday = () => onDateChange(today);
    const goToYesterday = () => {
        onDateChange(addDays(today, -1));
    };

    // Check if next button should be disabled
    const isNextDisabled = selectedDate >= today;

    return (
        <div className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center justify-between">
                {/* Left navigation */}
                <button
                    onClick={() => navigateDay('prev')}
                    className="p-2 rounded-lg bg-muted hover:bg-muted/80 transition-colors border border-border"
                    title="Previous day"
                >
                    <ChevronLeft className="w-5 h-5 text-foreground" />
                </button>

                {/* Date display and quick nav */}
                <div className="flex items-center gap-4">
                    <div className="flex flex-col items-center">
                        <div className="flex items-center gap-2">
                            <Calendar className="w-4 h-4 text-muted-foreground" />
                            <span className="text-lg font-semibold text-foreground">
                                {formatDisplay(selectedDate)}
                            </span>
                        </div>
                        {isToday && (
                            <span className="text-xs text-primary font-medium mt-1">
                                Today
                            </span>
                        )}
                    </div>

                    {/* Quick nav buttons */}
                    <div className="flex gap-2">
                        {!isToday && (
                            <button
                                onClick={goToToday}
                                className="px-3 py-1.5 text-xs font-medium bg-primary/10 text-primary rounded-lg border border-primary/20 hover:bg-primary/20 transition-colors"
                            >
                                Today
                            </button>
                        )}
                        <button
                            onClick={goToYesterday}
                            className="px-3 py-1.5 text-xs font-medium bg-muted text-muted-foreground rounded-lg border border-border hover:bg-muted/80 transition-colors"
                        >
                            Yesterday
                        </button>
                    </div>
                </div>

                {/* Right navigation */}
                <button
                    onClick={() => navigateDay('next')}
                    disabled={isNextDisabled}
                    className={`p-2 rounded-lg transition-colors border ${isNextDisabled
                        ? 'bg-muted/50 border-border text-muted-foreground/50 cursor-not-allowed'
                        : 'bg-muted hover:bg-muted/80 border-border text-foreground'
                        }`}
                    title="Next day"
                >
                    <ChevronRight className="w-5 h-5" />
                </button>
            </div>
        </div>
    );
};
