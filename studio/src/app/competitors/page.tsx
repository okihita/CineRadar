'use client';

import { CinePointErrorBoundary } from '@/components/cinepoint/ErrorBoundary';
import { PageError } from '@/components/cinepoint/PageShell';
import { useTrendData } from './_components/useTrendData';
import { DashboardHeader } from './_components/DashboardHeader';
import { DashboardSkeleton } from './_components/DashboardSkeleton';
import { EmptyState } from './_components/EmptyState';
import { GapBanner } from './_components/GapBanner';
import { SummaryCards } from './_components/SummaryCards';
import { ChartsTabs } from './_components/ChartsTabs';
import { RecentDaysNav } from './_components/RecentDaysNav';

export default function CompetitorsDashboard() {
  const {
    trendDays, cumulative, loading, error,
    daysWithData, heatmapData,
    coverageChartData, confidenceChartData,
    heatmapDates, latestDay, marketEstimate, summary7d,
  } = useTrendData();

  const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Jakarta' });

  return (
    <div className="px-6 py-8 space-y-6">
      <DashboardHeader today={today} />

      {loading ? (
        <DashboardSkeleton />
      ) : error ? (
        <PageError error={error} />
      ) : daysWithData.length === 0 ? (
        <EmptyState />
      ) : (
        <CinePointErrorBoundary>
          <div className="space-y-6">
            <GapBanner trendDays={trendDays} />
            <SummaryCards summary7d={summary7d} marketEstimate={marketEstimate} latestDay={latestDay} />
            <ChartsTabs
              coverageChartData={coverageChartData}
              confidenceChartData={confidenceChartData}
              heatmapData={heatmapData}
              heatmapDates={heatmapDates}
              cumulative={cumulative}
              daysWithDataCount={daysWithData.length}
            />
            <RecentDaysNav trendDays={trendDays} daysWithDataCount={daysWithData.length} />
          </div>
        </CinePointErrorBoundary>
      )}
    </div>
  );
}
