'use client';

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatAdm } from '@/lib/cinepoint';
import type { FactorState, LanguageStat, RatingStat, DurationBucket } from '@/lib/cinepoint';

interface MarketSignalsProps {
  factors: FactorState;
  languageStats: Record<string, LanguageStat>;
  ratingStats: RatingStat[];
  durationBuckets: DurationBucket[];
}

export function MarketSignals({ factors, languageStats, ratingStats, durationBuckets }: MarketSignalsProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {factors.language && (
        <div className="space-y-4">
          {Object.entries(languageStats).map(([lang, stats]) => (
            <Card key={lang}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-black uppercase tracking-[0.2em] flex items-center gap-2">
                  <span className={cn('w-2.5 h-2.5 rounded-full', lang === 'Indonesia' ? 'bg-indigo-500' : 'bg-amber-500')} />
                  {lang}
                  <span className="text-muted-foreground font-normal normal-case tracking-normal text-xs ml-auto">
                    {stats.count} movies · Avg {formatAdm(stats.avg_admission)} · Hit {stats.hit_rate_pct}%
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={160}>
                  <BarChart data={stats.top_genres}>
                    <CartesianGrid strokeDasharray="3 3" className="opacity-20" />
                    <XAxis dataKey="genre" tick={{ fontSize: 9 }} />
                    <YAxis tick={{ fontSize: 9 }} tickFormatter={(v) => formatAdm(Number(v))} />
                    <Tooltip formatter={(v) => Number(v).toLocaleString()} />
                    <Bar dataKey="avg_admission" radius={[3, 3, 0, 0]} fill={lang === 'Indonesia' ? '#6366f1' : '#f59e0b'} fillOpacity={0.7} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <div className="space-y-4">
        {factors.duration && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-black uppercase tracking-[0.2em]">Duration Sweet Spot</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={durationBuckets}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-20" />
                  <XAxis dataKey="range" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 9 }} tickFormatter={(v) => formatAdm(Number(v))} />
                  <Tooltip formatter={(v) => Number(v).toLocaleString()} />
                  <Bar dataKey="avg_admission" radius={[3, 3, 0, 0]}>
                    {durationBuckets.map((d, i) => {
                      const max = Math.max(...durationBuckets.map((x) => x.avg_admission));
                      return <Cell key={i} fill={d.avg_admission === max ? '#10b981' : '#6366f1'} fillOpacity={d.avg_admission === max ? 1 : 0.4} />;
                    })}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {factors.rating && ratingStats.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-black uppercase tracking-[0.2em]">Age Rating Impact</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={ratingStats} layout="vertical" margin={{ left: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-20" />
                  <XAxis type="number" tick={{ fontSize: 9 }} tickFormatter={(v) => formatAdm(Number(v))} />
                  <YAxis type="category" dataKey="rating" width={50} tick={{ fontSize: 10 }} />
                  <Tooltip formatter={(v) => Number(v).toLocaleString()} />
                  <Bar dataKey="avg_admission" radius={[0, 3, 3, 0]} fill="#8b5cf6" fillOpacity={0.7} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
