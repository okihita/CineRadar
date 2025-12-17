'use client';

import { useState } from 'react';
import { Calendar, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DateRangePickerProps {
    value: { start: string; end: string };
    onChange: (range: { start: string; end: string }) => void;
    className?: string;
}

const PRESETS = [
    { label: 'Last 7 days', days: 7 },
    { label: 'Last 14 days', days: 14 },
    { label: 'Last 30 days', days: 30 },
    { label: 'Last 90 days', days: 90 },
];

export function DateRangePicker({ value, onChange, className }: DateRangePickerProps) {
    const [open, setOpen] = useState(false);

    const formatDate = (date: Date) => date.toISOString().split('T')[0];

    const selectPreset = (days: number) => {
        const end = new Date();
        const start = new Date();
        start.setDate(end.getDate() - days);
        onChange({ start: formatDate(start), end: formatDate(end) });
        setOpen(false);
    };

    const displayLabel = () => {
        const startDate = new Date(value.start);
        const endDate = new Date(value.end);
        const diffDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
        const preset = PRESETS.find(p => p.days === diffDays);
        if (preset) return preset.label;
        return `${value.start} to ${value.end}`;
    };

    return (
        <div className={cn('relative', className)}>
            <button
                onClick={() => setOpen(!open)}
                className="flex items-center gap-2 px-3 py-2 text-sm border rounded-lg hover:bg-muted transition-colors"
            >
                <Calendar className="w-4 h-4 text-muted-foreground" />
                <span>{displayLabel()}</span>
                <ChevronDown className={cn('w-4 h-4 transition-transform', open && 'rotate-180')} />
            </button>

            {open && (
                <div className="absolute top-full mt-1 right-0 z-50 bg-popover border rounded-lg shadow-lg p-2 min-w-[200px]">
                    {/* Presets */}
                    <div className="space-y-1 mb-2">
                        {PRESETS.map((preset) => (
                            <button
                                key={preset.days}
                                onClick={() => selectPreset(preset.days)}
                                className="w-full text-left px-3 py-1.5 text-sm rounded hover:bg-muted transition-colors"
                            >
                                {preset.label}
                            </button>
                        ))}
                    </div>

                    {/* Custom Range */}
                    <div className="border-t pt-2 mt-2">
                        <p className="text-xs text-muted-foreground mb-2">Custom Range</p>
                        <div className="flex gap-2">
                            <input
                                type="date"
                                value={value.start}
                                onChange={(e) => onChange({ ...value, start: e.target.value })}
                                className="flex-1 px-2 py-1 text-xs border rounded bg-background"
                            />
                            <input
                                type="date"
                                value={value.end}
                                onChange={(e) => onChange({ ...value, end: e.target.value })}
                                className="flex-1 px-2 py-1 text-xs border rounded bg-background"
                            />
                        </div>
                        <button
                            onClick={() => setOpen(false)}
                            className="w-full mt-2 px-3 py-1.5 text-xs bg-primary text-primary-foreground rounded hover:bg-primary/90"
                        >
                            Apply
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

// Default date range (last 30 days)
export function getDefaultDateRange() {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - 30);
    return {
        start: start.toISOString().split('T')[0],
        end: end.toISOString().split('T')[0],
    };
}
