'use client';

import { format, parseISO, subDays, differenceInDays } from 'date-fns';
import { Calendar as CalendarPicker } from '@/components/ui/calendar';
import { TrendingUp } from 'lucide-react';

interface CalendarSidebarProps {
  availableDates: Set<string>;
  currentDateInView: Date | undefined;
  onDateSelect: (date: Date) => void;
}

export function CalendarSidebar({
  availableDates,
  currentDateInView,
  onDateSelect,
}: CalendarSidebarProps) {
  // Compute missing dates
  const missingDates = computeMissingDates(availableDates);

  return (
    <aside className="lg:col-span-3 space-y-8 lg:sticky lg:top-24 h-fit">
      <div className="bg-card border border-border/40 rounded-[2.5rem] p-6 shadow-sm">
        <h3 className="px-2 mb-4 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/40 flex items-center justify-between">
          Temporal Navigation
          <span className="text-primary/60 font-mono">{availableDates.size} Days</span>
        </h3>

        <div className="border border-border/20 rounded-2xl overflow-hidden bg-muted/5 p-1">
          <CalendarPicker
            mode="single"
            selected={currentDateInView}
            disabled={{ after: new Date() }}
            onSelect={(date) => {
              if (date) onDateSelect(date);
            }}
            onDayClick={(date) => {
              onDateSelect(date);
            }}
            modifiers={{
              hasData: (date) => availableDates.has(format(date, 'yyyy-MM-dd')),
              missingData: (date) => missingDates.has(format(date, 'yyyy-MM-dd')),
            }}
            modifiersClassNames={{
              hasData: "relative after:absolute after:bottom-1 after:left-1/2 after:-translate-x-1/2 after:w-1 after:h-1 after:bg-primary after:rounded-full font-bold text-foreground",
              missingData: "relative after:absolute after:bottom-1 after:left-1/2 after:-translate-x-1/2 after:w-1 after:h-1 after:bg-red-400 after:rounded-full text-red-400/80 font-medium",
            }}
            className="w-full"
          />
        </div>

        {/* Legend */}
        <div className="mt-4 space-y-2 px-2">
          <div className="flex items-center gap-3 text-[10px] font-bold">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-primary" />
              <span className="text-muted-foreground">Has Data ({availableDates.size} days)</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-red-400" />
              <span className="text-muted-foreground">Missing ({missingDates.size})</span>
            </span>
          </div>
          {missingDates.size > 0 && (
            <div className="px-3 py-2 rounded-xl bg-red-500/5 border border-red-500/15">
              <p className="text-[10px] font-bold text-red-600/80 uppercase tracking-wider">
                Gap Detected
              </p>
              <p className="text-[10px] text-muted-foreground mt-0.5 leading-relaxed">
                {missingDates.size} date{missingDates.size > 1 ? 's' : ''} within the archive range lack tweet data. Fetch the missing JSON from the source account and import to fill gaps.
              </p>
            </div>
          )}
        </div>

        <div className="mt-6 space-y-4 px-2">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-blue-500/10 rounded-lg">
              <TrendingUp className="w-3.5 h-3.5 text-blue-500" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-tight">Timeline Sync</p>
              <p className="text-[11px] text-muted-foreground leading-tight mt-0.5 font-medium">
                Select a date with a dot to jump to that forensic evidence.
              </p>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}

// ─── Helper ────────────────────────────────────────────────

function computeMissingDates(availableDates: Set<string>): Set<string> {
  const dates = Array.from(availableDates).sort();
  if (dates.length < 2) return new Set<string>();

  const earliest = parseISO(dates[0]);
  const latest = parseISO(dates[dates.length - 1]);
  const totalDays = differenceInDays(latest, earliest) + 1;

  const missing = new Set<string>();
  for (let i = 0; i < totalDays; i++) {
    const d = format(subDays(latest, i), 'yyyy-MM-dd');
    if (!availableDates.has(d)) {
      missing.add(d);
    }
  }
  return missing;
}
