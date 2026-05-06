'use client';

import { useCallback, useEffect, useState, useMemo } from 'react';
import { format, parseISO, subDays } from 'date-fns';
import Link from 'next/link';
import {
  Swords,
  Loader2,
  TrendingUp,
  TrendingDown,
  Target,
  AlertTriangle,
  CheckCircle2,
  BarChart3,
  CalendarDays,
  Archive,
  ArrowRight,
  ExternalLink,
  Shield,
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ReferenceLine,
} from 'recharts';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import type {
  TrendDay,
  HeatmapCell,
  HeatmapCellStatus,
  CumulativeMovieTrack,
} from '@/features/competitors/types';

// ─── Color & Label Helpers ─────────────────────────────────

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
    case 'excellent': return <CheckCircle2 className="w-3.5 h-3.5" />;
    case 'good': return <Target className="w-3.5 h-3.5" />;
    case 'warning': return <AlertTriangle className="w-3.5 h-3.5" />;
    case 'critical': return <AlertTriangle className="w-3.5 h-3.5" />;
    default: return null;
  }
}

function deltaColor(value: number | null | undefined): string {
  if (value === null || value === undefined) return 'text-muted-foreground';
  if (value > 0) return 'text-emerald-600';
  if (value < 0) return 'text-red-500';
  return 'text-muted-foreground';
}

function formatDelta(value: number | null | undefined, suffix = '%'): string {
  if (value === null || value === undefined) return '—';
  return `${value > 0 ? '+' : ''}${value.toFixed(2)}${suffix}`;
}

function heatmapCellBg(status: HeatmapCellStatus): string {
  switch (status) {
    case 'matched_low': return 'bg-emerald-500/20 border-emerald-500/30';
    case 'matched_high': return 'bg-amber-500/20 border-amber-500/30';
    case 'unmatched': return 'bg-red-500/20 border-red-500/30';
    case 'no_data': return 'bg-muted/10 border-border/20';
  }
}

function heatmapCellLabel(status: HeatmapCellStatus, delta: number | null): string {
  switch (status) {
    case 'matched_low': return delta !== null ? `${delta > 0 ? '+' : ''}${delta.toFixed(1)}%` : '✓';
    case 'matched_high': return delta !== null ? `${delta > 0 ? '+' : ''}${delta.toFixed(1)}%` : '!';
    case 'unmatched': return '✗';
    case 'no_data': return '';
  }
}

// ─── Page Component ────────────────────────────────────────

export default function CompetitorsDashboard() {
  const [trendDays, setTrendDays] = useState<TrendDay[]>([]);
  const [cumulative, setCumulative] = useState<CumulativeMovieTrack[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchDashboard = useCallback(async () => {
    setLoading(true);
    try {
      const [trendRes, cumRes] = await Promise.all([
        fetch('/api/competitors/trend?days=30'),
        fetch('/api/competitors/cumulative'),
      ]);

      if (trendRes.ok) {
        const json = await trendRes.json();
        setTrendDays(json.data || []);
      }
      if (cumRes.ok) {
        const json = await cumRes.json();
        setCumulative(json.data || []);
      }
    } catch (err) {
      console.error('[Dashboard fetch error]', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  // Filter to only days with data for charts
  const daysWithData = useMemo(
    () => trendDays.filter((d) => d.status !== 'empty').sort((a, b) => a.date.localeCompare(b.date)),
    [trendDays],
  );

  // Build heatmap data: movie × date matrix
  const heatmapData = useMemo((): HeatmapCell[] => {
    // Collect all unique movies across all dates
    const movieTitles = new Set<string>();
    for (const day of daysWithData) {
      for (const m of day.movies) {
        movieTitles.add(m.title_cp);
      }
    }

    const datesWithData = daysWithData.map((d) => d.date);

    return [...movieTitles].map((title) => {
      const dates: HeatmapCell['dates'] = {};
      let totalUnmatched = 0;
      const deviations: number[] = [];

      for (const date of datesWithData) {
        const day = daysWithData.find((d) => d.date === date);
        const movieDay = day?.movies.find((m) => m.title_cp === title);

        if (!movieDay) {
          dates[date] = { status: 'no_data', delta_pct: null, matched: false };
        } else if (!movieDay.matched) {
          dates[date] = { status: 'unmatched', delta_pct: null, matched: false };
          totalUnmatched++;
        } else {
          const delta = movieDay.showtime_delta_pct ?? movieDay.admission_delta_pct;
          const absDelta = delta !== null ? Math.abs(delta) : 0;
          const isHigh = absDelta > 5;
          dates[date] = { status: isHigh ? 'matched_high' : 'matched_low', delta_pct: delta, matched: true };
          if (delta !== null) deviations.push(absDelta);
        }
      }

      return {
        title_cp: title,
        dates,
        total_unmatched: totalUnmatched,
        avg_deviation: deviations.length > 0
          ? parseFloat((deviations.reduce((a, b) => a + b, 0) / deviations.length).toFixed(2))
          : null,
      };
    }).sort((a, b) => a.total_unmatched - b.total_unmatched || (a.avg_deviation ?? 0) - (b.avg_deviation ?? 0));
  }, [daysWithData]);

  // Coverage trend chart data
  const coverageChartData = useMemo(
    () => daysWithData.map((d) => ({
      date: d.date.substring(5),
      fullDate: d.date,
      coverage_ratio: d.coverage_ratio !== null ? parseFloat((d.coverage_ratio * 100).toFixed(1)) : null,
      showtime_delta_pct: d.showtime_delta_pct,
      match_rate: d.match_rate !== null ? parseFloat((d.match_rate * 100).toFixed(1)) : null,
      confidence: d.confidence?.score ?? null,
    })),
    [daysWithData],
  );

  // Confidence trend chart data
  const confidenceChartData = useMemo(
    () => daysWithData.map((d) => ({
      date: d.date.substring(5),
      fullDate: d.date,
      score: d.confidence?.score ?? null,
      match_score: d.confidence?.breakdown.match_score ?? null,
      deviation_score: d.confidence?.breakdown.deviation_score ?? null,
      completeness_score: d.confidence?.breakdown.completeness_score ?? null,
    })),
    [daysWithData],
  );

  // Market estimate (use latest day with data)
  const latestDay = daysWithData.length > 0 ? daysWithData[daysWithData.length - 1] : null;
  const marketEstimate = useMemo(() => {
    if (!latestDay || !latestDay.coverage_ratio || latestDay.coverage_ratio === 0) return null;
    return {
      cr_admissions: latestDay.total_cr_admissions,
      estimated_total: Math.round(latestDay.total_cr_admissions / latestDay.coverage_ratio),
      coverage_pct: parseFloat((latestDay.coverage_ratio * 100).toFixed(1)),
    };
  }, [latestDay]);

  // 7-day summary
  const summary7d = useMemo(() => {
    const recent = daysWithData.slice(-7);
    if (recent.length === 0) return null;

    const avgCoverage = recent.filter((d) => d.coverage_ratio !== null);
    const avgConfidence = recent.filter((d) => d.confidence);
    const avgShowDelta = recent.filter((d) => d.showtime_delta_pct !== null);
    const avgAdmDelta = recent.filter((d) => d.admission_delta_pct !== null);

    return {
      avg_coverage: avgCoverage.length > 0
        ? (avgCoverage.reduce((s, d) => s + (d.coverage_ratio ?? 0), 0) / avgCoverage.length) * 100
        : null,
      avg_confidence: avgConfidence.length > 0
        ? avgConfidence.reduce((s, d) => s + (d.confidence?.score ?? 0), 0) / avgConfidence.length
        : null,
      avg_showtime_delta: avgShowDelta.length > 0
        ? avgShowDelta.reduce((s, d) => s + (d.showtime_delta_pct ?? 0), 0) / avgShowDelta.length
        : null,
      avg_admission_delta: avgAdmDelta.length > 0
        ? avgAdmDelta.reduce((s, d) => s + (d.admission_delta_pct ?? 0), 0) / avgAdmDelta.length
        : null,
      days_with_data: recent.length,
      days_complete: recent.filter((d) => d.status === 'complete').length,
    };
  }, [daysWithData]);

  const heatmapDates = useMemo(
    () => daysWithData.slice(-10).map((d) => d.date),
    [daysWithData],
  );

  const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Jakarta' });

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Swords className="w-4 h-4 text-primary" />
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-tight">Competitor Intelligence</h1>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">
              CinePoint Benchmark Dashboard
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link href={`/competitors/${today}`}>
            <Button variant="outline" size="sm" className="h-7 gap-1.5 px-3 text-[10px] font-bold uppercase">
              <CalendarDays className="w-3 h-3" />
              Today&apos;s Detail
            </Button>
          </Link>
          <Link href="/competitors/archive">
            <Button variant="outline" size="sm" className="h-7 gap-1.5 px-3 text-[10px] font-bold uppercase">
              <Archive className="w-3 h-3" />
              Tweet Archive
            </Button>
          </Link>
        </div>
      </div>

      {loading ? (
        <div className="space-y-6 animate-in fade-in duration-500">
          {/* Skeleton Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Card key={i} className="overflow-hidden border-border/50">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-3.5 h-3.5 rounded bg-muted/40 animate-pulse" />
                    <div className="h-2.5 w-24 rounded bg-muted/30 animate-pulse" />
                  </div>
                  <div className="h-7 w-20 rounded bg-muted/40 animate-pulse mb-2" />
                  <div className="h-2 w-16 rounded bg-muted/20 animate-pulse" />
                </CardContent>
              </Card>
            ))}
          </div>
          {/* Skeleton Chart */}
          <Card className="overflow-hidden border-border/50">
            <CardContent className="p-6">
              <div className="h-3 w-48 rounded bg-muted/30 animate-pulse mb-6" />
              <div className="h-[300px] rounded-xl bg-muted/10 animate-pulse" />
            </CardContent>
          </Card>
          {/* Skeleton Quick Nav */}
          <Card className="overflow-hidden border-border/50">
            <CardContent className="p-3">
              <div className="flex gap-1">
                {Array.from({ length: 14 }).map((_, i) => (
                  <div key={i} className="flex-1 h-10 rounded-md bg-muted/20 animate-pulse" />
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      ) : daysWithData.length === 0 ? (
        <Card className="overflow-hidden border-border/50">
          <CardContent className="py-12 px-8">
            <div className="max-w-lg mx-auto text-center space-y-6">
              <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
                <Swords className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h2 className="text-sm font-black uppercase tracking-tighter">Getting Started with Competitor Tracking</h2>
                <p className="text-[11px] text-muted-foreground mt-2 leading-relaxed">
                  CineRadar compares your cinema data against <span className="font-bold text-foreground">@cinepoint_</span> on X/Twitter.
                  Import their tweets to start benchmarking.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-left">
                <div className="p-4 rounded-xl border border-border/40 bg-muted/5 hover:bg-muted/10 transition-colors">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-6 h-6 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                      <ExternalLink className="w-3 h-3 text-emerald-600" />
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-wider">Easy Import</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground leading-relaxed">
                    Paste individual tweet URLs. No developer tools needed.
                  </p>
                </div>
                <div className="p-4 rounded-xl border border-border/40 bg-muted/5 hover:bg-muted/10 transition-colors">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-6 h-6 rounded-lg bg-blue-500/10 flex items-center justify-center">
                      <Archive className="w-3 h-3 text-blue-600" />
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-wider">Advanced Import</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground leading-relaxed">
                    Paste raw Twitter API JSON from browser DevTools. Best for bulk initial import.
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-center gap-3 pt-2">
                <Link href="/competitors/archive">
                  <Button size="sm" className="h-8 gap-2 px-5 text-[10px] font-bold uppercase tracking-wider">
                    Open Tweet Archive
                    <ArrowRight className="w-3 h-3" />
                  </Button>
                </Link>
                <a
                  href="https://x.com/cinepoint_"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Button variant="outline" size="sm" className="h-8 gap-2 px-4 text-[10px] font-bold uppercase tracking-wider">
                    <ExternalLink className="w-3 h-3" />
                    Open @cinepoint_
                  </Button>
                </a>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Gap Nudge Banner */}
          {(() => {
            const recent14 = Array.from({ length: 14 }, (_, i) => {
              const d = subDays(new Date(), 13 - i);
              return format(d, 'yyyy-MM-dd');
            });
            const missingRecent = recent14.filter(d => !trendDays.find(t => t.date === d));
            if (missingRecent.length === 0) return null;
            return (
              <div className="flex items-center justify-between px-4 py-3 rounded-xl border border-amber-500/20 bg-amber-500/5">
                <div className="flex items-center gap-3">
                  <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                  <div>
                    <span className="text-[11px] font-bold text-amber-700 dark:text-amber-400">
                      {missingRecent.length} date{missingRecent.length > 1 ? 's' : ''} in the last 14 days need data
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <a
                    href="https://x.com/cinepoint_"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="h-7 px-3 text-[9px] font-bold uppercase tracking-wider flex items-center gap-1.5 rounded-lg border border-border/40 text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors"
                  >
                    <ExternalLink className="w-3 h-3" />
                    @cinepoint_
                  </a>
                  <Link href="/competitors/archive">
                    <Button variant="outline" size="sm" className="h-7 gap-1.5 px-3 text-[9px] font-bold uppercase tracking-wider">
                      <Archive className="w-3 h-3" />
                      Backfill in Archive
                    </Button>
                  </Link>
                </div>
              </div>
            );
          })()}

          {/* Summary Cards Row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {/* Coverage Ratio */}
            <Card className="overflow-hidden border-border/50">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Target className="w-3.5 h-3.5 text-primary/60" />
                  <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/60">
                    Avg Coverage (7d)
                  </span>
                </div>
                <p className="text-xl font-black font-mono">
                  {summary7d?.avg_coverage !== null && summary7d?.avg_coverage !== undefined
                    ? `${summary7d.avg_coverage.toFixed(1)}%`
                    : '—'}
                </p>
                {summary7d && (
                  <p className="text-[10px] text-muted-foreground mt-1">
                    {summary7d.days_with_data} days tracked
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Confidence Score */}
            <Card className="overflow-hidden border-border/50">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Shield className="w-3.5 h-3.5 text-primary/60" />
                  <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/60">
                    Avg Confidence (7d)
                  </span>
                </div>
                <p className="text-xl font-black font-mono">
                  {summary7d?.avg_confidence !== null && summary7d?.avg_confidence !== undefined
                    ? `${summary7d.avg_confidence.toFixed(0)}`
                    : '—'}
                </p>
                {latestDay?.confidence && (
                  <Badge variant="outline" className={cn('text-[8px] h-5 px-1.5 mt-1 border', confidenceColor(latestDay.confidence.level))}>
                    {latestDay.confidence.level}
                  </Badge>
                )}
              </CardContent>
            </Card>

            {/* Showtime Delta */}
            <Card className="overflow-hidden border-border/50">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <BarChart3 className="w-3.5 h-3.5 text-primary/60" />
                  <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/60">
                    Showtime Delta (7d)
                  </span>
                </div>
                <p className={cn('text-xl font-black font-mono', deltaColor(summary7d?.avg_showtime_delta))}>
                  {formatDelta(summary7d?.avg_showtime_delta)}
                </p>
              </CardContent>
            </Card>

            {/* Market Estimate */}
            <Card className="overflow-hidden border-border/50">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="w-3.5 h-3.5 text-primary/60" />
                  <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/60">
                    Market Estimate (Latest)
                  </span>
                </div>
                <p className="text-xl font-black font-mono">
                  {marketEstimate
                    ? marketEstimate.estimated_total.toLocaleString()
                    : '—'}
                </p>
                {marketEstimate && (
                  <p className="text-[10px] text-muted-foreground mt-1">
                    from {marketEstimate.cr_admissions.toLocaleString()} at {marketEstimate.coverage_pct}% coverage
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Charts Section */}
          <Tabs defaultValue="coverage" className="w-full">
            <div className="flex items-center justify-between mb-4">
              <TabsList className="bg-muted/10 border border-border/40">
                <TabsTrigger value="coverage" className="text-[10px] uppercase font-bold tracking-widest">
                  Coverage Trend
                </TabsTrigger>
                <TabsTrigger value="confidence" className="text-[10px] uppercase font-bold tracking-widest">
                  Confidence
                </TabsTrigger>
                <TabsTrigger value="heatmap" className="text-[10px] uppercase font-bold tracking-widest">
                  Accuracy Heatmap
                </TabsTrigger>
                <TabsTrigger value="boxoffice" className="text-[10px] uppercase font-bold tracking-widest">
                  Box Office
                </TabsTrigger>
              </TabsList>
            </div>

            {/* Coverage Trend Tab */}
            <TabsContent value="coverage" className="mt-0 outline-none">
              <Card className="overflow-hidden border-border/50">
                <CardContent className="p-6">
                  <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-4">
                    CineRadar Coverage Ratio vs CinePoint — Last {daysWithData.length} Days
                  </h3>
                  <div className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={coverageChartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                        <XAxis
                          dataKey="date"
                          axisLine={false}
                          tickLine={false}
                          tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }}
                          dy={10}
                        />
                        <YAxis
                          axisLine={false}
                          tickLine={false}
                          tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }}
                          domain={[0, 120]}
                          tickFormatter={(v: number) => `${v}%`}
                        />
                        <RechartsTooltip content={<CoverageTooltip />} />
                        <Legend wrapperStyle={{ fontSize: '10px', paddingTop: '8px' }} />
                        <ReferenceLine y={80} stroke="var(--muted-foreground)" strokeDasharray="5 5" strokeOpacity={0.3} label="" />
                        <Line
                          type="monotone"
                          name="Coverage %"
                          dataKey="coverage_ratio"
                          stroke="var(--primary)"
                          strokeWidth={2.5}
                          dot={{ fill: 'var(--primary)', strokeWidth: 2, r: 3 }}
                          activeDot={{ r: 5, strokeWidth: 0 }}
                          connectNulls
                        />
                        <Line
                          type="monotone"
                          name="Match Rate %"
                          dataKey="match_rate"
                          stroke="#10b981"
                          strokeWidth={2}
                          dot={{ fill: '#10b981', strokeWidth: 2, r: 2 }}
                          activeDot={{ r: 4, strokeWidth: 0 }}
                          connectNulls
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="mt-4 px-4 py-3 rounded-lg border border-border/40 bg-muted/5 text-[11px] text-muted-foreground leading-relaxed">
                    <span className="font-semibold text-foreground">Reading this chart:</span> The coverage ratio shows what fraction of CinePoint&apos;s total each CineRadar captures. 
                    A <span className="font-semibold">stable line</span> means CineRadar is a reliable sample of the market — useful for extrapolation. 
                    A <span className="font-semibold">volatile line</span> indicates inconsistent scraping coverage.
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Confidence Tab */}
            <TabsContent value="confidence" className="mt-0 outline-none">
              <Card className="overflow-hidden border-border/50">
                <CardContent className="p-6">
                  <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-4">
                    Confidence Score Breakdown — Data Trustworthiness Over Time
                  </h3>
                  <div className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={confidenceChartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                        <XAxis
                          dataKey="date"
                          axisLine={false}
                          tickLine={false}
                          tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }}
                          dy={10}
                        />
                        <YAxis
                          axisLine={false}
                          tickLine={false}
                          tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }}
                          domain={[0, 100]}
                        />
                        <RechartsTooltip content={<ConfidenceTooltip />} />
                        <Legend wrapperStyle={{ fontSize: '10px', paddingTop: '8px' }} />
                        <ReferenceLine y={80} stroke="var(--muted-foreground)" strokeDasharray="5 5" strokeOpacity={0.3} />
                        <Bar name="Match Score" dataKey="match_score" stackId="a" fill="#10b981" radius={[0, 0, 0, 0]} barSize={24} />
                        <Bar name="Deviation Score" dataKey="deviation_score" stackId="a" fill="#3b82f6" radius={[0, 0, 0, 0]} barSize={24} />
                        <Bar name="Completeness Score" dataKey="completeness_score" stackId="a" fill="#8b5cf6" radius={[4, 4, 0, 0]} barSize={24} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="mt-4 grid grid-cols-3 gap-3">
                    <div className="px-3 py-2 rounded-lg border border-emerald-500/20 bg-emerald-500/5">
                      <p className="text-[9px] font-black uppercase tracking-widest text-emerald-600/60">Match Score (40%)</p>
                      <p className="text-[11px] text-muted-foreground mt-1">How many CP movies linked to CineRadar</p>
                    </div>
                    <div className="px-3 py-2 rounded-lg border border-blue-500/20 bg-blue-500/5">
                      <p className="text-[9px] font-black uppercase tracking-widest text-blue-600/60">Deviation Score (35%)</p>
                      <p className="text-[11px] text-muted-foreground mt-1">How close numbers are to CP benchmark</p>
                    </div>
                    <div className="px-3 py-2 rounded-lg border border-violet-500/20 bg-violet-500/5">
                      <p className="text-[9px] font-black uppercase tracking-widest text-violet-600/60">Completeness (25%)</p>
                      <p className="text-[11px] text-muted-foreground mt-1">Both showtimes + admissions present</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Heatmap Tab */}
            <TabsContent value="heatmap" className="mt-0 outline-none">
              <Card className="overflow-hidden border-border/50">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                      Per-Movie Accuracy Heatmap — Last {heatmapDates.length} Days
                    </h3>
                    <div className="flex items-center gap-3 text-[9px] font-bold">
                      <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-emerald-500/20 border border-emerald-500/30" /> Matched (&lt;5%)</span>
                      <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-amber-500/20 border border-amber-500/30" /> High Drift (&gt;5%)</span>
                      <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-red-500/20 border border-red-500/30" /> Unmatched</span>
                    </div>
                  </div>

                  {heatmapData.length === 0 ? (
                    <div className="py-12 text-center text-xs text-muted-foreground">
                      No heatmap data available.
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-[10px]">
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
                                  <Badge variant="outline" className="text-[8px] h-4 px-1 bg-red-500/10 text-red-600 border-red-500/20">
                                    {movie.total_unmatched}
                                  </Badge>
                                ) : (
                                  <span className="text-emerald-500 text-[9px]">✓</span>
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
                                      className={cn('mx-auto w-[44px] h-[22px] flex items-center justify-center rounded border text-[9px] font-bold', heatmapCellBg(cell.status))}
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
                    <div className="mt-4 px-4 py-3 rounded-lg border border-red-500/20 bg-red-500/5 text-[11px]">
                      <p className="font-bold text-red-600 mb-1">Inventory Blindspots Detected</p>
                      <p className="text-muted-foreground">
                        These movies appear in CinePoint&apos;s reports but CineRadar cannot match them. 
                        This may indicate missing movies in the database or gaps in cinema coverage.
                      </p>
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {heatmapData
                          .filter((m) => m.total_unmatched > 0)
                          .map((m) => (
                            <Badge key={m.title_cp} variant="outline" className="text-[9px] h-5 bg-red-500/10 text-red-600 border-red-500/20">
                              {m.title_cp} ({m.total_unmatched}d)
                            </Badge>
                          ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Box Office Tab */}
            <TabsContent value="boxoffice" className="mt-0 outline-none">
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
            </TabsContent>
          </Tabs>

          {/* Recent Days Quick Nav */}
          <Card className="overflow-hidden border-border/50">
            <CardContent className="p-3">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/50">
                    Recent 14 Days
                  </span>
                  <span className="text-[9px] font-bold text-muted-foreground/40">
                    {daysWithData.length} days with data
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
                          'flex-1 flex flex-col items-center gap-0.5 py-1.5 px-0.5 rounded-md border text-[9px] font-bold transition-colors',
                          statusColor,
                          'hover:bg-primary/10 hover:border-primary/20',
                        )}
                      >
                        <span className="font-mono">{format(d, 'dd')}</span>
                        <span className="uppercase tracking-wider text-muted-foreground/50 text-[8px]">
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
        </div>
      )}
    </div>
  );
}

// ─── Custom Tooltip Components ─────────────────────────────

function CoverageTooltip({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-background/95 backdrop-blur-md border border-border/40 rounded-xl shadow-2xl p-3 min-w-[160px]">
      <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground mb-2 border-b border-border/20 pb-1">{label}</p>
      {payload.map((entry, i) => (
        <div key={i} className="flex items-center justify-between gap-4 py-0.5">
          <span className="text-[10px] font-bold text-muted-foreground">{entry.name}</span>
          <span className="font-mono text-[11px] font-black">{typeof entry.value === 'number' ? `${entry.value.toFixed(1)}%` : '—'}</span>
        </div>
      ))}
    </div>
  );
}

function ConfidenceTooltip({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  const total = payload.reduce((s, e) => s + (typeof e.value === 'number' ? e.value : 0), 0);
  return (
    <div className="bg-background/95 backdrop-blur-md border border-border/40 rounded-xl shadow-2xl p-3 min-w-[180px]">
      <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground mb-2 border-b border-border/20 pb-1">{label}</p>
      {payload.map((entry, i) => (
        <div key={i} className="flex items-center justify-between gap-4 py-0.5">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
            <span className="text-[10px] font-bold text-muted-foreground">{entry.name}</span>
          </div>
          <span className="font-mono text-[11px] font-black">{typeof entry.value === 'number' ? Math.round(entry.value) : '—'}</span>
        </div>
      ))}
      <div className="mt-1 pt-1 border-t border-border/20 flex justify-between">
        <span className="text-[10px] font-black text-foreground">Total</span>
        <span className="font-mono text-[11px] font-black">{Math.round(total)}</span>
      </div>
    </div>
  );
}
