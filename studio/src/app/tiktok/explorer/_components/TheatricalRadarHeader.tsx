import React, { useMemo } from 'react';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { TikTokIcon } from '@/components/BrandIcons';
import { isValidDateFormat } from '@/lib/timeUtils';

interface TheatricalRadarHeaderProps {
    selectedDate: string;
    today: string;
    onDateChange: (date: string) => void;
}

export function TheatricalRadarHeader({
    selectedDate,
    today,
    onDateChange,
}: TheatricalRadarHeaderProps) {
    const formattedHeaderDate = useMemo(() => {
        try {
            const [year, month, day] = selectedDate.split('-').map(Number);
            const d = new Date(Date.UTC(year, month - 1, day));
            return new Intl.DateTimeFormat('en-GB', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
                timeZone: 'UTC',
            }).format(d);
        } catch {
            return selectedDate;
        }
    }, [selectedDate]);

    const handlePrevDay = () => {
        const [y, m, d] = selectedDate.split('-').map(Number);
        const dt = new Date(Date.UTC(y, m - 1, d));
        dt.setUTCDate(dt.getUTCDate() - 1);
        onDateChange(dt.toISOString().split('T')[0]);
    };

    const handleNextDay = () => {
        const [y, m, d] = selectedDate.split('-').map(Number);
        const dt = new Date(Date.UTC(y, m - 1, d));
        dt.setUTCDate(dt.getUTCDate() + 1);
        onDateChange(dt.toISOString().split('T')[0]);
    };

    return (
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-border/60 pb-3">
            <div className="flex items-center gap-3">
                <div className="p-2 bg-rose-500/10 text-rose-500 rounded-xl flex items-center justify-center">
                    <TikTokIcon className="w-5 h-5" />
                </div>
                <div>
                    <h1 className="text-xl font-bold tracking-tight text-foreground">Theatrical Radar</h1>
                    <p className="text-muted-foreground text-sm font-medium">
                        Social buzz, audience sentiment, and national executive summary
                    </p>
                </div>
            </div>

            {/* Date Navigator */}
            <div className="flex items-center gap-2 flex-wrap">
                {selectedDate !== today && (
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onDateChange(today)}
                        className="h-8 px-2.5 text-sm font-semibold rounded-lg border-border/60 hover:bg-muted"
                        title="Jump to Today"
                    >
                        Today
                    </Button>
                )}

                <div className="flex items-center rounded-lg border border-border/60 bg-card p-1 shadow-sm">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={handlePrevDay}
                        className="h-7 w-7 rounded-md"
                        title="Previous Day"
                    >
                        <ChevronLeft className="w-4 h-4" />
                    </Button>

                    <div className="flex items-center gap-1.5 px-2.5 text-sm font-bold text-foreground">
                        <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                        <span>{formattedHeaderDate}</span>
                        {selectedDate === today && (
                            <Badge variant="secondary" className="text-sm font-medium py-0 px-1.5 h-5">
                                Today
                            </Badge>
                        )}
                    </div>

                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={handleNextDay}
                        className="h-7 w-7 rounded-md"
                        title="Next Day"
                    >
                        <ChevronRight className="w-4 h-4" />
                    </Button>
                </div>

                <div className="relative flex items-center">
                    <input
                        type="date"
                        value={selectedDate}
                        onChange={(e) => {
                            if (e.target.value && isValidDateFormat(e.target.value)) {
                                onDateChange(e.target.value);
                            }
                        }}
                        className="text-sm bg-card border border-border/60 rounded-lg px-2 py-1 text-muted-foreground hover:text-foreground cursor-pointer h-8"
                        title="Pick Date"
                        aria-label="Pick Date"
                    />
                </div>

                <Badge variant="secondary" className="text-sm font-mono px-2.5 py-1">
                    WIB (UTC+7)
                </Badge>
            </div>
        </div>
    );
}
