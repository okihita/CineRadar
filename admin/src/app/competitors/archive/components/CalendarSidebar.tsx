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

  const partialDates = useMemo(
    () => new Set(
      coverageData.filter((c) => c.status === 'showtimes_only' || c.status === 'admissions_only').map((c) => c.date),
    ),
    [coverageData],
  );

  // Build per-data-point sets for 2-dot indicator
  const showtimeDates = useMemo(
    () => new Set(
      coverageData
        .filter((c) => c.status === 'complete' || c.status === 'showtimes_only')
        .map((c) => c.date),
    ),
    [coverageData],
  );

  const admissionDates = useMemo(
    () => new Set(
      coverageData
        .filter((c) => c.status === 'complete' || c.status === 'admissions_only')
        .map((c) => c.date),
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
              // Both data points
              complete: (date) => {
                const ds = format(date, 'yyyy-MM-dd');
                return showtimeDates.has(ds) && admissionDates.has(ds);
              },
              // Only showtimes
              showtimesOnly: (date) => {
                const ds = format(date, 'yyyy-MM-dd');
                return showtimeDates.has(ds) && !admissionDates.has(ds);
              },
              // Only admissions
              admissionsOnly: (date) => {
                const ds = format(date, 'yyyy-MM-dd');
                return !showtimeDates.has(ds) && admissionDates.has(ds);
              },
              // Missing (in range but no data)
              missingData: (date) => missingDates.has(format(date, 'yyyy-MM-dd')),
            }}
            modifiersClassNames={{
              complete: "rdp-dot-both",
              showtimesOnly: "rdp-dot-showtimes",
              admissionsOnly: "rdp-dot-admissions",
              missingData: "ring-1 ring-red-400/40 ring-inset rounded text-red-400/70 font-medium",
            }}
            className="w-full"
          />
        </div>

        {/* Custom dot styles for per-day data indicators */}
        <style dangerouslySetInnerHTML={{ __html: DOT_STYLES }} />

        {/* Legend + Gap CTA */}
        <div className="mt-4 space-y-2 px-2">
          <div className="flex items-center gap-3 text-[10px] font-bold flex-wrap">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span className="text-muted-foreground">Showtimes</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-blue-500" />
              <span className="text-muted-foreground">Admissions</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full border border-red-400/40 bg-transparent" />
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

// ─── Calendar Dot Styles ───────────────────────────────────

/**
 * CSS for per-day data indicators on the calendar.
 *
 * Three states via pseudo-element ::after:
 * - .rdp-dot-both: two dots (green + blue) — has showtimes AND admissions
 * - .rdp-dot-showtimes: single green dot — has showtimes only
 * - .rdp-dot-admissions: single blue dot — has admissions only
 * - .ring-1.ring-red-400/40: red ring — missing (in range, no data)
 */
const DOT_STYLES = `
.rdp-dot-both,
.rdp-dot-showtimes,
.rdp-dot-admissions {
  position: relative;
  font-weight: 700;
}
.rdp-dot-both::after {
  content: '';
  position: absolute;
  bottom: 1px;
  left: 50%;
  transform: translateX(-50%);
  width: 8px;
  height: 4px;
  background:
    radial-gradient(circle at 2px 2px, #22c55e 1.5px, transparent 1.5px),
    radial-gradient(circle at 6px 2px, #3b82f6 1.5px, transparent 1.5px);
}
.rdp-dot-showtimes::after {
  content: '';
  position: absolute;
  bottom: 1px;
  left: 50%;
  transform: translateX(-50%);
  width: 4px;
  height: 4px;
  background: #22c55e;
  border-radius: 50%;
}
.rdp-dot-admissions::after {
  content: '';
  position: absolute;
  bottom: 1px;
  left: 50%;
  transform: translateX(-50%);
  width: 4px;
  height: 4px;
  background: #3b82f6;
  border-radius: 50%;
}
`;
