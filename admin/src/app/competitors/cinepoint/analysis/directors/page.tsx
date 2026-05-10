'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Clapperboard, ArrowLeft, Search, Eye,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import {
  useAnalysisData,
  computePersonRankings,
  formatAdm,
} from '@/lib/cinepoint';
import type { AnalysisMovie } from '@/lib/cinepoint';

function buildDirectorRankings(movies: AnalysisMovie[], typeFilter: 'all' | 'local' | 'international') {
  const filtered = typeFilter === 'all'
    ? movies.filter((m) => m.total_admission > 0)
    : movies.filter((m) => m.total_admission > 0 && m.type === typeFilter);
  // Filter junk director names
  const junkNames = new Set(['abc', 'dir']);
  return computePersonRankings(
    filtered.map((m) => ({ ...m, directors: m.directors.filter((d) => !junkNames.has(d) && d.length >= 2) })),
    'directors',
    2,
  );
}

export default function DirectorsPage() {
  const { movies, loading, error } = useAnalysisData();
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'local' | 'international'>('all');

  const rankings = useMemo(() => buildDirectorRankings(movies, typeFilter), [movies, typeFilter]);
  const filtered = search ? rankings.filter((r) => r.name.toLowerCase().includes(search.toLowerCase())) : rankings;

  if (loading) {
    return (
      <div className="min-h-screen">
        <div className="px-6 py-8 space-y-6 max-w-full mx-auto">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 flex items-center justify-center border border-amber-500/20">
              <Clapperboard className="w-5 h-5 text-amber-500 animate-pulse" />
            </div>
            <div>
              <h1 className="text-base font-black uppercase tracking-tighter">Director Database</h1>
              <p className="text-[10px] text-muted-foreground/60">Loading director performance data…</p>
            </div>
          </div>
          <div className="h-96 rounded-xl border border-border/20 animate-pulse bg-muted/10" />
        </div>
      </div>
    );
  }

  const totalDirectors = rankings.length;
  const bankable = rankings.filter((r) => r.avg_admission >= 500_000).length;

  return (
    <div className="px-6 py-8 space-y-6 max-w-full mx-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/competitors/cinepoint/analysis" className="w-9 h-9 rounded-xl border border-border/40 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div className="w-9 h-9 rounded-xl bg-amber-500/10 flex items-center justify-center border border-amber-500/20">
            <Clapperboard className="w-5 h-5 text-amber-500" />
          </div>
          <div>
            <h1 className="text-base font-black uppercase tracking-tighter">Director Database</h1>
            <p className="text-[10px] text-muted-foreground/60 uppercase tracking-widest font-bold">
              {totalDirectors.toLocaleString()} directors (min 2 movies) · {bankable} bankable (avg ≥500K)
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="px-4 py-3 rounded-xl border border-border/30 bg-card">
          <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/50">Total Directors</p>
          <p className="text-xl font-black">{totalDirectors.toLocaleString()}</p>
        </div>
        <div className="px-4 py-3 rounded-xl border border-border/30 bg-card">
          <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/50">Bankable</p>
          <p className="text-xl font-black text-emerald-600">{bankable}</p>
        </div>
        <div className="px-4 py-3 rounded-xl border border-border/30 bg-card">
          <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/50">Top Avg</p>
          <p className="text-xl font-black">{rankings[0] ? formatAdm(rankings[0].avg_admission) : '—'}</p>
          <p className="text-[10px] text-muted-foreground truncate">{rankings[0]?.name}</p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/40" />
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search directors…"
            className="w-full pl-9 pr-3 py-2 rounded-lg border border-border/40 bg-muted/5 text-xs focus:outline-none focus:border-primary/40" />
        </div>
        <div className="flex gap-1">
          {(['all', 'local', 'international'] as const).map((t) => (
            <button key={t} onClick={() => setTypeFilter(t)}
              className={cn('px-3 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all',
                typeFilter === t ? 'bg-primary text-primary-foreground' : 'bg-muted/30 text-muted-foreground hover:bg-muted/50')}>
              {t === 'all' ? 'All' : t === 'local' ? 'Local' : 'International'}
            </button>
          ))}
        </div>
        <span className="text-[10px] text-muted-foreground/40 font-mono ml-auto">{filtered.length} results</span>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-auto max-h-[70vh]">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-background z-10 border-b">
                <tr className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/50">
                  <th className="p-3 text-left w-10">#</th>
                  <th className="p-3 text-left">Director</th>
                  <th className="p-3 text-right">Movies</th>
                  <th className="p-3 text-right">Avg Admissions</th>
                  <th className="p-3 text-right">Median</th>
                  <th className="p-3 text-right">Hit Rate</th>
                  <th className="p-3 text-right">Total</th>
                  <th className="p-3 text-left">Best Movie</th>
                  <th className="p-3 text-center w-28" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((p, i) => (
                  <tr key={p.name} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                    <td className="p-3 text-muted-foreground/30 font-mono">{i + 1}</td>
                    <td className="p-3 font-bold">{p.name}</td>
                    <td className="p-3 text-right font-mono text-muted-foreground">{p.movie_count}</td>
                    <td className="p-3 text-right font-mono font-bold">{formatAdm(p.avg_admission)}</td>
                    <td className="p-3 text-right font-mono text-muted-foreground">{formatAdm(p.median_admission)}</td>
                    <td className="p-3 text-right">
                      <span className={cn('font-mono font-bold', p.hit_rate >= 30 ? 'text-emerald-600' : p.hit_rate >= 15 ? 'text-amber-600' : 'text-muted-foreground')}>{p.hit_rate}%</span>
                    </td>
                    <td className="p-3 text-right font-mono text-muted-foreground">{formatAdm(p.total_admission)}</td>
                    <td className="p-3">
                      {p.best_movie && (
                        <Link href={`/competitors/cinepoint/movies/${p.best_movie.id}`} className="text-[10px] text-primary hover:underline truncate block max-w-[200px]">
                          {p.best_movie.title} <span className="text-muted-foreground ml-1 font-mono">({formatAdm(p.best_movie.total_admission)})</span>
                        </Link>
                      )}
                    </td>
                    <td className="p-3 text-center">
                      <button
                        onClick={() => { window.location.href = `/competitors/cinepoint/analysis/person/${encodeURIComponent(p.name)}`; }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border/40 bg-muted/30 text-[10px] font-bold uppercase tracking-wider text-muted-foreground hover:bg-primary hover:text-primary-foreground hover:border-primary transition-all cursor-pointer"
                      >
                        <Eye className="w-3 h-3" />
                        View Details
                      </button>
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
