'use client';

import { Card, CardContent } from '@/components/ui/card';
import { TIER_COLORS, TIER_LABELS, TIER_KEYS } from '@/lib/cinepoint';
import type { OverviewStats } from '@/lib/cinepoint';

interface TierBarProps {
  overview: OverviewStats;
  animated: boolean;
}

export function TierBar({ overview, animated }: TierBarProps) {
  return (
    <Card>
      <CardContent className="py-4">
        <div className="flex h-6 rounded-lg overflow-hidden">
          {TIER_KEYS.map((tier) => {
            const count = overview.tiers[tier];
            const pct = overview.with_admissions > 0 ? (count / overview.with_admissions) * 100 : 0;
            return (
              <div key={tier}
                className="flex items-center justify-center text-sm font-bold text-white transition-all duration-700 ease-out"
                style={{ width: animated ? `${pct}%` : '0%', backgroundColor: TIER_COLORS[tier], minWidth: count > 0 ? 20 : 0, opacity: animated ? 1 : 0 }}
                title={`${TIER_LABELS[tier]}: ${count} (${pct.toFixed(1)}%)`}
              >
                {pct >= 8 ? count : ''}
              </div>
            );
          })}
        </div>
        <div className="flex flex-wrap gap-3 mt-2">
          {TIER_KEYS.map((tier) => (
            <span key={tier} className="flex items-center gap-1 text-sm text-muted-foreground">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: TIER_COLORS[tier] }} />
              {TIER_LABELS[tier]}: {overview.tiers[tier]}
            </span>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
