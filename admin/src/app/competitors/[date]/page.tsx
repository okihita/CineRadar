'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { format, parseISO, addDays, subDays } from 'date-fns';
import { enUS } from 'date-fns/locale';
import Link from 'next/link';
import {
  Swords,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Info,
  Archive,
  AlertTriangle,
  CheckCircle2,
  Target,
  TrendingUp,
  ExternalLink,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { PasteArea } from '@/features/competitors/components/PasteArea';
import { ComparisonTable } from '@/features/competitors/components/ComparisonTable';
import { TweetUrlImport } from '@/features/competitors/components/TweetUrlImport';
import type {
  CompetitorSnapshot,
  ComparisonRow,
  ComparisonSummary,
  CineRadarMovie,
  CumulativeMovieTrack,
} from '@/features/competitors/types';
import { computeConfidenceScore } from '@/features/competitors/comparison';
import { buildCinepointVerifyUrl } from '@/features/competitors/lib/verify-link';
import { Badge } from '@/components/ui/badge';

interface PageData {
  snapshot: CompetitorSnapshot | null;
  comparison: { rows: ComparisonRow[]; summary: ComparisonSummary } | null;
  cr_movies: CineRadarMovie[];
  cinema_count: number;
}

export default function CompetitorDatePage() {
  const { date } = useParams<{ date: string }>();
  const router = useRouter();
  const [data, setData] = useState<PageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [cumulative, setCumulative] = useState<CumulativeMovieTrack[]>([]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/competitors/${date}`);
      if (res.ok) {
        const json = await res.json();
        setData(json.data);
      }
    } catch (err) {
      console.error('[Competitor fetch error]', err);
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => {
    fetchData();
    // Fetch cumulative box office data (one-time, cached by browser)
    fetch('/api/competitors/cumulative')
      .then((r) => r.json())
      .then((json) => {
        if (json.success) setCumulative(json.data || []);
      })
      .catch(() => {});
  }, [fetchData]);

  const navigateDate = useCallback(
    (offset: number) => {
      const current = parseISO(date);
      const next = offset > 0 ? addDays(current, offset) : subDays(current, Math.abs(offset));
      router.push(`/competitors/${format(next, 'yyyy-MM-dd')}`);
    },
    [date, router],
  );

  const handleSaveShowtimes = useCallback(
    async (raw: string) => {
      const res = await fetch(`/api/competitors/${date}/showtimes`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ raw }),
      });
      const json = await res.json();
      if (json.success) {
        // Re-fetch to get updated comparison
        await fetchData();
      }
      return { success: json.success, parsed_count: json.data?.parsed_count };
    },
    [date, fetchData],
  );

  const handleSaveAdmissions = useCallback(
    async (raw: string) => {
      const res = await fetch(`/api/competitors/${date}/admissions`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ raw }),
      });
      const json = await res.json();
      if (json.success) {
        await fetchData();
      }
      return { success: json.success, parsed_count: json.data?.parsed_count };
    },
    [date, fetchData],
  );

  const handleMatchUpdate = useCallback(
    async (titleCp: string, movieId: string, movieTitle: string) => {
      // Determine which type to update based on which has data
      const hasShowtimes = (data?.snapshot?.showtimes?.parsed?.length || 0) > 0;
      const hasAdmissions = (data?.snapshot?.admissions?.parsed?.length || 0) > 0;

      const updates = [{ title_cp: titleCp, matched_movie_id: movieId, matched_title: movieTitle }];

      if (hasShowtimes) {
        await fetch(`/api/competitors/${date}/match`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'showtimes', updates }),
        });
      }

      if (hasAdmissions) {
        await fetch(`/api/competitors/${date}/match`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'admissions', updates }),
        });
      }

      await fetchData();
    },
    [date, data, fetchData],
  );

  // Parse date for display
  let displayDate = date;
  try {
    displayDate = format(parseISO(date), 'EEE, d MMM yyyy', { locale: enUS });
  } catch {
    /* keep raw */
  }

  // Compute confidence from comparison
  const confidence = data?.comparison?.summary
    ? computeConfidenceScore(data.comparison.summary)
    : null;

  // Filter cumulative to movies relevant to this date
  const dateCumulative = cumulative.filter((m) =>
    m.data_points.some((p) => p.date === date),
  ).sort((a, b) => b.latest_cumulative - a.latest_cumulative);

  // Coverage state for this date
  const hasShowtimes = (data?.snapshot?.showtimes?.parsed?.length ?? 0) > 0;
  const hasAdmissions = (data?.snapshot?.admissions?.parsed?.length ?? 0) > 0;
  const isPartial = (hasShowtimes && !hasAdmissions) || (!hasShowtimes && hasAdmissions);
  const isMissing = !hasShowtimes && !hasAdmissions;

  function confidenceColor(level: string): string {
    switch (level) {
      case 'excellent': return 'text-emerald-600 bg-emerald-500/10 border-emerald-500/20';
      case 'good': return 'text-blue-600 bg-blue-500/10 border-blue-500/20';
      case 'warning': return 'text-amber-600 bg-amber-500/10 border-amber-500/20';
      case 'critical': return 'text-red-600 bg-red-500/10 border-red-500/20';
      default: return 'text-muted-foreground bg-muted/50 border-border/30';
    }
  }

  function confidenceIcon(level: string) {
    switch (level) {
      case 'excellent': return <CheckCircle2 className="w-3 h-3" />;
      case 'good': return <Target className="w-3 h-3" />;
      case 'warning': return <AlertTriangle className="w-3 h-3" />;
      case 'critical': return <AlertTriangle className="w-3 h-3" />;
      default: return null;
    }
  }

  return (
    <div className="px-6 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/competitors"
            className="w-9 h-9 rounded-xl border border-border/40 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </Link>
          <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/20">
            <Swords className="w-5 h-5 text-primary" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-black uppercase tracking-tighter">CinePoint Benchmark</h1>
              {confidence && (
                <Badge variant="outline" className={cn('text-[9px] h-5 px-2 gap-1 border font-bold uppercase tracking-wider', confidenceColor(confidence.level))}>
                  {confidenceIcon(confidence.level)}
                  {confidence.score}/100
                </Badge>
              )}
            </div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold opacity-60">
              {displayDate}
            </p>
          </div>
        </div>

        {/* Date Navigation */}
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigateDate(-1)}
            className="h-8 w-8 p-0 rounded-xl"
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigateDate(1)}
            className="h-8 w-8 p-0 rounded-xl"
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Jakarta' });
              router.push(`/competitors/${today}`);
            }}
            className="h-8 gap-2 px-4 text-[10px] font-black uppercase tracking-wider rounded-xl border-border/60 hover:bg-muted transition-all"
          >
            Today
          </Button>
          <Link href="/competitors/archive">
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-2 px-4 text-[10px] font-black uppercase tracking-wider rounded-xl border-border/60 hover:bg-muted transition-all"
            >
              <Archive className="w-3.5 h-3.5" />
              Archive
            </Button>
          </Link>
        </div>
      </div>

      {/* Coverage Context */}
      <div className="flex items-start gap-3 px-4 py-3 rounded-lg border border-border/50 bg-muted/5 text-muted-foreground">
        <Info className="w-4 h-4 mt-0.5 flex-shrink-0 text-muted-foreground/50" />
        <p className="text-[11px] leading-relaxed">
          CineRadar currently tracks{' '}
          <span className="font-bold text-foreground font-mono">
            {data?.cinema_count ?? '—'}
          </span>{' '}
          cinemas out of an estimated{' '}
          <span className="font-bold text-foreground font-mono">600+</span>{' '}
          screens nationwide. CinePoint likely covers the full market. A negative delta here is expected — CineRadar&apos;s
          numbers will naturally be lower due to partial coverage. The meaningful metric is the{' '}
          <span className="font-semibold text-foreground">coverage ratio</span> (delta %): how consistent our slice
          of the market is relative to the whole. A stable ratio means our data is reliable for extrapolation.
        </p>
      </div>

      {/* Main Content */}
      {loading && !data ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {/* Left: URL Import + Paste Areas */}
          <div className="space-y-4">
            {/* Quick Import from Tweet URL */}
            <Card className="overflow-hidden border-border/50">
              <CardContent className="p-4">
                <TweetUrlImport onImported={fetchData} />
              </CardContent>
            </Card>

            {/* Check CinePoint — shown when data is partial or missing */}
            {(isPartial || isMissing) && (
              <a
                href={buildCinepointVerifyUrl(date)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg border border-border/20 bg-muted/3 hover:bg-muted/8 transition-colors group"
              >
                <span className="text-[10px] text-muted-foreground/50 leading-relaxed">
                  {isMissing
                    ? 'CinePoint may not have posted this date — '
                    : `Missing ${hasShowtimes ? 'admissions' : 'showtimes'} — `}
                  <span className="text-muted-foreground/40 group-hover:text-muted-foreground/70 transition-colors">
                    check their timeline →
                  </span>
                </span>
                <ExternalLink className="w-3 h-3 text-muted-foreground/20 group-hover:text-muted-foreground/50 transition-colors flex-shrink-0" />
              </a>
            )}

            {/* Manual Paste Areas */}
            <Card className="overflow-hidden border-border/50">
              <CardContent className="p-4 space-y-6">
              <PasteArea
                label="Showtime Count"
                placeholder={`Paste CinePoint showtime tweet here...\n\nExample:\n#Salmokji 2,466 (-3.90%)\n#GhostinTheCell 2,444 (+1.20%)`}
                existingRaw={data?.snapshot?.showtimes?.raw}
                parsedCount={data?.snapshot?.showtimes?.parsed?.length}
                onSave={handleSaveShowtimes}
              />

              <div className="border-t border-border/30" />

              <PasteArea
                label="Estimated Admissions"
                placeholder={`Paste CinePoint admissions tweet here...\n\nExample:\n#Salmokji\n+74,385 (-3.90%) | 389,072`}
                existingRaw={data?.snapshot?.admissions?.raw}
                parsedCount={data?.snapshot?.admissions?.parsed?.length}
                onSave={handleSaveAdmissions}
              />
            </CardContent>
          </Card>
          </div>

          {/* Right: Comparison Table */}
          <Card className="overflow-hidden border-border/50">
            <CardContent className="p-4">
              <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-3">
                Comparison — CineRadar vs CinePoint
              </h3>
              {data?.comparison ? (
                <ComparisonTable
                  rows={data.comparison.rows}
                  summary={data.comparison.summary}
                  crMovies={data.cr_movies}
                  date={date}
                  type="showtimes"
                  onMatchUpdate={handleMatchUpdate}
                />
              ) : (
                <div className="text-center py-12 text-muted-foreground text-xs">
                  No comparison data yet.
                  <br />
                  <span className="text-muted-foreground/50">
                    Paste a CinePoint tweet to get started.
                  </span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Recent Days Quick Nav */}
      <Card className="overflow-hidden border-border/50">
        <CardContent className="p-3">
          <RecentDaysNav currentDate={date} />
        </CardContent>
      </Card>

      {/* Cumulative Box Office for this date */}
      {dateCumulative.length > 0 && (
        <Card className="overflow-hidden border-border/50">
          <CardContent className="p-4">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-3 flex items-center gap-2">
              <TrendingUp className="w-3.5 h-3.5" />
              CinePoint Box Office — {date}
            </h3>
            <div className="overflow-x-auto rounded-xl border border-border/40">
              <table className="w-full text-[11px]">
                <thead>
                  <tr className="border-b border-border/40 bg-muted/5">
                    <th className="text-left py-2.5 px-3 font-black uppercase tracking-[0.15em] text-muted-foreground text-[9px]">
                      Movie
                    </th>
                    <th className="text-right py-2.5 px-3 font-black uppercase tracking-[0.15em] text-muted-foreground text-[9px]">
                      Daily Admissions
                    </th>
                    <th className="text-right py-2.5 px-3 font-black uppercase tracking-[0.15em] text-muted-foreground text-[9px]">
                      Change
                    </th>
                    <th className="text-right py-2.5 px-3 font-black uppercase tracking-[0.15em] text-muted-foreground text-[9px]">
                      Cumulative
                    </th>
                    <th className="text-right py-2.5 px-3 font-black uppercase tracking-[0.15em] text-muted-foreground text-[9px]">
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
                        <td className="py-2.5 px-3 font-bold text-[12px]">
                          {movie.title_cr || movie.title_cp}
                        </td>
                        <td className="text-right py-2.5 px-3 font-mono">
                          {pt.daily_admissions.toLocaleString()}
                        </td>
                        <td className="text-right py-2.5 px-3">
                          <span className={cn(
                            'font-mono font-bold text-[11px]',
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
      )}
    </div>
  );
}

// ─── Recent Days Mini-Navigation ───────────────────────────

function RecentDaysNav({ currentDate }: { currentDate: string }) {
  const [days, setDays] = useState<
    { date: string; status: string; showtime_count: number; admission_count: number }[]
  >([]);

  useEffect(() => {
    fetch('/api/competitors')
      .then((r) => r.json())
      .then((json) => {
        if (json.success) setDays(json.data);
      })
      .catch(() => {});
  }, []);

  // Generate last 7 days
  const last7 = Array.from({ length: 7 }, (_, i) => {
    const d = subDays(new Date(), 6 - i);
    return format(d, 'yyyy-MM-dd');
  });

  const dataMap = new Map(days.map((d) => [d.date, d]));

  return (
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
  );
}
