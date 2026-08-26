'use client';

import { useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import type { ComparisonRow, ComparisonSummary } from '../types';
import type { CineRadarMovie } from '../types';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Link2, AlertCircle } from 'lucide-react';

interface ComparisonTableProps {
  rows: ComparisonRow[];
  summary: ComparisonSummary;
  crMovies: CineRadarMovie[];
  date: string;
  type?: 'showtimes' | 'admissions';
  onMatchUpdate: (titleCp: string, movieId: string, movieTitle: string) => void;
}

// Helper for coverage bar
function CoverageBar({ cr, cp }: { cr?: number; cp?: number }) {
  if (cr === undefined || cp === undefined || cp === 0) return null;
  const ratio = Math.min(100, Math.max(0, (cr / cp) * 100));
  return (
    <div className="flex items-center gap-2 mt-1">
      <div className="flex-1 h-1.5 bg-muted/30 rounded-full overflow-hidden">
        <div 
          className={cn("h-full rounded-full transition-all", ratio > 80 ? "bg-emerald-500" : ratio > 50 ? "bg-amber-500" : "bg-red-500")} 
          style={{ width: `${ratio}%` }} 
        />
      </div>
      <span className="text-sm font-bold text-muted-foreground w-8 text-right">{ratio.toFixed(0)}%</span>
    </div>
  );
}

export function ComparisonTable({
  rows,
  summary,
  crMovies,
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
      <div className="text-center py-12 text-muted-foreground text-sm flex flex-col items-center gap-3 border-2 border-dashed rounded-2xl border-border/40 bg-muted/5">
        <AlertCircle className="w-6 h-6 opacity-40" />
        <p>No data yet. Paste a CinePoint tweet above to start comparing.</p>
      </div>
    );
  }

  const showShowtimes = rows.some((r) => r.cp_showtimes !== undefined);
  const showAdmissions = rows.some((r) => r.cp_admissions !== undefined);

  const defaultTab = showAdmissions ? "admissions" : "showtimes";

  return (
    <div className="space-y-4">
      {/* Summary Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-sm font-bold uppercase tracking-tight bg-muted/5 p-3 rounded-xl border border-border/40">
        <div className="flex items-center gap-4">
          <Badge variant="outline" className={cn("text-sm font-mono h-6 px-3 border-primary/20", summary.matched_movies === summary.total_cp_movies ? "bg-emerald-500/10 text-emerald-600" : "bg-amber-500/10 text-amber-600")}>
            {summary.matched_movies}/{summary.total_cp_movies} matched
          </Badge>
          <span className="text-muted-foreground/60 hidden sm:inline">Coverage Health:</span>
        </div>

        <div className="flex items-center gap-6">
          {showShowtimes && summary.total_cp_showtimes > 0 && (
            <div className="flex items-center gap-3">
              <span className="text-muted-foreground">Showtimes:</span>
              <span className="font-mono text-sm">{summary.total_cr_showtimes.toLocaleString()} <span className="text-muted-foreground/40">/ {summary.total_cp_showtimes.toLocaleString()}</span></span>
            </div>
          )}

          {showAdmissions && summary.total_cp_admissions > 0 && (
            <div className="flex items-center gap-3">
              <span className="text-muted-foreground">Admissions:</span>
              <span className="font-mono text-sm">{summary.total_cr_admissions.toLocaleString()} <span className="text-muted-foreground/40">/ {summary.total_cp_admissions.toLocaleString()}</span></span>
            </div>
          )}
        </div>
      </div>

      <Tabs defaultValue={defaultTab} className="w-full">
        <div className="flex items-center justify-between mb-4">
          <TabsList className="bg-muted/10 border border-border/40">
            {showShowtimes && <TabsTrigger value="showtimes" className="text-sm uppercase font-bold tracking-widest">Showtimes</TabsTrigger>}
            {showAdmissions && <TabsTrigger value="admissions" className="text-sm uppercase font-bold tracking-widest">Admissions</TabsTrigger>}
          </TabsList>
          <span className="text-sm font-black uppercase tracking-[0.2em] text-primary/60">Forensic View</span>
        </div>

        {['showtimes', 'admissions'].map((tabType) => {
          const isShow = tabType === 'showtimes';
          if (isShow && !showShowtimes) return null;
          if (!isShow && !showAdmissions) return null;

          return (
            <TabsContent key={tabType} value={tabType} className="mt-0 outline-none">
              <div className="overflow-x-auto rounded-2xl border border-border/40 shadow-sm bg-card">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border/40 bg-muted/5">
                      <th className="text-left py-3 px-4 font-black uppercase tracking-[0.15em] text-muted-foreground text-sm w-[35%]">
                        Target Movie
                      </th>
                      <th className="text-right py-3 px-4 font-black uppercase tracking-[0.15em] text-muted-foreground text-sm w-[25%]">
                        CineRadar (Local)
                      </th>
                      <th className="text-right py-3 px-4 font-black uppercase tracking-[0.15em] text-muted-foreground text-sm w-[20%]">
                        CinePoint (Truth)
                      </th>
                      <th className="text-right py-3 px-4 font-black uppercase tracking-[0.15em] text-muted-foreground text-sm w-[20%]">
                        Delta Drift
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/20">
                    {rows.map((row) => {
                      const crValue = isShow ? row.cr_showtimes : row.cr_admissions;
                      const cpValue = isShow ? row.cp_showtimes : row.cp_admissions;
                      const deltaValue = isShow ? row.showtime_delta : row.admission_delta;
                      const deltaPct = isShow ? row.showtime_delta_pct : row.admission_delta_pct;
                      
                      // Skip if this row doesn't have data for this tab
                      if (cpValue === undefined && crValue === undefined) return null;

                      return (
                        <tr key={row.title_cp} className="hover:bg-muted/5 transition-colors group">
                          {/* Movie Name / Mapper */}
                          <td className="py-3 px-4">
                            {row.matched_movie_id ? (
                              <div className="flex flex-col">
                                <span className="font-bold text-sm text-foreground tracking-tight">
                                  {row.title_cr || row.title_cp}
                                </span>
                                {row.title_cp !== row.title_cr && row.title_cr && (
                                  <span className="text-muted-foreground/50 text-sm uppercase tracking-wider font-medium flex items-center gap-1 mt-0.5">
                                    <Link2 className="w-2.5 h-2.5" /> Mapped to: {row.title_cp}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <div className="flex flex-col gap-1.5">
                                <span className="text-amber-600 font-bold text-sm tracking-tight flex items-center gap-1.5">
                                  <AlertCircle className="w-3.5 h-3.5" /> {row.title_cp}
                                </span>
                                <Select
                                  onValueChange={(val) => handleMatch(row.title_cp, val)}
                                  disabled={updatingTitle === row.title_cp}
                                >
                                  <SelectTrigger className="h-6 w-[180px] text-sm bg-amber-500/5 border-amber-500/20 text-amber-700 dark:text-amber-400 font-bold uppercase tracking-wider">
                                    <SelectValue placeholder="Link Database Movie..." />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {crMovies
                                      .filter((m) => m.title)
                                      .sort((a, b) => a.title.localeCompare(b.title))
                                      .map((m) => (
                                        <SelectItem key={m.movie_id || m.id} value={m.movie_id || m.id} className="text-sm font-medium">
                                          {m.title}
                                        </SelectItem>
                                      ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            )}
                          </td>

                          {/* CineRadar Column (with Progress Bar) */}
                          <td className="text-right py-3 px-4">
                            <div className="font-mono text-sm font-medium">
                              {crValue !== undefined ? crValue.toLocaleString() : '—'}
                            </div>
                            {row.matched_movie_id && <CoverageBar cr={crValue} cp={cpValue} />}
                          </td>

                          {/* CinePoint Column */}
                          <td className="text-right py-3 px-4 font-mono text-sm text-muted-foreground font-medium">
                            {cpValue !== undefined ? cpValue.toLocaleString() : '—'}
                          </td>

                          {/* Delta Column */}
                          <td className="text-right py-3 px-4">
                            <div className={cn(
                              'font-mono text-sm font-black',
                              deltaValue !== undefined && deltaValue > 0 ? 'text-emerald-600' : 
                              deltaValue !== undefined && deltaValue < 0 ? 'text-red-500' : 'text-muted-foreground'
                            )}>
                              {deltaValue !== undefined ? `${deltaValue > 0 ? '+' : ''}${deltaValue.toLocaleString()}` : '—'}
                            </div>
                            <div className={cn(
                              'text-sm font-bold mt-0.5',
                              deltaPct !== undefined && deltaPct > 0 ? 'text-emerald-600/70' : 
                              deltaPct !== undefined && deltaPct < 0 ? 'text-red-500/70' : 'text-muted-foreground/50'
                            )}>
                              {deltaPct !== undefined ? `${deltaPct > 0 ? '+' : ''}${deltaPct}% drift` : '—'}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </TabsContent>
          );
        })}
      </Tabs>
    </div>
  );
}
