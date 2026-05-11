'use client';

import {
  AreaChart, Area, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer,
} from 'recharts';
import { format, parseISO } from 'date-fns';
import {
  Loader2, TrendingUp, ArrowDownRight, Star, Users, Popcorn,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { formatAdm, LOCAL_COLOR, INTL_COLOR, TIER_COLORS } from '@/lib/cinepoint';
import { MetaChip } from './MovieDetailPanel';
import { MovieDetailPanel } from './MovieDetailPanel';

const MS_PER_DAY = 86_400_000;

export function MovieDrillDown({
  data, selectedMovie, setSelectedMovie, enrichedMovie, enrichedLoading,
}: {
  data: NonNullable<ReturnType<typeof import('./useBoxOfficeData')['useBoxOfficeData']>['data']>;
  selectedMovie: number | null;
  setSelectedMovie: (id: number | null) => void;
  enrichedMovie: ReturnType<typeof import('./useBoxOfficeData')['useBoxOfficeData']>['enrichedMovie'];
  enrichedLoading: boolean;
}) {
  if (!selectedMovie) return null;
  const movie = data.movie_rankings.find((m) => m.id === selectedMovie);
  if (!movie) return null;

  // Week bucket computation
  const weekBuckets = new Map<number, { total: number }>();
  for (const d of movie.daily) {
    const weekNum = Math.floor((new Date(d.date).getTime() - new Date(movie.daily[0].date).getTime()) / (7 * MS_PER_DAY));
    const existing = weekBuckets.get(weekNum);
    if (existing) existing.total += d.admission;
    else weekBuckets.set(weekNum, { total: d.admission });
  }
  const weeklyTotals = [...weekBuckets.entries()].sort(([a], [b]) => a - b).map(([w, { total }]) => ({ week: `W${w + 1}`, admissions: total }));
  const wowDrop = weeklyTotals.length >= 2 ? (((weeklyTotals[0].admissions - weeklyTotals[1].admissions) / weeklyTotals[0].admissions) * 100).toFixed(1) : null;

  return (
    <>
      <Card>
        <CardHeader className="pb-2 border-b">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-black uppercase tracking-[0.2em]">{movie.title}</h3>
            <button onClick={() => setSelectedMovie(null)} className="text-xs text-muted-foreground hover:text-foreground">✕ Close</button>
          </div>
          <div className="flex flex-wrap items-center gap-2 mt-2">
            <Badge variant="outline" className={movie.type === 'local' ? 'border-indigo-500/30 text-indigo-600' : 'border-amber-500/30 text-amber-600'}>
              {movie.type === 'local' ? 'Local' : 'International'}
            </Badge>
            <MetaChip icon={<Star className="w-3 h-3" />} value={`${movie.latest_score.toFixed(1)} score`} />
            <MetaChip icon={<Users className="w-3 h-3" />} value={`${movie.latest_total_admission.toLocaleString()} lifetime`} />
            <MetaChip icon={<Popcorn className="w-3 h-3" />} value={`${movie.peak_admission.toLocaleString()} peak`} />
            {wowDrop !== null && (
              <MetaChip icon={Number(wowDrop) > 0 ? <TrendingUp className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                value={`W1→W2: ${wowDrop}%`} className={Number(wowDrop) > 0 ? 'text-green-600' : 'text-red-600'} />
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="p-6">
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={movie.daily}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-20" />
                <XAxis dataKey="date" tickFormatter={(v) => format(parseISO(String(v)), 'MMM d')} tick={{ fontSize: 10 }} />
                <YAxis yAxisId="left" tick={{ fontSize: 10 }} tickFormatter={(v) => formatAdm(Number(v))} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} reversed domain={[1, 'auto']} />
                <Tooltip labelFormatter={(v) => format(parseISO(String(v)), 'EEE, MMM d')} formatter={(v, name) => name === 'Rank' ? `#${v}` : Number(v).toLocaleString()} />
                <Legend />
                <Line yAxisId="left" type="monotone" dataKey="admission" stroke={LOCAL_COLOR} strokeWidth={2} name="Admissions" dot={{ r: 2 }} />
                <Line yAxisId="right" type="monotone" dataKey="rank" stroke={INTL_COLOR} strokeWidth={1.5} name="Rank" strokeDasharray="4 4" dot={{ r: 2 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          {movie.daily.length > 1 && (
            <div className="border-t px-6 pb-6 pt-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 mb-2">Cumulative Admissions</p>
              <ResponsiveContainer width="100%" height={120}>
                <AreaChart data={movie.daily}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-20" />
                  <XAxis dataKey="date" tickFormatter={(v) => format(parseISO(String(v)), 'MMM d')} tick={{ fontSize: 9 }} />
                  <YAxis tick={{ fontSize: 9 }} tickFormatter={(v) => formatAdm(Number(v))} />
                  <Tooltip formatter={(v) => Number(v).toLocaleString()} />
                  <Area type="monotone" dataKey="total_admission" stroke={TIER_COLORS.mega_hit} fill={TIER_COLORS.mega_hit} fillOpacity={0.12} name="Cumulative" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>
      {enrichedLoading && (
        <Card><CardContent className="flex items-center justify-center py-12 gap-2">
          <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Loading movie details…</span>
        </CardContent></Card>
      )}
      {!enrichedLoading && enrichedMovie && <MovieDetailPanel movie={enrichedMovie} />}
    </>
  );
}
