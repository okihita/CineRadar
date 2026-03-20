'use client'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

interface SeatBreakdownCardProps {
  totalSeats: number;
  blockedSeats: number;
  soldSeats: number;
  audienceCount: number;
  trueOccupancyPct: number;
  rawOccupancyPct: number;
  baselineCapturedAt?: string;
  lastScrapedAt?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function SeatBreakdownCard({
  totalSeats = 0,
  blockedSeats = 0,
  soldSeats = 0,
  audienceCount = 0,
  trueOccupancyPct = 0,
  rawOccupancyPct = 0,
  baselineCapturedAt,
  lastScrapedAt,
  size = 'md',
}: SeatBreakdownCardProps) {
  const availableSeats = Math.max(0, (totalSeats || 0) - (blockedSeats || 0) - (soldSeats || 0));
  const hasBaseline = baselineCapturedAt !== undefined;
  const blockedPct = totalSeats > 0 ? ((blockedSeats || 0) / totalSeats) * 100 : 0;
  const availablePct = totalSeats > 0 ? (availableSeats / totalSeats) * 100 : 0;

  const sizeClasses = {
    sm: 'text-xs p-3',
    md: 'text-sm p-4',
    lg: 'text-base p-5',
  };

  return (
    <Card className={cn('w-full', sizeClasses[size])}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center justify-between">
          <span>Seat Breakdown</span>
          {hasBaseline && (
            <Badge variant="outline" className="text-xs">
              True Audience
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Seat counts */}
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="space-y-1">
            <div className="text-lg font-bold text-red-500">{blockedSeats}</div>
            <div className="text-xs text-muted-foreground">Blocked</div>
            <div className="text-xs text-muted-foreground">{blockedPct.toFixed(1)}%</div>
          </div>
          <div className="space-y-1">
            <div className="text-lg font-bold text-green-500">{soldSeats}</div>
            <div className="text-xs text-muted-foreground">Sold</div>
            <div className="text-xs text-muted-foreground">{trueOccupancyPct.toFixed(1)}%</div>
          </div>
          <div className="space-y-1">
            <div className="text-lg font-bold text-gray-400">{availableSeats}</div>
            <div className="text-xs text-muted-foreground">Available</div>
            <div className="text-xs text-muted-foreground">{availablePct.toFixed(1)}%</div>
          </div>
        </div>

        {/* Progress bar */}
        <div className="h-2 bg-muted rounded-full overflow-hidden flex">
          {blockedPct > 0 && (
            <div
              className="bg-red-500 h-full"
              style={{ width: `${blockedPct}%` }}
              title={`Blocked: ${blockedSeats} (${blockedPct.toFixed(1)}%)`}
            />
          )}
          {trueOccupancyPct > 0 && (
            <div
              className="bg-green-500 h-full"
              style={{ width: `${trueOccupancyPct}%` }}
              title={`Sold: ${soldSeats} (${trueOccupancyPct.toFixed(1)}%)`}
            />
          )}
          {availablePct > 0 && (
            <div
              className="bg-gray-300 h-full"
              style={{ width: `${availablePct}%` }}
              title={`Available: ${availableSeats} (${availablePct.toFixed(1)}%)`}
            />
          )}
        </div>

        {/* Comparison info */}
        {hasBaseline && (
          <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t">
            <span>Raw occupancy: {rawOccupancyPct.toFixed(1)}%</span>
            <span>True occupancy: {trueOccupancyPct.toFixed(1)}%</span>
          </div>
        )}

        {/* Timestamps */}
        {(baselineCapturedAt || lastScrapedAt) && (
          <div className="text-xs text-muted-foreground space-y-1 pt-2 border-t">
            {baselineCapturedAt && (
              <div>Baseline captured: {new Date(baselineCapturedAt).toLocaleString()}</div>
            )}
            {lastScrapedAt && (
              <div>Last scraped: {new Date(lastScrapedAt).toLocaleString()}</div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
