'use client';

import { Film, TrendingUp, MessageSquare } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { TweetSourceSummary, TweetType } from '@/features/competitors/types';

const TYPE_CONFIG: Record<TweetType, { label: string; icon: typeof Film; color: string }> = {
  showtimes: { label: 'Showtimes', icon: Film, color: 'bg-blue-500/10 text-blue-600 border-blue-500/20' },
  admissions: { label: 'Admissions', icon: TrendingUp, color: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' },
  other: { label: 'Other', icon: MessageSquare, color: 'bg-muted/50 text-muted-foreground border-border/30' },
};

interface FilterSidebarProps {
  sources: TweetSourceSummary[];
  activeSource: string | null;
  onSourceChange: (source: string | null) => void;
  activeType: TweetType | null;
  onTypeChange: (type: TweetType | null) => void;
}

export function FilterSidebar({
  sources,
  activeSource,
  onSourceChange,
  activeType,
  onTypeChange,
}: FilterSidebarProps) {
  return (
    <aside className="lg:col-span-2 space-y-8 lg:sticky lg:top-24 h-fit">
      {/* Source Selection */}
      <div className="space-y-4">
        <h3 className="px-1 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/40">
          Data Sources
        </h3>
        <div className="flex flex-wrap lg:flex-col gap-2">
          <button
            onClick={() => onSourceChange(null)}
            className={cn(
              'flex items-center justify-between px-4 py-2.5 rounded-xl border text-[11px] font-bold transition-all',
              !activeSource
                ? 'bg-primary text-primary-foreground border-primary shadow-lg shadow-primary/10 scale-[1.02]'
                : 'bg-muted/5 border-border/40 hover:bg-muted/30 text-muted-foreground',
            )}
          >
            <span>All Accounts</span>
          </button>
          {sources.map((s) => (
            <button
              key={s.handle}
              onClick={() => onSourceChange(activeSource === s.handle ? null : s.handle)}
              className={cn(
                'flex items-center justify-between px-4 py-2.5 rounded-xl border text-[11px] font-bold transition-all group',
                activeSource === s.handle
                  ? 'bg-primary text-primary-foreground border-primary shadow-lg shadow-primary/10 scale-[1.02]'
                  : 'bg-muted/5 border-border/40 hover:bg-muted/30 text-muted-foreground',
              )}
            >
              <span className="truncate pr-2">@{s.handle}</span>
              <span className={cn(
                "font-mono text-[10px] px-1.5 py-0.5 rounded-md",
                activeSource === s.handle ? "bg-white/20" : "bg-muted text-muted-foreground/60"
              )}>{s.tweet_count}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Type Filtering */}
      <div className="space-y-4">
        <h3 className="px-1 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/40">
          Tweet Content
        </h3>
        <div className="flex flex-wrap lg:flex-col gap-2">
          {(Object.entries(TYPE_CONFIG) as [TweetType, typeof TYPE_CONFIG.showtimes][]).map(([type, cfg]) => (
            <button
              key={type}
              onClick={() => onTypeChange(activeType === type ? null : type)}
              className={cn(
                'flex items-center gap-3 px-4 py-2.5 rounded-xl border text-[11px] font-bold transition-all',
                activeType === type
                  ? 'bg-primary text-primary-foreground border-primary shadow-lg shadow-primary/10 scale-[1.02]'
                  : `bg-muted/5 border-border/40 hover:bg-muted/30 text-muted-foreground`,
              )}
            >
              <cfg.icon className={cn("w-3.5 h-3.5", activeType === type ? "text-primary-foreground" : "opacity-60")} />
              {cfg.label}
            </button>
          ))}
        </div>
      </div>
    </aside>
  );
}
