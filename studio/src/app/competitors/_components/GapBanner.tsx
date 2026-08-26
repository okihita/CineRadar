'use client';

import { format, subDays } from 'date-fns';
import Link from 'next/link';
import { AlertTriangle, ExternalLink, Archive } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { TrendDay } from '@/features/competitors/types';

export function GapBanner({ trendDays }: { trendDays: TrendDay[] }) {
  const recent14 = Array.from({ length: 14 }, (_, i) => {
    const d = subDays(new Date(), 13 - i);
    return format(d, 'yyyy-MM-dd');
  });
  const needsData = recent14.filter((d) => {
    const t = trendDays.find((td) => td.date === d);
    return !t || t.status === 'empty' || t.status === 'showtimes_only' || t.status === 'admissions_only';
  });
  if (needsData.length === 0) return null;

  return (
    <div className="flex items-center justify-between px-4 py-3 rounded-xl border border-amber-500/20 bg-amber-500/5">
      <div className="flex items-center gap-3">
        <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
        <div>
          <span className="text-sm font-bold text-amber-700 dark:text-amber-400">
            {needsData.length} date{needsData.length > 1 ? 's' : ''} in the last 14 days need data
          </span>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <a
          href="https://x.com/cinepoint_"
          target="_blank"
          rel="noopener noreferrer"
          className="h-7 px-3 text-sm font-bold uppercase tracking-wider flex items-center gap-1.5 rounded-lg border border-border/40 text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors"
        >
          <ExternalLink className="w-3 h-3" />
          @cinepoint_
        </a>
        <Link href="/competitors/archive">
          <Button variant="outline" size="sm" className="h-7 gap-1.5 px-3 text-sm font-bold uppercase tracking-wider">
            <Archive className="w-3 h-3" />
            Backfill in Archive
          </Button>
        </Link>
      </div>
    </div>
  );
}
