'use client';

import { useMemo } from 'react';
import { format, parseISO, subDays, differenceInDays } from 'date-fns';
import { Film, TrendingUp, MessageSquare, X, Layers, ExternalLink, AlertTriangle } from 'lucide-react';
import { Calendar as CalendarPicker } from '@/components/ui/calendar';
import { buildCinepointVerifyUrl } from '@/features/competitors/lib/verify-link';
import { cn } from '@/lib/utils';
import type { TweetSourceSummary, TweetType, SnapshotStatus } from '@/features/competitors/types';
import { TWEET_TYPE_CONFIG } from '@/features/competitors/types';

// ─── Coverage Data ─────────────────────────────────────────

export interface DateCoverage {
  date: string;
  status: SnapshotStatus;
}

// ─── Type Config ───────────────────────────────────────────

const TYPE_ICONS: Record<TweetType, typeof Film> = {
  showtimes: Film,
  admissions: TrendingUp,
  other: MessageSquare,
};

// ─── Props ─────────────────────────────────────────────────

interface FilterSidebarProps {
  sources: TweetSourceSummary[];
  activeSource: string | null;
  onSourceChange: (source: string | null) => void;
  activeType: TweetType | null;
  onTypeChange: (type: TweetType | null) => void;
  typeCounts?: Record<TweetType, number>;
  // Calendar props
  coverageData: DateCoverage[];
  otherDates: Set<string>;
  currentDateInView: Date | undefined;
  onDateSelect: (date: Date) => void;
}

// ─── Component ─────────────────────────────────────────────

export function FilterSidebar({
  sources,
  activeSource,
  onSourceChange,
  activeType,
  onTypeChange,
  typeCounts,
  coverageData,
  otherDates,
  currentDateInView,
  onDateSelect,
}: FilterSidebarProps) {
  const hasActiveFilter = activeSource !== null || activeType !== null;

  const clearAll = () => {
    onSourceChange(null);
    onTypeChange(null);
  };

  // ── Calendar coverage computations ──
  const coverageMap = useMemo(() => {
    const map = new Map<string, SnapshotStatus>();
    for (const c of coverageData) {
      if (c.status !== 'empty') map.set(c.date, c.status);
    }
    return map;
  }, [coverageData]);

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

  const partialDates = useMemo(
    () => new Set(
      coverageData.filter((c) => c.status === 'showtimes_only' || c.status === 'admissions_only').map((c) => c.date),
    ),
    [coverageData],
  );

  const missingDates = useMemo(() => computeMissingDates(coverageMap), [coverageMap]);
  const needsAttention = missingDates.size + partialDates.size;

  const otherOnlyDates = useMemo(() => {
    const dates: string[] = [];
    for (const d of otherDates) {
      if (!showtimeDates.has(d) && !admissionDates.has(d)) {
        dates.push(d);
      }
    }
    return dates.sort().reverse();
  }, [otherDates, showtimeDates, admissionDates]);

  const attentionDates = useMemo(() => {
    const items: { date: string; missing: string }[] = [];
    for (const date of Array.from(missingDates).sort().reverse().slice(0, 5)) {
      items.push({ date, missing: 'showtimes + admissions' });
    }
    for (const date of Array.from(partialDates).sort().reverse()) {
      const hasS = showtimeDates.has(date);
      const hasA = admissionDates.has(date);
      if (!hasS && hasA) items.push({ date, missing: 'showtimes' });
      if (hasS && !hasA) items.push({ date, missing: 'admissions' });
    }
    return items.slice(0, 5);
  }, [missingDates, partialDates, showtimeDates, admissionDates]);

  return (
    <aside className="lg:col-span-3 space-y-6 lg:sticky lg:top-24 h-fit">
      {/* Active filter indicator */}
      {hasActiveFilter && (
        <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-primary/5 border border-primary/15">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse flex-shrink-0" />
            <span className="text-[10px] font-bold text-primary/70 truncate">
              Filtered
              {activeSource && <span className="font-normal text-muted-foreground"> · @{activeSource}</span>}
              {activeType && (
                <span className="font-normal text-muted-foreground"> · {TWEET_TYPE_CONFIG[activeType].label}</span>
              )}
            </span>
          </div>
          <button
            onClick={clearAll}
            className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground/50 hover:text-foreground flex items-center gap-1 transition-colors flex-shrink-0"
          >
            <X className="w-3 h-3" />
            Clear
          </button>
        </div>
      )}

      {/* Calendar Navigation */}
      <div className="bg-card border border-border/40 rounded-[2rem] p-4 shadow-sm">
        <h3 className="px-1 mb-3 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/40 flex items-center justify-between">
          Temporal Navigation
          <span className="text-primary/60 font-mono">{coverageMap.size} Days</span>
        </h3>

        <div className="border border-border/20 rounded-2xl overflow-hidden bg-muted/5 p-1">
          <CalendarPicker
            mode="single"
            selected={currentDateInView}
            disabled={{ after: new Date() }}
            onSelect={(date) => { if (date) onDateSelect(date); }}
            onDayClick={(date) => { onDateSelect(date); }}
            modifiers={{
              dotSAO: (date) => { const ds = format(date, 'yyyy-MM-dd'); return showtimeDates.has(ds) && admissionDates.has(ds) && otherDates.has(ds); },
              dotSO: (date) => { const ds = format(date, 'yyyy-MM-dd'); return showtimeDates.has(ds) && !admissionDates.has(ds) && otherDates.has(ds); },
              dotAO: (date) => { const ds = format(date, 'yyyy-MM-dd'); return !showtimeDates.has(ds) && admissionDates.has(ds) && otherDates.has(ds); },
              dotSA: (date) => { const ds = format(date, 'yyyy-MM-dd'); return showtimeDates.has(ds) && admissionDates.has(ds) && !otherDates.has(ds); },
              dotS: (date) => { const ds = format(date, 'yyyy-MM-dd'); return showtimeDates.has(ds) && !admissionDates.has(ds) && !otherDates.has(ds); },
              dotA: (date) => { const ds = format(date, 'yyyy-MM-dd'); return !showtimeDates.has(ds) && admissionDates.has(ds) && !otherDates.has(ds); },
              dotO: (date) => { const ds = format(date, 'yyyy-MM-dd'); return !showtimeDates.has(ds) && !admissionDates.has(ds) && otherDates.has(ds); },
              missingData: (date) => missingDates.has(format(date, 'yyyy-MM-dd')),
            }}
            modifiersClassNames={{
              dotSAO: 'rdp-dot-sao',
              dotSO: 'rdp-dot-so',
              dotAO: 'rdp-dot-ao',
              dotSA: 'rdp-dot-sa',
              dotS: 'rdp-dot-s',
              dotA: 'rdp-dot-a',
              dotO: 'rdp-dot-o',
              missingData: 'ring-1 ring-red-400/40 ring-inset rounded text-red-400/70 font-medium',
            }}
            className="w-full"
          />
        </div>

        <style dangerouslySetInnerHTML={{ __html: DOT_STYLES }} />

        {/* Legend */}
        <div className="mt-3 space-y-2 px-1">
          <div className="flex items-center gap-3 text-[10px] font-bold flex-wrap">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-blue-500" />
              <span className="text-muted-foreground">Showtimes</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span className="text-muted-foreground">Admissions</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-orange-500" />
              <span className="text-muted-foreground">Other ({otherDates.size})</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full border border-red-400/40 bg-transparent" />
              <span className="text-muted-foreground">Missing ({missingDates.size})</span>
            </span>
          </div>

          {/* Non-Data Signals */}
          {otherOnlyDates.length > 0 && (
            <div className="px-3 py-2 rounded-xl bg-orange-500/[0.03] border border-orange-500/15 space-y-2">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-3 h-3 text-orange-500/70 flex-shrink-0" />
                <p className="text-[10px] font-bold text-orange-600/70 uppercase tracking-wider">
                  {otherOnlyDates.length} Non-Data Signal{otherOnlyDates.length > 1 ? 's' : ''}
                </p>
              </div>
              <div className="space-y-1 pt-1 border-t border-orange-500/10">
                {otherOnlyDates.slice(0, 3).map((date) => (
                  <div key={date} className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-mono text-muted-foreground/50">
                      {format(parseISO(date), 'EEE, MMM d')}
                      <span className="font-medium text-orange-600/50"> — other only</span>
                    </span>
                    <a
                      href={buildCinepointVerifyUrl(date)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[9px] tracking-wider text-muted-foreground/25 hover:text-muted-foreground/60 transition-colors flex items-center gap-0.5 flex-shrink-0"
                    >
                      <ExternalLink className="w-2.5 h-2.5" />
                      check
                    </a>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Coverage Gaps */}
          {needsAttention > 0 && attentionDates.length > 0 && (
            <div className="px-3 py-2 rounded-xl bg-muted/5 border border-border/30 space-y-2">
              <p className="text-[10px] font-bold text-muted-foreground/70 uppercase tracking-wider">
                {needsAttention} Gap{needsAttention > 1 ? 's' : ''} in Coverage
              </p>
              <div className="space-y-1 pt-1 border-t border-border/20">
                {attentionDates.map((item) => (
                  <div key={item.date} className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-mono text-muted-foreground/50">
                      {format(parseISO(item.date), 'MMM d')}
                      <span className="font-medium"> — no {item.missing}</span>
                    </span>
                    <a
                      href={buildCinepointVerifyUrl(item.date)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[9px] tracking-wider text-muted-foreground/25 hover:text-muted-foreground/60 transition-colors flex items-center gap-0.5 flex-shrink-0"
                    >
                      <ExternalLink className="w-2.5 h-2.5" />
                      check
                    </a>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Source Selection */}
      <div className="space-y-3">
        <h3 className="px-1 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/40">
          Data Sources
        </h3>
        <div className="flex flex-wrap lg:flex-col gap-1.5">
          <button
            onClick={() => onSourceChange(null)}
            className={cn(
              'flex items-center justify-between px-3 py-2 rounded-lg border text-[11px] font-bold transition-all',
              !activeSource
                ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                : 'bg-muted/5 border-border/30 hover:bg-muted/20 text-muted-foreground',
            )}
          >
            <span className="flex items-center gap-2">
              <Layers className={cn('w-3 h-3', !activeSource ? 'text-primary-foreground' : 'opacity-40')} />
              All Accounts
            </span>
          </button>
          {sources.map((s) => (
            <button
              key={s.handle}
              onClick={() => onSourceChange(activeSource === s.handle ? null : s.handle)}
              className={cn(
                'flex items-center justify-between px-3 py-2 rounded-lg border text-[11px] font-bold transition-all group',
                activeSource === s.handle
                  ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                  : 'bg-muted/5 border-border/30 hover:bg-muted/20 text-muted-foreground',
              )}
            >
              <span className="truncate pr-2">@{s.handle}</span>
              <span className={cn(
                'font-mono text-[10px] px-1.5 py-0.5 rounded-md',
                activeSource === s.handle ? 'bg-white/20' : 'bg-muted text-muted-foreground/50',
              )}>
                {s.tweet_count}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Type Filtering */}
      <div className="space-y-3">
        <h3 className="px-1 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/40">
          Tweet Content
        </h3>
        <div className="flex flex-wrap lg:flex-col gap-1.5">
          <button
            onClick={() => onTypeChange(null)}
            className={cn(
              'flex items-center gap-2 px-3 py-2 rounded-lg border text-[11px] font-bold transition-all',
              !activeType
                ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                : 'bg-muted/5 border-border/30 hover:bg-muted/20 text-muted-foreground',
            )}
          >
            <Layers className={cn('w-3 h-3', !activeType ? 'text-primary-foreground' : 'opacity-40')} />
            All Types
          </button>

          {(Object.entries(TWEET_TYPE_CONFIG) as [TweetType, typeof TWEET_TYPE_CONFIG.showtimes][]).map(([type, cfg]) => {
            const Icon = TYPE_ICONS[type];
            const count = typeCounts?.[type] ?? 0;
            return (
              <button
                key={type}
                onClick={() => onTypeChange(activeType === type ? null : type)}
                className={cn(
                  'flex items-center justify-between px-3 py-2 rounded-lg border text-[11px] font-bold transition-all',
                  activeType === type
                    ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                    : `${cfg.color} hover:opacity-80`,
                )}
              >
                <span className="flex items-center gap-2">
                  <Icon className={cn('w-3 h-3', activeType === type ? 'text-primary-foreground' : 'opacity-70')} />
                  {cfg.label}
                </span>
                <span className={cn(
                  'font-mono text-[10px] px-1.5 py-0.5 rounded-md',
                  activeType === type ? 'bg-white/20' : 'bg-black/5',
                )}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </aside>
  );
}

// ─── Helpers ───────────────────────────────────────────────

function computeMissingDates(coverageMap: Map<string, SnapshotStatus>): Set<string> {
  const latest = new Date();
  const earliest = new Date(2026, 0, 1);
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

const DOT_STYLES = `
.rdp-dot-sao,
.rdp-dot-so,
.rdp-dot-ao,
.rdp-dot-sa,
.rdp-dot-s,
.rdp-dot-a,
.rdp-dot-o {
  position: relative;
  font-weight: 700;
}

.rdp-dot-sao::after {
  content: '';
  position: absolute;
  bottom: 1px;
  left: 50%;
  transform: translateX(-50%);
  width: 14px;
  height: 4px;
  background:
    radial-gradient(circle at 2px 2px, #3b82f6 1.5px, transparent 1.5px),
    radial-gradient(circle at 7px 2px, #22c55e 1.5px, transparent 1.5px),
    radial-gradient(circle at 12px 2px, #f97316 1.5px, transparent 1.5px);
}

.rdp-dot-so::after {
  content: '';
  position: absolute;
  bottom: 1px;
  left: 50%;
  transform: translateX(-50%);
  width: 10px;
  height: 4px;
  background:
    radial-gradient(circle at 2px 2px, #3b82f6 1.5px, transparent 1.5px),
    radial-gradient(circle at 8px 2px, #f97316 1.5px, transparent 1.5px);
}

.rdp-dot-ao::after {
  content: '';
  position: absolute;
  bottom: 1px;
  left: 50%;
  transform: translateX(-50%);
  width: 10px;
  height: 4px;
  background:
    radial-gradient(circle at 2px 2px, #22c55e 1.5px, transparent 1.5px),
    radial-gradient(circle at 8px 2px, #f97316 1.5px, transparent 1.5px);
}

.rdp-dot-sa::after {
  content: '';
  position: absolute;
  bottom: 1px;
  left: 50%;
  transform: translateX(-50%);
  width: 8px;
  height: 4px;
  background:
    radial-gradient(circle at 2px 2px, #3b82f6 1.5px, transparent 1.5px),
    radial-gradient(circle at 6px 2px, #22c55e 1.5px, transparent 1.5px);
}

.rdp-dot-s::after {
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

.rdp-dot-a::after {
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

.rdp-dot-o::after {
  content: '';
  position: absolute;
  bottom: 1px;
  left: 50%;
  transform: translateX(-50%);
  width: 4px;
  height: 4px;
  background: #f97316;
  border-radius: 50%;
}
`;
