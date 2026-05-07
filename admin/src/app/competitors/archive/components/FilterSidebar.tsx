'use client';

import { Film, TrendingUp, MessageSquare, X, Layers } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { TweetSourceSummary, TweetType } from '@/features/competitors/types';

const TYPE_CONFIG: Record<TweetType, { label: string; icon: typeof Film; color: string; dotColor: string }> = {
  showtimes: {
    label: 'Showtimes',
    icon: Film,
    color: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
    dotColor: 'bg-blue-500',
  },
  admissions: {
    label: 'Admissions',
    icon: TrendingUp,
    color: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
    dotColor: 'bg-emerald-500',
  },
  other: {
    label: 'Other',
    icon: MessageSquare,
    color: 'bg-muted/50 text-muted-foreground border-border/30',
    dotColor: 'bg-muted-foreground/40',
  },
};

interface FilterSidebarProps {
  sources: TweetSourceSummary[];
  activeSource: string | null;
  onSourceChange: (source: string | null) => void;
  activeType: TweetType | null;
  onTypeChange: (type: TweetType | null) => void;
  typeCounts?: Record<TweetType, number>;
}

export function FilterSidebar({
  sources,
  activeSource,
  onSourceChange,
  activeType,
  onTypeChange,
  typeCounts,
}: FilterSidebarProps) {
  const hasActiveFilter = activeSource !== null || activeType !== null;

  const clearAll = () => {
    onSourceChange(null);
    onTypeChange(null);
  };

  return (
    <aside className="lg:col-span-2 space-y-6 lg:sticky lg:top-24 h-fit">
      {/* Active filter indicator — only visible when filtering */}
      {hasActiveFilter && (
        <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-primary/5 border border-primary/15">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse flex-shrink-0" />
            <span className="text-[10px] font-bold text-primary/70 truncate">
              Filtered
              {activeSource && <span className="font-normal text-muted-foreground"> · @{activeSource}</span>}
              {activeType && (
                <span className="font-normal text-muted-foreground"> · {TYPE_CONFIG[activeType].label}</span>
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
          {/* All Types chip */}
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

          {/* Per-type chips with their canonical colors */}
          {(Object.entries(TYPE_CONFIG) as [TweetType, typeof TYPE_CONFIG.showtimes][]).map(([type, cfg]) => {
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
                  <cfg.icon className={cn('w-3 h-3', activeType === type ? 'text-primary-foreground' : 'opacity-70')} />
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
