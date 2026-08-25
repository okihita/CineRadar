'use client';

import { cn } from '@/lib/utils';
import { deltaColor, heatmapCellBg, heatmapCellLabel } from '@/lib/cinepoint';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import type { HeatmapCell } from '@/features/competitors/types';

export function HeatmapTable({ heatmapData, heatmapDates }: { heatmapData: HeatmapCell[]; heatmapDates: string[] }) {
  return (
    <Card className="overflow-hidden border-border/50">
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-black uppercase tracking-widest text-muted-foreground">
            Per-Movie Accuracy Heatmap — Last {heatmapDates.length} Days
          </h3>
          <div className="flex items-center gap-3 text-sm font-bold">
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-emerald-500/20 border border-emerald-500/30" /> Matched (&lt;5%)</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-amber-500/20 border border-amber-500/30" /> High Drift (&gt;5%)</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-red-500/20 border border-red-500/30" /> Unmatched</span>
          </div>
        </div>

        {heatmapData.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted-foreground">
            No heatmap data available.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/40">
                  <th className="text-left py-2 px-3 font-black uppercase tracking-widest text-muted-foreground/60 w-[140px]">
                    Movie
                  </th>
                  <th className="text-center py-2 px-1 font-black uppercase tracking-widest text-muted-foreground/60 w-[40px]">
                    Issues
                  </th>
                  <th className="text-center py-2 px-1 font-black uppercase tracking-widest text-muted-foreground/60 w-[50px]">
                    Avg Δ%
                  </th>
                  {heatmapDates.map((d) => (
                    <th key={d} className="text-center py-2 px-1 font-mono font-bold text-muted-foreground/50 w-[52px]">
                      {d.substring(5)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/20">
                {heatmapData.map((movie) => (
                  <tr key={movie.title_cp} className="hover:bg-muted/5 transition-colors">
                    <td className="py-2 px-3 font-bold truncate max-w-[140px]" title={movie.title_cp}>
                      {movie.title_cp}
                    </td>
                    <td className="text-center py-2 px-1">
                      {movie.total_unmatched > 0 ? (
                        <Badge variant="outline" className="text-sm h-4 px-1 bg-red-500/10 text-red-600 border-red-500/20">
                          {movie.total_unmatched}
                        </Badge>
                      ) : (
                        <span className="text-emerald-500 text-sm">✓</span>
                      )}
                    </td>
                    <td className={cn('text-center py-2 px-1 font-mono font-bold', deltaColor(movie.avg_deviation))}>
                      {movie.avg_deviation !== null ? `${movie.avg_deviation.toFixed(1)}%` : '—'}
                    </td>
                    {heatmapDates.map((date) => {
                      const cell = movie.dates[date];
                      if (!cell) {
                        return (
                          <td key={date} className="text-center py-2 px-1">
                            <span className="text-muted-foreground/20">—</span>
                          </td>
                        );
                      }
                      return (
                        <td key={date} className="text-center py-2 px-1">
                          <div
                            className={cn('mx-auto w-[44px] h-[22px] flex items-center justify-center rounded border text-sm font-bold', heatmapCellBg(cell.status))}
                            title={`${movie.title_cp} on ${date}: ${cell.matched ? `delta ${cell.delta_pct}%` : 'unmatched'}`}
                          >
                            {heatmapCellLabel(cell.status, cell.delta_pct)}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {heatmapData.filter((m) => m.total_unmatched > 0).length > 0 && (
          <div className="mt-4 px-4 py-3 rounded-lg border border-red-500/20 bg-red-500/5 text-sm">
            <p className="font-bold text-red-600 mb-1">Inventory Blindspots Detected</p>
            <p className="text-muted-foreground">
              These movies appear in CinePoint&apos;s reports but CineRadar cannot match them. 
              This may indicate missing movies in the database or gaps in cinema coverage.
            </p>
            <div className="flex flex-wrap gap-1.5 mt-2">
              {heatmapData
                .filter((m) => m.total_unmatched > 0)
                .map((m) => (
                  <Badge key={m.title_cp} variant="outline" className="text-sm h-5 bg-red-500/10 text-red-600 border-red-500/20">
                    {m.title_cp} ({m.total_unmatched}d)
                  </Badge>
                ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
