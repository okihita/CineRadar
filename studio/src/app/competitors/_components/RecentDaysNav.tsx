'use client';

import { format, subDays } from 'date-fns';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import type { TrendDay } from '@/features/competitors/types';

export function RecentDaysNav({ trendDays, daysWithDataCount }: { trendDays: TrendDay[]; daysWithDataCount: number }) {
  return (
    <Card className="overflow-hidden border-border/50">
      <CardContent className="p-3">
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-sm font-black uppercase tracking-widest text-muted-foreground/50">
              Recent 14 Days
            </span>
            <span className="text-sm font-bold text-muted-foreground/40">
              {daysWithDataCount} days with data
            </span>
          </div>
          <div className="flex gap-1">
            {Array.from({ length: 14 }, (_, i) => {
              const d = subDays(new Date(), 13 - i);
              const dateStr = format(d, 'yyyy-MM-dd');
              const dayData = trendDays.find((t) => t.date === dateStr);

              let statusColor = 'bg-muted/30 text-muted-foreground/40 border-border/20';
              if (dayData?.status === 'complete') statusColor = 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20';
              else if (dayData?.status === 'showtimes_only') statusColor = 'bg-amber-500/10 text-amber-600 border-amber-500/20';
              else if (dayData?.status === 'admissions_only') statusColor = 'bg-blue-500/10 text-blue-600 border-blue-500/20';

              return (
                <Link
                  key={dateStr}
                  href={`/competitors/${dateStr}`}
                  className={cn(
                    'flex-1 flex flex-col items-center gap-0.5 py-1.5 px-0.5 rounded-md border text-sm font-bold transition-colors',
                    statusColor,
                    'hover:bg-primary/10 hover:border-primary/20',
                  )}
                >
                  <span className="font-mono">{format(d, 'dd')}</span>
                  <span className="uppercase tracking-wider text-muted-foreground/50 text-sm">
                    {format(d, 'EEE')}
                  </span>
                  {dayData?.confidence && (
                    <span className={cn('w-1 h-1 rounded-full', dayData.confidence.level === 'excellent' ? 'bg-emerald-500' : dayData.confidence.level === 'good' ? 'bg-blue-500' : dayData.confidence.level === 'warning' ? 'bg-amber-500' : 'bg-red-500')} />
                  )}
                </Link>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
