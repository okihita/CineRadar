'use client';

import Link from 'next/link';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Sparkles } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatAdm } from '@/lib/cinepoint';
import type { FactorState, GenreStat, GenreCombo } from '@/lib/cinepoint';

interface GenreSectionProps {
  factors: FactorState;
  genreStats: GenreStat[];
  genreCombos: GenreCombo[];
}

export function GenreSection({ factors, genreStats, genreCombos }: GenreSectionProps) {
  if (!factors.genre) return null;

  return (
    <>
      {/* Genre chart + table */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <div className="lg:col-span-3">
          <Card className="h-full">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-black uppercase tracking-[0.2em] flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-indigo-500" /> Average Admissions by Genre
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={Math.min(genreStats.length * 28, 420)}>
                <BarChart data={genreStats.slice(0, 15)} layout="vertical" margin={{ left: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-20" />
                  <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={(v) => formatAdm(Number(v))} />
                  <YAxis type="category" dataKey="genre" width={90} tick={{ fontSize: 10 }} />
                  <Tooltip formatter={(v) => Number(v).toLocaleString()} />
                  <Bar dataKey="avg_admission" radius={[0, 3, 3, 0]}>
                    {genreStats.slice(0, 15).map((g, i) => (
                      <Cell key={i} fill={g.avg_admission >= 500_000 ? '#10b981' : g.avg_admission >= 200_000 ? '#6366f1' : '#94a3b8'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-2">
          <Card className="h-full">
            <CardHeader className="pb-2 border-b">
              <CardTitle className="text-sm font-black uppercase tracking-[0.2em]">Genre Stats</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-auto max-h-[450px]">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-background z-10">
                    <tr className="border-b text-[9px] font-black uppercase tracking-widest text-muted-foreground/50">
                      <th className="p-2 text-left">Genre</th><th className="p-2 text-right">Avg</th><th className="p-2 text-right">Hit%</th><th className="p-2 text-right">Score</th>
                    </tr>
                  </thead>
                  <tbody>
                    {genreStats.map((g) => (
                      <tr key={g.genre} className="border-b last:border-0 hover:bg-muted/20">
                        <td className="p-2 font-medium">{g.genre}</td>
                        <td className="p-2 text-right font-mono font-bold">{formatAdm(g.avg_admission)}</td>
                        <td className="p-2 text-right font-mono">
                          <span className={g.hit_rate_pct >= 25 ? 'text-emerald-600 font-bold' : g.hit_rate_pct >= 10 ? 'text-amber-600' : 'text-muted-foreground'}>
                            {g.hit_rate_pct}%
                          </span>
                        </td>
                        <td className="p-2 text-right font-mono text-muted-foreground">{g.avg_score || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Genre combos */}
      {genreCombos.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-black uppercase tracking-[0.2em] flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-purple-500" /> Genre Combinations (min 10 movies)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={Math.min(genreCombos.length * 26, 350)}>
              <BarChart data={genreCombos} layout="vertical" margin={{ left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-20" />
                <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={(v) => formatAdm(Number(v))} />
                <YAxis type="category" dataKey="combo" width={160} tick={{ fontSize: 9 }} />
                <Tooltip formatter={(v) => Number(v).toLocaleString()} />
                <Bar dataKey="avg_admission" radius={[0, 3, 3, 0]} fill="#8b5cf6" fillOpacity={0.7} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </>
  );
}
