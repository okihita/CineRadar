'use client';

import { useRouter } from 'next/navigation';
import { format, addDays, subDays, parseISO } from 'date-fns';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';

interface DateNavigatorHeaderProps {
    date: string; // YYYY-MM-DD
    movieId: string;
}

/**
 * Interactive Date Navigator for the Performance Header HUD
 */
export function DateNavigatorHeader({ date, movieId }: DateNavigatorHeaderProps) {
    const router = useRouter();
    const currentDate = parseISO(date);

    const navigateToDate = (newDate: Date) => {
        const dateStr = format(newDate, 'yyyy-MM-dd');
        router.push(`/performances/${movieId}/${dateStr}`);
    };

    return (
        <div className="flex items-stretch bg-zinc-900/5 dark:bg-white/5 border-l border-border/50 group">
            {/* Prev Day */}
            <Button
                variant="ghost"
                size="icon"
                className="h-full w-10 rounded-none hover:bg-primary/5 text-muted-foreground hover:text-primary transition-colors border-r border-border/20"
                onClick={() => navigateToDate(subDays(currentDate, 1))}
                title="Previous Day"
            >
                <ChevronLeft className="w-4 h-4" />
            </Button>

            {/* Date Selector */}
            <Popover>
                <PopoverTrigger asChild>
                    <button className="flex flex-col items-end px-6 py-2.5 hover:bg-primary/[0.02] transition-colors text-right min-w-[180px]">
                        <div className="flex items-center gap-2 text-muted-foreground mb-0.5">
                            <CalendarIcon className="w-3.5 h-3.5" />
                            <span className="text-[9px] font-black uppercase tracking-widest">
                                Intelligence For
                            </span>
                        </div>
                        <span className="text-xl font-black font-mono tracking-tighter text-primary group-hover:text-primary/80 transition-colors">
                            {date}
                        </span>
                    </button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="end">
                    <Calendar
                        mode="single"
                        selected={currentDate}
                        onSelect={(d) => d && navigateToDate(d)}
                        initialFocus
                    />
                </PopoverContent>
            </Popover>

            {/* Next Day */}
            <Button
                variant="ghost"
                size="icon"
                className="h-full w-10 rounded-none hover:bg-primary/5 text-muted-foreground hover:text-primary transition-colors border-l border-border/20"
                onClick={() => navigateToDate(addDays(currentDate, 1))}
                title="Next Day"
            >
                <ChevronRight className="w-4 h-4" />
            </Button>
        </div>
    );
}
