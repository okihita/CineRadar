import { useCallback, useEffect, useState, useMemo } from 'react';
import type {
  TrendDay,
  HeatmapCell,
  CumulativeMovieTrack,
} from '@/features/competitors/types';

// ─── Exported Chart Datum Types ──────────────────────────────

export type CoverageChartDatum = ReturnType<typeof buildCoverageChartData>[number];
export type ConfidenceChartDatum = ReturnType<typeof buildConfidenceChartData>[number];

// ─── Return Type ─────────────────────────────────────────────

export interface TrendSummary7d {
  avg_coverage: number | null;
  avg_confidence: number | null;
  avg_showtime_delta: number | null;
  avg_admission_delta: number | null;
  days_with_data: number;
  days_complete: number;
}

export interface MarketEstimate {
  cr_admissions: number;
  estimated_total: number;
  coverage_pct: number;
}

export interface UseTrendDataReturn {
  trendDays: TrendDay[];
  cumulative: CumulativeMovieTrack[];
  loading: boolean;
  error: string | null;
  daysWithData: TrendDay[];
  heatmapData: HeatmapCell[];
  coverageChartData: CoverageChartDatum[];
  confidenceChartData: ConfidenceChartDatum[];
  heatmapDates: string[];
  latestDay: TrendDay | null;
  marketEstimate: MarketEstimate | null;
  summary7d: TrendSummary7d | null;
}

// ─── Pure Data Builders ──────────────────────────────────────

function buildDaysWithData(trendDays: TrendDay[]): TrendDay[] {
  return trendDays
    .filter((d) => d.status !== 'empty')
    .sort((a, b) => a.date.localeCompare(b.date));
}

function buildHeatmapData(daysWithData: TrendDay[]): HeatmapCell[] {
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
}

function buildCoverageChartData(daysWithData: TrendDay[]) {
  return daysWithData.map((d) => ({
    date: d.date.substring(5),
    fullDate: d.date,
    coverage_ratio: d.coverage_ratio !== null ? parseFloat((d.coverage_ratio * 100).toFixed(1)) : null,
    showtime_delta_pct: d.showtime_delta_pct,
    match_rate: d.match_rate !== null ? parseFloat((d.match_rate * 100).toFixed(1)) : null,
    confidence: d.confidence?.score ?? null,
  }));
}

function buildConfidenceChartData(daysWithData: TrendDay[]) {
  return daysWithData.map((d) => ({
    date: d.date.substring(5),
    fullDate: d.date,
    score: d.confidence?.score ?? null,
    match_score: d.confidence?.breakdown.match_score ?? null,
    deviation_score: d.confidence?.breakdown.deviation_score ?? null,
    completeness_score: d.confidence?.breakdown.completeness_score ?? null,
  }));
}

function buildMarketEstimate(latestDay: TrendDay | null): MarketEstimate | null {
  if (!latestDay || !latestDay.coverage_ratio || latestDay.coverage_ratio === 0) return null;
  return {
    cr_admissions: latestDay.total_cr_admissions,
    estimated_total: Math.round(latestDay.total_cr_admissions / latestDay.coverage_ratio),
    coverage_pct: parseFloat((latestDay.coverage_ratio * 100).toFixed(1)),
  };
}

function buildSummary7d(daysWithData: TrendDay[]): TrendSummary7d | null {
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
}

// ─── Hook ────────────────────────────────────────────────────

export function useTrendData(): UseTrendDataReturn {
  const [trendDays, setTrendDays] = useState<TrendDay[]>([]);
  const [cumulative, setCumulative] = useState<CumulativeMovieTrack[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboard = useCallback(async () => {
    setLoading(true);
    setError(null);
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
      setError('Failed to load dashboard data. Please try refreshing.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  const daysWithData = useMemo(() => buildDaysWithData(trendDays), [trendDays]);
  const heatmapData = useMemo(() => buildHeatmapData(daysWithData), [daysWithData]);
  const coverageChartData = useMemo(() => buildCoverageChartData(daysWithData), [daysWithData]);
  const confidenceChartData = useMemo(() => buildConfidenceChartData(daysWithData), [daysWithData]);
  const heatmapDates = useMemo(() => daysWithData.slice(-10).map((d) => d.date), [daysWithData]);

  const latestDay = useMemo(() => daysWithData.length > 0 ? daysWithData[daysWithData.length - 1] : null, [daysWithData]);
  const marketEstimate = useMemo(() => buildMarketEstimate(latestDay), [latestDay]);
  const summary7d = useMemo(() => buildSummary7d(daysWithData), [daysWithData]);

  return {
    trendDays,
    cumulative,
    loading,
    error,
    daysWithData,
    heatmapData,
    coverageChartData,
    confidenceChartData,
    heatmapDates,
    latestDay,
    marketEstimate,
    summary7d,
  };
}
