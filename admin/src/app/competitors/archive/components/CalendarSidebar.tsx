'use client';

import { useState } from 'react';
import { format, parseISO, subDays, differenceInDays } from 'date-fns';
import { Calendar as CalendarPicker } from '@/components/ui/calendar';
import { TrendingUp, ExternalLink } from 'lucide-react';
import { BatchUrlImport } from './BatchUrlImport';

interface CalendarSidebarProps {
  availableDates: Set<string>;
  currentDateInView: Date | undefined;
  onDateSelect: (date: Date) => void;
  onImportComplete: () => void;
}

export function CalendarSidebar({
  availableDates,
  currentDateInView,
  onDateSelect,
  onImportComplete,
}: CalendarSidebarProps) {
  const [showImporter, setShowImporter] = useState(false);
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

          {/* Gap CTA — actionable card when missing dates exist */}
          {missingDates.size > 0 && !showImporter && (
            <div className="px-3 py-3 rounded-xl bg-red-500/5 border border-red-500/15 space-y-2">
              <p className="text-[10px] font-bold text-red-600/80 uppercase tracking-wider">
                {missingDates.size} Date{missingDates.size > 1 ? 's' : ''} Missing
              </p>
              <p className="text-[10px] text-muted-foreground leading-relaxed">
                Paste CinePoint tweet URLs to fill the gaps.
              </p>
              <div className="flex items-center gap-2 pt-1">
                <button
                  onClick={() => setShowImporter(true)}
                  className="flex-1 py-1.5 rounded-lg bg-primary text-primary-foreground text-[9px] font-bold uppercase tracking-wider hover:bg-primary/90 transition-colors"
                >
                  Paste Tweet URLs
                </button>
                <a
                  href="https://x.com/cinepoint_"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg border border-border/40 text-[9px] font-bold text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors"
                >
                  <ExternalLink className="w-2.5 h-2.5" />
                  Open @cinepoint_
                </a>
              </div>
            </div>
          )}
        </div>

        {/* Inline batch URL importer */}
        {showImporter && (
          <div className="mt-4 px-2 animate-in fade-in slide-in-from-top-2 duration-300">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/60">
                Import from URLs
              </span>
              <button
                onClick={() => setShowImporter(false)}
                className="text-[9px] text-muted-foreground/40 hover:text-muted-foreground"
              >
                Close
              </button>
            </div>
            <BatchUrlImport onComplete={onImportComplete} />
          </div>
        )}

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
