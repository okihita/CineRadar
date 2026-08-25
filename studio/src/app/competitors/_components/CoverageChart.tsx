'use client';

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ReferenceLine,
} from 'recharts';
import { Card, CardContent } from '@/components/ui/card';
import type { CoverageChartDatum } from './useTrendData';

export function CoverageChart({ data, daysCount }: { data: CoverageChartDatum[]; daysCount: number }) {
  return (
    <Card className="overflow-hidden border-border/50">
      <CardContent className="p-6">
        <h3 className="text-sm font-black uppercase tracking-widest text-muted-foreground mb-4">
          CineRadar Coverage Ratio vs CinePoint — Last {daysCount} Days
        </h3>
        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
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
        <div className="mt-4 px-4 py-3 rounded-lg border border-border/40 bg-muted/5 text-sm text-muted-foreground leading-relaxed">
          <span className="font-semibold text-foreground">Reading this chart:</span> The coverage ratio shows what fraction of CinePoint&apos;s total each CineRadar captures. 
          A <span className="font-semibold">stable line</span> means CineRadar is a reliable sample of the market — useful for extrapolation. 
          A <span className="font-semibold">volatile line</span> indicates inconsistent scraping coverage.
        </div>
      </CardContent>
    </Card>
  );
}

function CoverageTooltip({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-background/95 backdrop-blur-md border border-border/40 rounded-xl shadow-2xl p-3 min-w-[160px]">
      <p className="text-sm font-black uppercase tracking-widest text-muted-foreground mb-2 border-b border-border/20 pb-1">{label}</p>
      {payload.map((entry, i) => (
        <div key={i} className="flex items-center justify-between gap-4 py-0.5">
          <span className="text-sm font-bold text-muted-foreground">{entry.name}</span>
          <span className="font-mono text-sm font-black">{typeof entry.value === 'number' ? `${entry.value.toFixed(1)}%` : '—'}</span>
        </div>
      ))}
    </div>
  );
}
