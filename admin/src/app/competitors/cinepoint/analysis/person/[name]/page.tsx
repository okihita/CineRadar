'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, Star, Clapperboard,
  Trophy,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from 'recharts';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PageError } from '@/components/cinepoint/PageShell';
import {
  useAnalysisData,
  formatAdm,
  computePersonDetail,
  admissionColor,
  classifyTier,
} from '@/lib/cinepoint';
import { StatCard, TypeBadge } from '@/components/cinepoint/SharedUi';

export default function PersonDetailPage() {
  const params = useParams();
  const name = decodeURIComponent(params.name as string);
  const { movies: allMovies, loading, error } = useAnalysisData();

  // Detect role: check directors first, then actors
  const role = useMemo(() => {
    const asDirector = allMovies.filter((m) => m.directors.includes(name)).length;
    const asActor = allMovies.filter((m) => m.actors.includes(name)).length;
    return asDirector >= asActor ? 'director' : 'actor';
  }, [allMovies, name]);

  const filmography = useMemo(() => {
    const key = role === 'director' ? 'directors' : 'actors';
    return allMovies
      .filter((m) => m[key].includes(name))
      .sort((a, b) => b.release_year - a.release_year);
  }, [allMovies, name, role]);

  const stats = useMemo(() => computePersonDetail(filmography), [filmography]);

  const chartData = useMemo(() =>
    filmography
      .filter((m) => m.total_admission > 0)
      .map((m) => ({ title: m.title.length > 20 ? m.title.slice(0, 20) + '…' : m.title, admissions: m.total_admission, id: m.id }))
      .sort((a, b) => b.admissions - a.admissions),
    [filmography],
  );

  const Icon = role === 'director' ? Clapperboard : Star;
  const label = role === 'director' ? 'Director' : 'Actor';
  const backHref = role === 'director' ? '/competitors/cinepoint/analysis/directors' : '/competitors/cinepoint/analysis/actors';

  if (loading) {
    return (
      <div className="px-6 py-8">
        <div className="flex flex-col items-center justify-center py-32 gap-4">
          <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/20 animate-pulse" />
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground/40">Loading…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return <div className="px-6 py-8"><PageError error={error} backHref={backHref} /></div>;
  }

  if (filmography.length === 0 && allMovies.length > 0) {
    return (
      <div className="px-6 py-8 space-y-6">
        <div className="flex items-center gap-3">
          <Link href={backHref} className="w-9 h-9 rounded-xl border border-border/40 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-base font-black tracking-tight">{name}</h1>
            <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold opacity-60">{label}</p>
          </div>
        </div>
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <p className="text-sm font-bold text-muted-foreground">No movies found for this {label.toLowerCase()}</p>
            <p className="text-xs text-muted-foreground/50 mt-1">
              The name &quot;{name}&quot; doesn&apos;t match any {role === 'director' ? 'director' : 'actor'} in the database.
            </p>
            <p className="text-[10px] text-muted-foreground/30 mt-2 font-mono">
              Try searching from the <Link href={backHref} className="text-primary hover:underline">{role === 'director' ? 'Director' : 'Actor'} Database</Link> instead.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="px-6 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href={backHref} className="w-9 h-9 rounded-xl border border-border/40 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center border', role === 'director' ? 'bg-amber-500/10 border-amber-500/20' : 'bg-indigo-500/10 border-indigo-500/20')}>
          <Icon className={cn('w-5 h-5', role === 'director' ? 'text-amber-500' : 'text-indigo-500')} />
        </div>
        <div>
          <h1 className="text-base font-black tracking-tight">{name}</h1>
          <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold opacity-60">
            {label} · {stats.total_movies} movies · {formatAdm(stats.total_admissions)} total admissions
          </p>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <StatCard label="Movies" value={stats.total_movies} />
        <StatCard label="Avg Admissions" value={formatAdm(stats.avg_admission)} />
        <StatCard label="Median" value={formatAdm(stats.median_admission)} />
        <StatCard label="Hit Rate" value={`${stats.hit_rate}%`} sub={`${stats.hit_count}/${stats.with_admissions}`} />
        <StatCard label="Avg Score" value={stats.avg_score || '—'} />
      </div>

      {/* Genres + Best Movie */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-black uppercase tracking-[0.2em]">Genres</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {stats.genres.map((g) => (
                <span key={g} className="text-xs font-medium px-3 py-1 rounded-lg bg-muted/50 border border-border/20">{g}</span>
              ))}
            </div>
          </CardContent>
        </Card>
        {stats.best_movie && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-black uppercase tracking-[0.2em] flex items-center gap-2">
                <Trophy className="w-4 h-4 text-amber-500" /> Best Performing
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Link href={`/competitors/cinepoint/movies/${stats.best_movie.id}`} className="group flex items-center gap-4">
                <div className="min-w-0">
                  <p className="text-lg font-black group-hover:text-primary transition-colors">{stats.best_movie.title}</p>
                  <p className="text-sm text-muted-foreground font-mono">{formatAdm(stats.best_movie.total_admission)} admissions</p>
                  <div className="flex gap-2 mt-1">
                    {stats.best_movie.genres.map((g) => (
                      <span key={g} className="text-[9px] font-medium px-1.5 py-0.5 rounded bg-muted/40 text-muted-foreground">{g}</span>
                    ))}
                  </div>
                </div>
              </Link>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Admissions chart */}
      {chartData.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-black uppercase tracking-[0.2em]">Filmography Performance</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={Math.min(chartData.length * 30, 500)}>
              <BarChart data={chartData} layout="vertical" margin={{ left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-20" />
                <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={(v) => formatAdm(Number(v))} />
                <YAxis type="category" dataKey="title" width={150} tick={{ fontSize: 10 }} />
                <Tooltip formatter={(v) => Number(v).toLocaleString()} />
                <Bar dataKey="admissions" radius={[0, 3, 3, 0]}>
                  {chartData.map((d, i) => (
                    <Cell key={i} fill={admissionColor(d.admissions)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Full filmography table */}
      <Card>
        <CardHeader className="pb-2 border-b">
          <CardTitle className="text-sm font-black uppercase tracking-[0.2em]">All Movies</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-auto max-h-[50vh]">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-background z-10 border-b">
                <tr className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/50">
                  <th className="p-3 text-left">Movie</th>
                  <th className="p-3 text-right">Year</th>
                  <th className="p-3 text-right">Admissions</th>
                  <th className="p-3 text-right">Score</th>
                  <th className="p-3 text-left">Genres</th>
                  <th className="p-3 text-right">Type</th>
                </tr>
              </thead>
              <tbody>
                {filmography.map((m) => (
                  <tr key={m.id} className="border-b last:border-0 hover:bg-muted/20">
                    <td className="p-3">
                      <Link href={`/competitors/cinepoint/movies/${m.id}`} className="font-bold hover:text-primary transition-colors">
                        {m.title}
                      </Link>
                    </td>
                    <td className="p-3 text-right font-mono text-muted-foreground">{m.release_year || '—'}</td>
                    <td className="p-3 text-right font-mono font-bold">
                      {m.total_admission > 0 ? (
                        <span className={classifyTier(m.total_admission) === 'mega_hit' ? 'text-emerald-600' : ''}>{formatAdm(m.total_admission)}</span>
                      ) : '—'}
                    </td>
                    <td className="p-3 text-right font-mono">{m.score > 0 ? m.score.toFixed(1) : '—'}</td>
                    <td className="p-3">
                      <div className="flex flex-wrap gap-1">
                        {m.genres.slice(0, 3).map((g) => (
                          <span key={g} className="text-[9px] px-1.5 py-0.5 rounded bg-muted/40 text-muted-foreground">{g}</span>
                        ))}
                      </div>
                    </td>
                    <td className="p-3 text-right">
                      <TypeBadge type={m.type} short />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
