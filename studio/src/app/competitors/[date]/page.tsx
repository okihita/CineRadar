'use client';

import { useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { format, parseISO, addDays, subDays } from 'date-fns';
import { Info, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';
import { ComparisonTable } from '@/features/competitors/components/ComparisonTable';
import { computeConfidenceScore } from '@/features/competitors/comparison';
import { PageError } from '@/components/cinepoint/PageShell';

import { useDatePageData } from './_components/useDatePageData';
import { DateDetailHeader } from './_components/DateDetailHeader';
import { DataEntryPanel } from './_components/DataEntryPanel';
import { DateCumulativeTable } from './_components/DateCumulativeTable';
import { DateRecentDaysNav } from './_components/DateRecentDaysNav';

export default function CompetitorDatePage() {
  const { date } = useParams<{ date: string }>();
  const router = useRouter();
  const { data, cumulative, loading, error, fetchData } = useDatePageData(date);

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
      if (json.success) await fetchData();
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
      if (json.success) await fetchData();
      return { success: json.success, parsed_count: json.data?.parsed_count };
    },
    [date, fetchData],
  );

  const handleMatchUpdate = useCallback(
    async (titleCp: string, movieId: string, movieTitle: string) => {
      const hasShowtimes = (data?.snapshot?.showtimes?.parsed?.length || 0) > 0;
      const hasAdmissions = (data?.snapshot?.admissions?.parsed?.length || 0) > 0;
      const updates = [{ title_cp: titleCp, matched_movie_id: movieId, matched_title: movieTitle }];

      try {
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
        toast.success('Match updated', { description: `${titleCp} → ${movieTitle}` });
      } catch {
        toast.error('Failed to update match');
      }
    },
    [date, data, fetchData],
  );

  // Compute confidence from comparison
  const confidence = data?.comparison?.summary
    ? computeConfidenceScore(data.comparison.summary)
    : null;

  // Filter cumulative to movies relevant to this date
  const dateCumulative = cumulative
    .filter((m) => m.data_points.some((p) => p.date === date))
    .sort((a, b) => b.latest_cumulative - a.latest_cumulative);

  return (
    <div className="px-6 py-8 space-y-6">
      {/* Header */}
      <DateDetailHeader date={date} confidence={confidence} onNavigateDate={navigateDate} />

      {/* Coverage Context */}
      <div className="flex items-start gap-3 px-4 py-3 rounded-lg border border-border/50 bg-muted/5 text-muted-foreground">
        <Info className="w-4 h-4 mt-0.5 flex-shrink-0 text-muted-foreground/50" />
        <p className="text-sm leading-relaxed">
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
      {error ? (
        <PageError error={error} backHref="/competitors" />
      ) : loading && !data ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {/* Left: Data Entry */}
          <DataEntryPanel
            date={date}
            data={data}
            fetchData={fetchData}
            onSaveShowtimes={handleSaveShowtimes}
            onSaveAdmissions={handleSaveAdmissions}
          />

          {/* Right: Comparison Table */}
          <Card className="overflow-hidden border-border/50">
            <CardContent className="p-4">
              <h3 className="text-sm font-black uppercase tracking-widest text-muted-foreground mb-3">
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
                <div className="text-center py-12 text-muted-foreground text-sm">
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
      <DateRecentDaysNav currentDate={date} />

      {/* Cumulative Box Office for this date */}
      <DateCumulativeTable date={date} dateCumulative={dateCumulative} />
    </div>
  );
}
