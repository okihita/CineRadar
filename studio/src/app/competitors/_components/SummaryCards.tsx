'use client';

import { Target, Shield, BarChart3, TrendingUp } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { confidenceColor, deltaColor, formatDelta } from '@/lib/cinepoint';
import type { TrendSummary7d, MarketEstimate } from './useTrendData';
import type { TrendDay } from '@/features/competitors/types';

interface SummaryCardsProps {
  summary7d: TrendSummary7d | null;
  marketEstimate: MarketEstimate | null;
  latestDay: TrendDay | null;
}

export function SummaryCards({ summary7d, marketEstimate, latestDay }: SummaryCardsProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {/* Coverage Ratio */}
      <Card className="overflow-hidden border-border/50">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <Target className="w-3.5 h-3.5 text-primary/60" />
            <span className="text-sm font-black uppercase tracking-widest text-muted-foreground/60">
              Avg Coverage (7d)
            </span>
          </div>
          <p className="text-xl font-black font-mono">
            {summary7d?.avg_coverage != null
              ? `${summary7d.avg_coverage.toFixed(1)}%`
              : '—'}
          </p>
          {summary7d && (
            <p className="text-sm text-muted-foreground mt-1">
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
            <span className="text-sm font-black uppercase tracking-widest text-muted-foreground/60">
              Avg Confidence (7d)
            </span>
          </div>
          <p className="text-xl font-black font-mono">
            {summary7d?.avg_confidence != null
              ? `${summary7d.avg_confidence.toFixed(0)}`
              : '—'}
          </p>
          {latestDay?.confidence && (
            <Badge variant="outline" className={cn('text-sm h-5 px-1.5 mt-1 border', confidenceColor(latestDay.confidence.level))}>
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
            <span className="text-sm font-black uppercase tracking-widest text-muted-foreground/60">
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
            <span className="text-sm font-black uppercase tracking-widest text-muted-foreground/60">
              Market Estimate (Latest)
            </span>
          </div>
          <p className="text-xl font-black font-mono">
            {marketEstimate
              ? marketEstimate.estimated_total.toLocaleString()
              : '—'}
          </p>
          {marketEstimate && (
            <p className="text-sm text-muted-foreground mt-1">
              from {marketEstimate.cr_admissions.toLocaleString()} at {marketEstimate.coverage_pct}% coverage
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
