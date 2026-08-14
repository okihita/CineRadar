'use client';

import { useEffect, useState } from 'react';
import { format, parseISO, subDays } from 'date-fns';
import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';

interface DayInfo {
  date: string;
  status: string;
  showtime_count: number;
  admission_count: number;
}

interface DateRecentDaysNavProps {
  currentDate: string;
}

export function DateRecentDaysNav({ currentDate }: DateRecentDaysNavProps) {
  const [days, setDays] = useState<DayInfo[]>([]);

  useEffect(() => {
    fetch('/api/competitors')
      .then((r) => r.json())
      .then((json) => {
        if (json.success) setDays(json.data);
      })
      .catch(() => {});
  }, []);

  const last7 = Array.from({ length: 7 }, (_, i) => {
    const d = subDays(new Date(), 6 - i);
    return format(d, 'yyyy-MM-dd');
  });

  const dataMap = new Map(days.map((d) => [d.date, d]));

  return (
    <Card className="overflow-hidden border-border/50">
      <CardContent className="p-3">
        <div className="space-y-1.5">
          <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/50">
            Recent 7 Days
          </span>
          <div className="flex gap-1">
            {last7.map((d) => {
              const info = dataMap.get(d);
              const isActive = d === currentDate;

              let statusColor = 'bg-muted/30 text-muted-foreground/40';
              if (info?.status === 'complete') statusColor = 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20';
              else if (info?.status === 'showtimes_only') statusColor = 'bg-amber-500/10 text-amber-600 border-amber-500/20';
              else if (info?.status === 'admissions_only') statusColor = 'bg-blue-500/10 text-blue-600 border-blue-500/20';

              return (
                <a
                  key={d}
                  href={`/competitors/${d}`}
                  className={cn(
                    'flex-1 flex flex-col items-center gap-0.5 py-1.5 px-1 rounded-md border text-[9px] font-bold transition-colors',
                    isActive
                      ? 'bg-primary text-primary-foreground border-primary'
                      : `border-border/30 hover:bg-muted/50 ${statusColor}`,
                  )}
                >
                  <span className="font-mono">{format(parseISO(d), 'dd')}</span>
                  <span className={cn('uppercase tracking-wider', isActive ? 'text-primary-foreground/70' : 'text-muted-foreground/50')}>
                    {format(parseISO(d), 'EEE')}
                  </span>
                </a>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
