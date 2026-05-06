'use client';

import { useRef, useMemo } from 'react';
import { format, parseISO, subDays, differenceInDays } from 'date-fns';
import { Calendar as CalendarPicker } from '@/components/ui/calendar';
import { TrendingUp, ExternalLink, ClipboardPaste } from 'lucide-react';
import { TweetUrlImport } from '@/features/competitors/components/TweetUrlImport';
import type { SnapshotStatus } from '@/features/competitors/types';

// ─── Coverage Data ─────────────────────────────────────────

export interface DateCoverage {
  date: string;
  status: SnapshotStatus;
}

interface CalendarSidebarProps {
  /** Coverage data derived from snapshots API */
  coverageData: DateCoverage[];
  currentDateInView: Date | undefined;
  onDateSelect: (date: Date) => void;
  onImportComplete: () => void;
  /** Callback to open the JSON import modal in the parent */
  onOpenJsonImport?: () => void;
}

// ─── Component ─────────────────────────────────────────────

export function CalendarSidebar({
  coverageData,
  currentDateInView,
  onDateSelect,
  onImportComplete,
  onOpenJsonImport,
}: CalendarSidebarProps) {
  const importRef = useRef<HTMLDivElement>(null);

  // Build sets by status
  const coverageMap = useMemo(() => {
    const map = new Map<string, SnapshotStatus>();
    for (const c of coverageData) {
      if (c.status !== 'empty') map.set(c.date, c.status);
    }
    return map;
  }, [coverageData]);

  const completeDates = useMemo(
    () => new Set(
      coverageData.filter((c) => c.status === 'complete').map((c) => c.date),
    ),
    [coverageData],
  );

  const partialDates = useMemo(
    () => new Set(
      coverageData.filter((c) => c.status === 'showtimes_only' || c.status === 'admissions_only').map((c) => c.date),
    ),
    [coverageData],
  );

  const missingDates = useMemo(() => computeMissingDates(coverageMap), [coverageMap]);

  const needsAttention = missingDates.size + partialDates.size;

  /** Scroll to the import section with a brief highlight */
  const scrollToImport = () => {
    if (!importRef.current) return;
    importRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    importRef.current.classList.add('ring-2', 'ring-primary/30');
    setTimeout(() => {
      importRef.current?.classList.remove('ring-2', 'ring-primary/30');
    }, 1500);
    // Focus the input inside TweetUrlImport
    const input = importRef.current.querySelector('input');
    if (input) setTimeout(() => input.focus(), 300);
  };

  return (
    <aside className="lg:col-span-3 space-y-8 lg:sticky lg:top-24 h-fit">
      <div className="bg-card border border-border/40 rounded-[2.5rem] p-6 shadow-sm">
        <h3 className="px-2 mb-4 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/40 flex items-center justify-between">
          Temporal Navigation
          <span className="text-primary/60 font-mono">{coverageMap.size} Days</span>
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
              complete: (date) => completeDates.has(format(date, 'yyyy-MM-dd')),
              partial: (date) => partialDates.has(format(date, 'yyyy-MM-dd')),
              missingData: (date) => missingDates.has(format(date, 'yyyy-MM-dd')),
            }}
            modifiersClassNames={{
              complete: "relative after:absolute after:bottom-1 after:left-1/2 after:-translate-x-1/2 after:w-1 after:h-1 after:bg-emerald-500 after:rounded-full font-bold text-foreground",
              partial: "relative after:absolute after:bottom-1 after:left-1/2 after:-translate-x-1/2 after:w-1 after:h-1 after:bg-amber-500 after:rounded-full font-bold text-foreground",
              missingData: "relative after:absolute after:bottom-1 after:left-1/2 after:-translate-x-1/2 after:w-1 after:h-1 after:bg-red-400 after:rounded-full text-red-400/80 font-medium",
            }}
            className="w-full"
          />
        </div>

        {/* Legend + Gap CTA */}
        <div className="mt-4 space-y-2 px-2">
          <div className="flex items-center gap-3 text-[10px] font-bold flex-wrap">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span className="text-muted-foreground">Complete ({completeDates.size})</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              <span className="text-muted-foreground">Partial ({partialDates.size})</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-red-400" />
              <span className="text-muted-foreground">Missing ({missingDates.size})</span>
            </span>
          </div>

          {/* Gap CTA — drives attention to the import section below */}
          {needsAttention > 0 && (
            <button
              onClick={scrollToImport}
              className="w-full px-3 py-2.5 rounded-xl bg-amber-500/5 border border-amber-500/15 text-left hover:bg-amber-500/10 transition-colors group"
            >
              <p className="text-[10px] font-bold text-amber-600/80 uppercase tracking-wider">
                {needsAttention} Date{needsAttention > 1 ? 's' : ''} Need Data
              </p>
              <p className="text-[10px] text-muted-foreground leading-relaxed mt-0.5">
                Paste tweet URLs below to fill the gaps →
              </p>
            </button>
          )}
        </div>

        {/* Timeline Sync + Import — always visible */}
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

          {/* Enrich Data — always-visible import card */}
          <div
            ref={importRef}
            className="rounded-xl border border-border/40 bg-muted/5 p-3 transition-all duration-500"
          >
            <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/60 mb-2">
              Enrich Data
            </p>
            <TweetUrlImport onImported={onImportComplete} hideHeading />

            {/* Secondary actions */}
            <div className="flex items-center gap-3 mt-3 pt-3 border-t border-border/20">
              {onOpenJsonImport && (
                <button
                  onClick={onOpenJsonImport}
                  className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground/50 hover:text-muted-foreground flex items-center gap-1 transition-colors"
                >
                  <ClipboardPaste className="w-2.5 h-2.5" />
                  Import JSON
                </button>
              )}
              <a
                href="https://x.com/cinepoint_"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground/50 hover:text-muted-foreground flex items-center gap-1 transition-colors"
              >
                <ExternalLink className="w-2.5 h-2.5" />
                @cinepoint_
              </a>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}

// ─── Helper ────────────────────────────────────────────────

function computeMissingDates(coverageMap: Map<string, SnapshotStatus>): Set<string> {
  const dates = Array.from(coverageMap.keys()).sort();
  if (dates.length < 2) return new Set<string>();

  const earliest = parseISO(dates[0]);
  const latest = parseISO(dates[dates.length - 1]);
  const totalDays = differenceInDays(latest, earliest) + 1;

  const missing = new Set<string>();
  for (let i = 0; i < totalDays; i++) {
    const d = format(subDays(latest, i), 'yyyy-MM-dd');
    if (!coverageMap.has(d)) {
      missing.add(d);
    }
  }
  return missing;
}
