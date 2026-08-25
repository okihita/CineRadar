'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { HeatmapCell, CumulativeMovieTrack } from '@/features/competitors/types';
import type { CoverageChartDatum, ConfidenceChartDatum } from './useTrendData';
import { CoverageChart } from './CoverageChart';
import { ConfidenceChart } from './ConfidenceChart';
import { HeatmapTable } from './HeatmapTable';
import { BoxOfficeTable } from './BoxOfficeTable';

interface ChartsTabsProps {
  coverageChartData: CoverageChartDatum[];
  confidenceChartData: ConfidenceChartDatum[];
  heatmapData: HeatmapCell[];
  heatmapDates: string[];
  cumulative: CumulativeMovieTrack[];
  daysWithDataCount: number;
}

export function ChartsTabs({
  coverageChartData,
  confidenceChartData,
  heatmapData,
  heatmapDates,
  cumulative,
  daysWithDataCount,
}: ChartsTabsProps) {
  return (
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

      <TabsContent value="coverage" className="mt-0 outline-none">
        <CoverageChart data={coverageChartData} daysCount={daysWithDataCount} />
      </TabsContent>

      <TabsContent value="confidence" className="mt-0 outline-none">
        <ConfidenceChart data={confidenceChartData} />
      </TabsContent>

      <TabsContent value="heatmap" className="mt-0 outline-none">
        <HeatmapTable heatmapData={heatmapData} heatmapDates={heatmapDates} />
      </TabsContent>

      <TabsContent value="boxoffice" className="mt-0 outline-none">
        <BoxOfficeTable cumulative={cumulative} />
      </TabsContent>
    </Tabs>
  );
}
