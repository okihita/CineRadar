'use client';

import { Loader2, Crown, Flame } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PageError } from '@/components/cinepoint/PageShell';
import { TypeBadge } from '@/components/cinepoint/SharedUi';
import type { YearSummary } from '@/lib/cinepoint';
import { formatAdm } from '@/lib/cinepoint';

interface HallOfFameTabProps {
  yearsLoading: boolean;
  yearsError: string | null;
  yearsData: { success: boolean; years: YearSummary[]; total_years: number } | null;
  loadYears: () => void;
}

export function HallOfFameTab({ yearsLoading, yearsError, yearsData, loadYears }: HallOfFameTabProps) {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="h-4 w-1 bg-primary rounded-full" />
        <h2 className="text-sm font-black uppercase tracking-[0.2em] text-foreground/80">Best Movies by Year</h2>
        <span className="text-sm font-mono text-muted-foreground/40">{yearsData ? `${yearsData.total_years} years with data` : ''}</span>
      </div>

      {yearsLoading && (
        <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
      )}

      {!yearsLoading && yearsError && <PageError error={yearsError} />}

      {!yearsLoading && !yearsError && yearsData && yearsData.years.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 gap-4 border-2 border-dashed rounded-xl bg-muted/5">
          <Flame className="w-12 h-12 text-muted-foreground/20" />
          <p className="text-muted-foreground font-medium">No yearly data yet</p>
        </div>
      )}

      {!yearsLoading && !yearsError && yearsData && yearsData.years.length > 0 && (
        <>
          {/* Year cards */}
          <YearCards years={yearsData.years} />
          {/* Yearly totals table */}
          <YearlyTable years={yearsData.years} />
        </>
      )}
    </div>
  );
}

function YearCards({ years }: { years: YearSummary[] }) {
  const reversed = [...years].reverse();
  const groupMap = new Map<number, YearSummary[]>();
  for (const y of reversed) {
    const mod10 = y.year % 10;
    const decade = Math.floor(y.year / 10) * 10;
    const groupStart = mod10 === 0
      ? decade - 4
      : mod10 >= 1 && mod10 <= 5 ? decade + 1 : decade + 6;
    if (!groupMap.has(groupStart)) groupMap.set(groupStart, []);
    groupMap.get(groupStart)!.push(y);
  }
  const groups = [...groupMap.entries()]
    .sort(([a], [b]) => b - a)
    .map(([start, yrs]) => ({ start, end: start + 4, label: `${start}–${start + 4}`, years: yrs }));

  return (
    <div className="space-y-6">
      {groups.map((group) => (
        <div key={group.start}>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-sm font-black uppercase tracking-widest text-muted-foreground/40">{group.label}</span>
            <div className="flex-1 h-px bg-border/40" />
          </div>
          <div className="grid grid-cols-5 gap-4">
            {group.years.map((y) => {
              const isChampionLocal = y.top_movie?.type === 'local';
              return (
                <Card key={y.year} className="relative overflow-hidden">
                  <div className={cn('absolute top-0 left-0 right-0 h-1', isChampionLocal ? 'bg-indigo-500' : 'bg-amber-500')} />
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-2xl font-black tracking-tight">{y.year}</CardTitle>
                      <Badge variant="outline" className="text-sm">{y.dates_with_data}d</Badge>
                    </div>
                    <div className="flex gap-3 text-sm text-muted-foreground/60">
                      <span>{formatAdm(y.total_admissions)}</span>
                      <span>{y.unique_movies} movies</span>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {y.top_movie && (
                      <div className="flex items-start gap-2">
                        <Crown className={cn('w-4 h-4 mt-0.5 shrink-0', isChampionLocal ? 'text-indigo-500' : 'text-amber-500')} />
                        <div className="min-w-0">
                          <p className="text-sm font-bold truncate">{y.top_movie.title}</p>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <span className="font-mono">{y.top_movie.total_admissions.toLocaleString()}</span>
                            <TypeBadge type={y.top_movie.type} short />
                          </div>
                          {y.top_movie.movie_genre.length > 0 && <p className="text-sm text-muted-foreground/40 truncate">{y.top_movie.movie_genre.join(', ')}</p>}
                        </div>
                      </div>
                    )}
                    <div className="space-y-1">
                      <div className="flex h-1.5 rounded-full overflow-hidden bg-muted">
                        <div className="bg-indigo-500 rounded-l-full" style={{ width: `${(y.local_admissions / (y.total_admissions || 1)) * 100}%` }} />
                        <div className="bg-amber-500 rounded-r-full" style={{ width: `${(y.international_admissions / (y.total_admissions || 1)) * 100}%` }} />
                      </div>
                      <div className="flex justify-between text-sm text-muted-foreground/50 font-mono">
                        <span>{((y.local_admissions / (y.total_admissions || 1)) * 100).toFixed(0)}%</span>
                        <span>{((y.international_admissions / (y.total_admissions || 1)) * 100).toFixed(0)}%</span>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 pt-1 border-t">
                      {y.top_local && (
                        <div className="min-w-0">
                          <p className="text-sm font-black uppercase tracking-widest text-indigo-500/60">Local</p>
                          <p className="text-sm font-medium truncate">{y.top_local.title}</p>
                          <p className="text-sm text-muted-foreground font-mono">{formatAdm(y.top_local.total_admissions)}</p>
                        </div>
                      )}
                      {y.top_international && (
                        <div className="min-w-0">
                          <p className="text-sm font-black uppercase tracking-widest text-amber-500/60">Intl</p>
                          <p className="text-sm font-medium truncate">{y.top_international.title}</p>
                          <p className="text-sm text-muted-foreground font-mono">{formatAdm(y.top_international.total_admissions)}</p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function YearlyTable({ years }: { years: YearSummary[] }) {
  return (
    <Card>
      <CardHeader className="pb-3 border-b">
        <CardTitle className="text-sm font-black uppercase tracking-[0.2em]">Yearly Overview</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-sm font-black uppercase tracking-widest text-muted-foreground/60">
                <th className="p-4 text-left">Year</th>
                <th className="p-4 text-left">Champion</th>
                <th className="p-4 text-right">Total Admissions</th>
                <th className="p-4 text-right">Local</th>
                <th className="p-4 text-right">International</th>
                <th className="p-4 text-right">Movies</th>
                <th className="p-4 text-right">Days</th>
              </tr>
            </thead>
            <tbody>
              {[...years].reverse().map((y) => (
                <tr key={y.year} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                  <td className="p-4 font-black">{y.year}</td>
                  <td className="p-4">
                    <p className="font-medium">{y.top_movie?.title ?? '-'}</p>
                    {y.top_movie && (
                      <TypeBadge type={y.top_movie.type} short />
                    )}
                  </td>
                  <td className="p-4 text-right font-mono font-bold">{y.total_admissions.toLocaleString()}</td>
                  <td className="p-4 text-right font-mono text-indigo-600">{y.local_admissions.toLocaleString()}</td>
                  <td className="p-4 text-right font-mono text-amber-600">{y.international_admissions.toLocaleString()}</td>
                  <td className="p-4 text-right font-mono">{y.unique_movies}</td>
                  <td className="p-4 text-right font-mono text-muted-foreground">{y.dates_with_data}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
