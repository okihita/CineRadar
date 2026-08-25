'use client';

import { TrendingUp, TrendingDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { deltaColor } from '@/lib/cinepoint';
import { Card, CardContent } from '@/components/ui/card';
import type { CumulativeMovieTrack } from '@/features/competitors/types';

export function BoxOfficeTable({ cumulative }: { cumulative: CumulativeMovieTrack[] }) {
  return (
    <Card className="overflow-hidden border-border/50">
      <CardContent className="p-6">
        <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-4">
          CinePoint Cumulative Box Office Tracker — Top Movies
        </h3>
        {cumulative.length === 0 ? (
          <div className="py-12 text-center text-xs text-muted-foreground">
            No cumulative admissions data yet. Import admission tweets to track box office.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-border/40">
            <table className="w-full text-[11px]">
              <thead>
                <tr className="border-b border-border/40 bg-muted/5">
                  <th className="text-left py-3 px-4 font-black uppercase tracking-[0.15em] text-muted-foreground text-[9px] w-[25%]">
                    Movie
                  </th>
                  <th className="text-right py-3 px-3 font-black uppercase tracking-[0.15em] text-muted-foreground text-[9px]">
                    Cumulative
                  </th>
                  <th className="text-right py-3 px-3 font-black uppercase tracking-[0.15em] text-muted-foreground text-[9px]">
                    Peak Daily
                  </th>
                  <th className="text-right py-3 px-3 font-black uppercase tracking-[0.15em] text-muted-foreground text-[9px]">
                    Opening
                  </th>
                  <th className="text-right py-3 px-3 font-black uppercase tracking-[0.15em] text-muted-foreground text-[9px]">
                    Days
                  </th>
                  <th className="text-right py-3 px-3 font-black uppercase tracking-[0.15em] text-muted-foreground text-[9px]">
                    W2/W1 Drop
                  </th>
                  <th className="text-right py-3 px-3 font-black uppercase tracking-[0.15em] text-muted-foreground text-[9px]">
                    Trend
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/20">
                {cumulative.slice(0, 15).map((movie) => {
                  const lastPt = movie.data_points[movie.data_points.length - 1];
                  const prevPt = movie.data_points.length >= 2 ? movie.data_points[movie.data_points.length - 2] : null;
                  const trend = prevPt && lastPt ? lastPt.daily_admissions - prevPt.daily_admissions : 0;

                  return (
                    <tr key={movie.title_cp} className="hover:bg-muted/5 transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-bold text-[12px] tracking-tight">{movie.title_cr || movie.title_cp}</div>
                        {movie.title_cr && movie.title_cr !== movie.title_cp && (
                          <div className="text-muted-foreground/50 text-[9px] uppercase tracking-wider mt-0.5">
                            CP: {movie.title_cp}
                          </div>
                        )}
                      </td>
                      <td className="text-right py-3 px-3 font-mono font-black">
                        {movie.latest_cumulative > 0
                          ? movie.latest_cumulative.toLocaleString()
                          : '—'}
                      </td>
                      <td className="text-right py-3 px-3 font-mono">
                        {movie.peak_daily.toLocaleString()}
                      </td>
                      <td className="text-right py-3 px-3 font-mono">
                        {movie.opening_daily?.toLocaleString() || '—'}
                      </td>
                      <td className="text-right py-3 px-3 font-mono text-muted-foreground">
                        {movie.days_tracked}
                      </td>
                      <td className="text-right py-3 px-3">
                        {movie.drop_rate_w1_w2 !== undefined ? (
                          <span className={cn('font-mono font-bold', movie.drop_rate_w1_w2 < 0.5 ? 'text-red-500' : movie.drop_rate_w1_w2 > 0.7 ? 'text-emerald-600' : 'text-amber-600')}>
                            {(movie.drop_rate_w1_w2 * 100).toFixed(0)}%
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="text-right py-3 px-3">
                        <span className={cn('flex items-center justify-end gap-0.5', deltaColor(trend))}>
                          {trend > 0 ? <TrendingUp className="w-3 h-3" /> : trend < 0 ? <TrendingDown className="w-3 h-3" /> : null}
                          <span className="font-mono font-bold">
                            {trend !== 0 ? `${trend > 0 ? '+' : ''}${trend.toLocaleString()}` : '—'}
                          </span>
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {cumulative.length > 0 && (
          <div className="mt-4 px-4 py-3 rounded-lg border border-border/40 bg-muted/5 text-[11px] text-muted-foreground leading-relaxed">
            <span className="font-semibold text-foreground">W2/W1 Drop Rate:</span> Ratio of 2nd-week average daily admissions to 1st-week average. 
            A value of 50% means the movie lost half its audience by week 2. 
            Industry standard: &gt;70% is strong legs, &lt;40% is front-loaded.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
