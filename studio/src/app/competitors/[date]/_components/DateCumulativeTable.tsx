'use client';

import { TrendingUp } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { CumulativeMovieTrack } from '@/features/competitors/types';

interface DateCumulativeTableProps {
  date: string;
  dateCumulative: CumulativeMovieTrack[];
}

export function DateCumulativeTable({ date, dateCumulative }: DateCumulativeTableProps) {
  if (dateCumulative.length === 0) return null;

  return (
    <Card className="overflow-hidden border-border/50">
      <CardContent className="p-4">
        <h3 className="text-sm font-black uppercase tracking-widest text-muted-foreground mb-3 flex items-center gap-2">
          <TrendingUp className="w-3.5 h-3.5" />
          CinePoint Box Office — {date}
        </h3>
        <div className="overflow-x-auto rounded-xl border border-border/40">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/40 bg-muted/5">
                <th className="text-left py-2.5 px-3 font-black uppercase tracking-[0.15em] text-muted-foreground text-sm">
                  Movie
                </th>
                <th className="text-right py-2.5 px-3 font-black uppercase tracking-[0.15em] text-muted-foreground text-sm">
                  Daily Admissions
                </th>
                <th className="text-right py-2.5 px-3 font-black uppercase tracking-[0.15em] text-muted-foreground text-sm">
                  Change
                </th>
                <th className="text-right py-2.5 px-3 font-black uppercase tracking-[0.15em] text-muted-foreground text-sm">
                  Cumulative
                </th>
                <th className="text-right py-2.5 px-3 font-black uppercase tracking-[0.15em] text-muted-foreground text-sm">
                  W2/W1
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/20">
              {dateCumulative.map((movie) => {
                const pt = movie.data_points.find((p) => p.date === date);
                if (!pt) return null;
                return (
                  <tr key={movie.title_cp} className="hover:bg-muted/5 transition-colors">
                    <td className="py-2.5 px-3 font-bold text-sm">
                      {movie.title_cr || movie.title_cp}
                    </td>
                    <td className="text-right py-2.5 px-3 font-mono">
                      {pt.daily_admissions.toLocaleString()}
                    </td>
                    <td className="text-right py-2.5 px-3">
                      <span className={cn(
                        'font-mono font-bold text-sm',
                        pt.daily_change_pct > 0 ? 'text-emerald-600' : pt.daily_change_pct < 0 ? 'text-red-500' : 'text-muted-foreground',
                      )}>
                        {pt.daily_change_pct > 0 ? '+' : ''}{pt.daily_change_pct}%
                      </span>
                    </td>
                    <td className="text-right py-2.5 px-3 font-mono font-black">
                      {pt.cumulative_admissions > 0 ? pt.cumulative_admissions.toLocaleString() : '—'}
                    </td>
                    <td className="text-right py-2.5 px-3">
                      {movie.drop_rate_w1_w2 !== undefined ? (
                        <span className={cn('font-mono font-bold', movie.drop_rate_w1_w2 < 0.5 ? 'text-red-500' : movie.drop_rate_w1_w2 > 0.7 ? 'text-emerald-600' : 'text-amber-600')}>
                          {(movie.drop_rate_w1_w2 * 100).toFixed(0)}%
                        </span>
                      ) : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
