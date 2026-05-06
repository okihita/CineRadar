'use client';

import { useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import type { ComparisonRow, ComparisonSummary } from '../types';
import type { CineRadarMovie } from '../types';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface ComparisonTableProps {
  rows: ComparisonRow[];
  summary: ComparisonSummary;
  crMovies: CineRadarMovie[];
  date: string;
  type: 'showtimes' | 'admissions';
  onMatchUpdate: (titleCp: string, movieId: string, movieTitle: string) => void;
}

export function ComparisonTable({
  rows,
  summary,
  crMovies,
  type,
  onMatchUpdate,
}: ComparisonTableProps) {
  const [updatingTitle, setUpdatingTitle] = useState<string | null>(null);

  const handleMatch = useCallback(
    async (titleCp: string, value: string) => {
      setUpdatingTitle(titleCp);
      const movie = crMovies.find((m) => m.movie_id === value || m.id === value);
      if (movie) {
        await onMatchUpdate(titleCp, movie.movie_id || movie.id, movie.title);
      }
      setUpdatingTitle(null);
    },
    [crMovies, onMatchUpdate],
  );

  if (rows.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground text-xs">
        No data yet. Paste a CinePoint tweet above to start comparing.
      </div>
    );
  }

  const showShowtimes = rows.some((r) => r.cp_showtimes !== undefined);
  const showAdmissions = rows.some((r) => r.cp_admissions !== undefined);

  return (
    <div className="space-y-3">
      {/* Summary Bar */}
      <div className="flex flex-wrap items-center gap-3 text-[10px] font-bold uppercase tracking-tight">
        <Badge variant="outline" className="text-[9px] font-mono h-5">
          {summary.matched_movies}/{summary.total_cp_movies} matched
        </Badge>

        {showShowtimes && summary.total_cp_showtimes > 0 && (
          <>
            <span className="text-muted-foreground">
              Showtime Δ{' '}
              <span
                className={cn(
                  'font-mono',
                  summary.showtime_delta_pct > 0
                    ? 'text-emerald-600'
                    : summary.showtime_delta_pct < 0
                      ? 'text-red-500'
                      : '',
                )}
              >
                {summary.showtime_delta_pct > 0 ? '+' : ''}
                {summary.showtime_delta_pct}%
              </span>
            </span>
            <span className="text-muted-foreground">
              Avg dev{' '}
              <span className="font-mono">{summary.avg_showtime_deviation_pct}%</span>
            </span>
          </>
        )}

        {showAdmissions && summary.total_cp_admissions > 0 && (
          <>
            <span className="text-muted-foreground">
              Admission Δ{' '}
              <span
                className={cn(
                  'font-mono',
                  summary.admission_delta_pct > 0
                    ? 'text-emerald-600'
                    : summary.admission_delta_pct < 0
                      ? 'text-red-500'
                      : '',
                )}
              >
                {summary.admission_delta_pct > 0 ? '+' : ''}
                {summary.admission_delta_pct}%
              </span>
            </span>
            <span className="text-muted-foreground">
              Avg dev{' '}
              <span className="font-mono">{summary.avg_admission_deviation_pct}%</span>
            </span>
          </>
        )}
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-md border border-border/50">
        <table className="w-full text-[11px]">
          <thead>
            <tr className="border-b bg-muted/5">
              <th className="text-left py-2 px-3 font-black uppercase tracking-wider text-muted-foreground text-[9px]">
                Movie
              </th>
              {showShowtimes && (
                <>
                  <th className="text-right py-2 px-2 font-black uppercase tracking-wider text-muted-foreground text-[9px]">
                    CineRadar
                  </th>
                  <th className="text-right py-2 px-2 font-black uppercase tracking-wider text-muted-foreground text-[9px]">
                    CinePoint
                  </th>
                  <th className="text-right py-2 px-2 font-black uppercase tracking-wider text-muted-foreground text-[9px]">
                    Δ
                  </th>
                  <th className="text-right py-2 px-3 font-black uppercase tracking-wider text-muted-foreground text-[9px]">
                    Δ%
                  </th>
                </>
              )}
              {showAdmissions && (
                <>
                  <th className="text-right py-2 px-2 font-black uppercase tracking-wider text-muted-foreground text-[9px]">
                    CR Adm
                  </th>
                  <th className="text-right py-2 px-2 font-black uppercase tracking-wider text-muted-foreground text-[9px]">
                    CP Adm
                  </th>
                  <th className="text-right py-2 px-2 font-black uppercase tracking-wider text-muted-foreground text-[9px]">
                    Δ
                  </th>
                  <th className="text-right py-2 px-3 font-black uppercase tracking-wider text-muted-foreground text-[9px]">
                    Δ%
                  </th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.title_cp}
                className="border-b border-border/30 hover:bg-muted/5 transition-colors"
              >
                {/* Movie name / match */}
                <td className="py-2 px-3">
                  {row.matched_movie_id ? (
                    <div>
                      <span className="font-medium text-foreground">
                        {row.title_cr || row.title_cp}
                      </span>
                      <span className="text-muted-foreground/50 ml-1.5 text-[9px]">
                        {row.title_cp !== row.title_cr && row.title_cr
                          ? `(${row.title_cp})`
                          : ''}
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="text-amber-600 font-medium">{row.title_cp}</span>
                      <Select
                        onValueChange={(val) => handleMatch(row.title_cp, val)}
                        disabled={updatingTitle === row.title_cp}
                      >
                        <SelectTrigger className="h-5 w-32 text-[9px]">
                          <SelectValue placeholder="Match..." />
                        </SelectTrigger>
                        <SelectContent>
                          {crMovies
                            .filter((m) => m.title)
                            .sort((a, b) => a.title.localeCompare(b.title))
                            .map((m) => (
                              <SelectItem
                                key={m.movie_id || m.id}
                                value={m.movie_id || m.id}
                                className="text-[10px]"
                              >
                                {m.title}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </td>

                {/* Showtime columns */}
                {showShowtimes && (
                  <>
                    <td className="text-right py-2 px-2 font-mono">
                      {row.cr_showtimes !== undefined ? row.cr_showtimes.toLocaleString() : '—'}
                    </td>
                    <td className="text-right py-2 px-2 font-mono text-muted-foreground">
                      {row.cp_showtimes !== undefined ? row.cp_showtimes.toLocaleString() : '—'}
                    </td>
                    <td
                      className={cn(
                        'text-right py-2 px-2 font-mono font-bold',
                        row.showtime_delta !== undefined && row.showtime_delta > 0
                          ? 'text-emerald-600'
                          : row.showtime_delta !== undefined && row.showtime_delta < 0
                            ? 'text-red-500'
                            : '',
                      )}
                    >
                      {row.showtime_delta !== undefined
                        ? `${row.showtime_delta > 0 ? '+' : ''}${row.showtime_delta.toLocaleString()}`
                        : '—'}
                    </td>
                    <td
                      className={cn(
                        'text-right py-2 px-3 font-mono font-bold',
                        row.showtime_delta_pct !== undefined && row.showtime_delta_pct > 0
                          ? 'text-emerald-600'
                          : row.showtime_delta_pct !== undefined && row.showtime_delta_pct < 0
                            ? 'text-red-500'
                            : '',
                      )}
                    >
                      {row.showtime_delta_pct !== undefined
                        ? `${row.showtime_delta_pct > 0 ? '+' : ''}${row.showtime_delta_pct}%`
                        : '—'}
                    </td>
                  </>
                )}

                {/* Admission columns */}
                {showAdmissions && (
                  <>
                    <td className="text-right py-2 px-2 font-mono">
                      {row.cr_admissions !== undefined ? row.cr_admissions.toLocaleString() : '—'}
                    </td>
                    <td className="text-right py-2 px-2 font-mono text-muted-foreground">
                      {row.cp_admissions !== undefined ? row.cp_admissions.toLocaleString() : '—'}
                    </td>
                    <td
                      className={cn(
                        'text-right py-2 px-2 font-mono font-bold',
                        row.admission_delta !== undefined && row.admission_delta > 0
                          ? 'text-emerald-600'
                          : row.admission_delta !== undefined && row.admission_delta < 0
                            ? 'text-red-500'
                            : '',
                      )}
                    >
                      {row.admission_delta !== undefined
                        ? `${row.admission_delta > 0 ? '+' : ''}${row.admission_delta.toLocaleString()}`
                        : '—'}
                    </td>
                    <td
                      className={cn(
                        'text-right py-2 px-3 font-mono font-bold',
                        row.admission_delta_pct !== undefined && row.admission_delta_pct > 0
                          ? 'text-emerald-600'
                          : row.admission_delta_pct !== undefined && row.admission_delta_pct < 0
                            ? 'text-red-500'
                            : '',
                      )}
                    >
                      {row.admission_delta_pct !== undefined
                        ? `${row.admission_delta_pct > 0 ? '+' : ''}${row.admission_delta_pct}%`
                        : '—'}
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>

          {/* Totals footer */}
          {(summary.total_cp_showtimes > 0 || summary.total_cp_admissions > 0) && (
            <tfoot>
              <tr className="border-t-2 border-border/50 bg-muted/5 font-bold">
                <td className="py-2 px-3 uppercase text-[9px] tracking-wider text-muted-foreground">
                  Total
                </td>
                {showShowtimes && (
                  <>
                    <td className="text-right py-2 px-2 font-mono">
                      {summary.total_cr_showtimes.toLocaleString()}
                    </td>
                    <td className="text-right py-2 px-2 font-mono text-muted-foreground">
                      {summary.total_cp_showtimes.toLocaleString()}
                    </td>
                    <td
                      className={cn(
                        'text-right py-2 px-2 font-mono',
                        summary.showtime_delta > 0
                          ? 'text-emerald-600'
                          : summary.showtime_delta < 0
                            ? 'text-red-500'
                            : '',
                      )}
                    >
                      {summary.showtime_delta > 0 ? '+' : ''}
                      {summary.showtime_delta.toLocaleString()}
                    </td>
                    <td
                      className={cn(
                        'text-right py-2 px-3 font-mono',
                        summary.showtime_delta_pct > 0
                          ? 'text-emerald-600'
                          : summary.showtime_delta_pct < 0
                            ? 'text-red-500'
                            : '',
                      )}
                    >
                      {summary.showtime_delta_pct > 0 ? '+' : ''}
                      {summary.showtime_delta_pct}%
                    </td>
                  </>
                )}
                {showAdmissions && (
                  <>
                    <td className="text-right py-2 px-2 font-mono">
                      {summary.total_cr_admissions.toLocaleString()}
                    </td>
                    <td className="text-right py-2 px-2 font-mono text-muted-foreground">
                      {summary.total_cp_admissions.toLocaleString()}
                    </td>
                    <td
                      className={cn(
                        'text-right py-2 px-2 font-mono',
                        summary.admission_delta > 0
                          ? 'text-emerald-600'
                          : summary.admission_delta < 0
                            ? 'text-red-500'
                            : '',
                      )}
                    >
                      {summary.admission_delta > 0 ? '+' : ''}
                      {summary.admission_delta.toLocaleString()}
                    </td>
                    <td
                      className={cn(
                        'text-right py-2 px-3 font-mono',
                        summary.admission_delta_pct > 0
                          ? 'text-emerald-600'
                          : summary.admission_delta_pct < 0
                            ? 'text-red-500'
                            : '',
                      )}
                    >
                      {summary.admission_delta_pct > 0 ? '+' : ''}
                      {summary.admission_delta_pct}%
                    </td>
                  </>
                )}
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
