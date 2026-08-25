"use client";

import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from "lucide-react";
import { format, addDays, subDays } from "date-fns";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";

interface DateNavigatorProps {
    date: Date;
    setDate: (date: Date) => void;
    isLoading?: boolean;
}

export function DateNavigator({ date, setDate, isLoading }: DateNavigatorProps) {
    return (
        <div className="flex items-center gap-2 bg-background sticky top-0 z-10 px-6 py-4 border-b border-border shadow-sm">
            <Button
                variant="outline"
                size="icon"
                onClick={() => setDate(subDays(date, 1))}
            >
                <ChevronLeft className="h-4 w-4" />
            </Button>

            <Popover>
                <PopoverTrigger asChild>
                    <Button
                        variant="outline"
                        className={cn(
                            "w-[240px] justify-start text-left font-normal",
                            !date && "text-muted-foreground"
                        )}
                    >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {date ? format(date, "EEEE, PPP") : <span>Pick a date</span>}
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                        mode="single"
                        selected={date}
                        onSelect={(d) => d && setDate(d)}
                        initialFocus
                    />
                </PopoverContent>
            </Popover>

            <Button
                variant="outline"
                size="icon"
                onClick={() => setDate(addDays(date, 1))}
            >
                <ChevronRight className="h-4 w-4" />
            </Button>

            <Button
                variant="outline"
                size="sm"
                onClick={() => setDate(new Date())}
                className="ml-2 text-sm font-semibold"
            >
                Today
            </Button>

            {isLoading && (
                <span className="ml-2 text-sm text-muted-foreground animate-pulse">Loading…</span>
            )}
        </div>
    );
}
