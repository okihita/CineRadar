'use client';

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ReferenceLine,
} from 'recharts';
import { Card, CardContent } from '@/components/ui/card';
import type { ConfidenceChartDatum } from './useTrendData';

export function ConfidenceChart({ data }: { data: ConfidenceChartDatum[] }) {
  return (
    <Card className="overflow-hidden border-border/50">
      <CardContent className="p-6">
        <h3 className="text-sm font-black uppercase tracking-widest text-muted-foreground mb-4">
          Confidence Score Breakdown — Data Trustworthiness Over Time
        </h3>
        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
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
            <p className="text-sm font-black uppercase tracking-widest text-emerald-600/60">Match Score (40%)</p>
            <p className="text-sm text-muted-foreground mt-1">How many CP movies linked to CineRadar</p>
          </div>
          <div className="px-3 py-2 rounded-lg border border-blue-500/20 bg-blue-500/5">
            <p className="text-sm font-black uppercase tracking-widest text-blue-600/60">Deviation Score (35%)</p>
            <p className="text-sm text-muted-foreground mt-1">How close numbers are to CP benchmark</p>
          </div>
          <div className="px-3 py-2 rounded-lg border border-violet-500/20 bg-violet-500/5">
            <p className="text-sm font-black uppercase tracking-widest text-violet-600/60">Completeness (25%)</p>
            <p className="text-sm text-muted-foreground mt-1">Both showtimes + admissions present</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ConfidenceTooltip({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  const total = payload.reduce((s, e) => s + (typeof e.value === 'number' ? e.value : 0), 0);
  return (
    <div className="bg-background/95 backdrop-blur-md border border-border/40 rounded-xl shadow-2xl p-3 min-w-[180px]">
      <p className="text-sm font-black uppercase tracking-widest text-muted-foreground mb-2 border-b border-border/20 pb-1">{label}</p>
      {payload.map((entry, i) => (
        <div key={i} className="flex items-center justify-between gap-4 py-0.5">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
            <span className="text-sm font-bold text-muted-foreground">{entry.name}</span>
          </div>
          <span className="font-mono text-sm font-black">{typeof entry.value === 'number' ? Math.round(entry.value) : '—'}</span>
        </div>
      ))}
      <div className="mt-1 pt-1 border-t border-border/20 flex justify-between">
        <span className="text-sm font-black text-foreground">Total</span>
        <span className="font-mono text-sm font-black">{Math.round(total)}</span>
      </div>
    </div>
  );
}
