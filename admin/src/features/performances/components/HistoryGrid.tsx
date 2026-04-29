import { Card, CardContent } from '@/components/ui/card';
import { Calendar, ChevronRight } from 'lucide-react';
import Link from 'next/link';

import { DailyPerformance } from '../types/performance';
import { formatOccupancy, formatCompactNumber } from '../utils/format';

interface HistoryGridProps {
    movieId: string;
    history: DailyPerformance[];
}

function parseDate(dateStr: string) {
    if (!dateStr || typeof dateStr !== 'string') {
        console.error('Invalid date string passed to parseDate:', dateStr);
        return new Date();
    }
    const [y, m, d] = dateStr.split('-');
    return new Date(Number(y), Number(m) - 1, Number(d));
}

function formatDate(d: Date) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function HistoryGrid({ movieId, history }: HistoryGridProps) {
    // Filter history to only include items with a valid date
    const validHistory = (history || []).filter(h => h && h.date && typeof h.date === 'string');

    if (validHistory.length === 0) {
        return (
            <div className="py-12 text-center text-muted-foreground border rounded-lg bg-card mt-6">
                <Calendar className="w-12 h-12 mx-auto mb-3 opacity-20" />
                <p>No historical performance data available for this movie.</p>
            </div>
        );
    }

    const historyMap = new Map(validHistory.map(h => [h.date, h]));

    // Find absolute min and max dates
    const dates = validHistory.map(h => h.date).sort();
    const minDateStr = dates[0];
    const maxDateStr = dates[dates.length - 1];

    const minDate = parseDate(minDateStr);
    const maxDate = parseDate(maxDateStr);

    // Calculate start offset (Sunday = 0, so if minDate is Tuesday (2), we need 2 empty cells)
    const startOffset = minDate.getDay();
    const prefixCells = Array.from({ length: startOffset }, () => null);

    // Calculate dates array
    const daysArray: string[] = [];
    const currDate = parseDate(minDateStr);
    while (currDate <= maxDate) {
        daysArray.push(formatDate(currDate));
        currDate.setDate(currDate.getDate() + 1);
    }

    // Calculate end offset to complete the final row
    const lastDayOfWeek = maxDate.getDay();
    const endOffset = lastDayOfWeek === 6 ? 0 : 6 - lastDayOfWeek;
    const suffixCells = Array.from({ length: endOffset }, () => null);

    const cells = [...prefixCells, ...daysArray, ...suffixCells];

    // Chunk cells into weeks
    const weeks: (string | null)[][] = [];
    for (let i = 0; i < cells.length; i += 7) {
        weeks.push(cells.slice(i, i + 7));
    }

    // Reverse weeks to show the latest weeks first
    weeks.reverse();
    const displayCells = weeks.flat();

    return (
        <div className="overflow-x-auto mt-6 pb-4">
            <div className="min-w-[800px]">
                {/* Days of week header */}
                <div className="grid grid-cols-7 gap-3 mb-2">
                    {WEEKDAYS.map((d, index) => {
                        const isWeekend = index === 0 || index === 6;
                        return (
                            <div key={d} className={`text-center text-sm font-semibold uppercase tracking-wider ${isWeekend ? 'text-red-500/80' : 'text-muted-foreground'}`}>
                                {d}
                            </div>
                        );
                    })}
                </div>

                {/* Calendar Grid */}
                <div className="grid grid-cols-7 gap-3">
                    {displayCells.map((cell, idx) => {
                        if (!cell) {
                            const isWeekend = (idx % 7) === 0 || (idx % 7) === 6;
                            return <div key={`empty-${idx}`} className={`rounded-lg bg-muted/5 border border-dashed min-h-[100px] ${isWeekend ? 'border-red-500/20' : 'border-muted/20'}`} />;
                        }

                        const dayData = historyMap.get(cell);
                        const dateObj = parseDate(cell);
                        const dayMonth = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                        const isWeekend = dateObj.getDay() === 0 || dateObj.getDay() === 6;

                        if (!dayData) {
                            return (
                                <Card key={cell} className={`h-full flex flex-col bg-muted/5 opacity-60 shadow-none border border-dashed ${isWeekend ? 'border-red-500/40' : 'border-muted/40'}`}>
                                    <div className={`px-2 py-1 flex justify-between items-center border-b ${isWeekend ? 'border-red-500/20 bg-red-500/5' : 'bg-muted/10 border-muted/20'}`}>
                                        <span className={`text-sm font-semibold tracking-tight ${isWeekend ? 'text-red-500/70' : 'text-muted-foreground'}`}>
                                            {dayMonth}
                                        </span>
                                    </div>
                                    <CardContent className="p-2 flex-1 flex items-center justify-center">
                                        <span className="text-xs text-muted-foreground font-medium">No data</span>
                                    </CardContent>
                                </Card>
                            );
                        }

                        return (
                            <Link key={cell} href={`/performances/${movieId}/${cell}`}>
                                <Card className={`transition-all cursor-pointer h-full flex flex-col group overflow-hidden shadow-none border ${isWeekend ? 'border-red-500/40 hover:border-red-500/80 bg-red-500/5' : 'border-border hover:border-primary bg-card'}`}>
                                    {/* Card Header */}
                                    <div className={`px-2 py-1 flex justify-between items-center border-b ${isWeekend ? 'bg-red-500/10 border-red-500/20' : 'bg-muted/30 border-muted/20'}`}>
                                        <span className={`text-sm font-bold tracking-tight ${isWeekend ? 'text-red-500' : 'text-foreground'}`}>
                                            {dayMonth}
                                        </span>
                                        <ChevronRight className={`w-3.5 h-3.5 transition-colors ${isWeekend ? 'text-red-500/50 group-hover:text-red-500' : 'text-muted-foreground group-hover:text-primary'}`} />
                                    </div>

                                    <CardContent className="px-2 py-1.5 flex flex-col justify-between flex-1 gap-1">
                                        <p className="text-[10px] text-muted-foreground font-medium leading-tight">
                                            {dayData.cities?.length || 0} Cities • {dayData.total_showtimes} Shows
                                        </p>

                                        <div className="grid grid-cols-2 gap-1 mt-auto">
                                            <div className="bg-muted/50 p-1.5 rounded flex flex-col items-center justify-center">
                                                <p className="text-[9px] font-semibold text-muted-foreground uppercase leading-none mb-0.5">Occ</p>
                                                <p className="font-mono text-xs font-bold leading-none text-primary">
                                                    {formatOccupancy(dayData.avg_occupancy_pct)}%
                                                </p>
                                            </div>
                                            <div className="bg-muted/50 p-1.5 rounded flex flex-col items-center justify-center">
                                                <p className="text-[9px] font-semibold text-muted-foreground uppercase leading-none mb-0.5">Sold</p>
                                                <p className="font-mono text-xs font-bold leading-none">
                                                    {formatCompactNumber(dayData.total_sold)}
                                                </p>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            </Link>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
