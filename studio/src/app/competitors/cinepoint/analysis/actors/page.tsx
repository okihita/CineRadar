'use client';

import { useMemo, useState } from 'react';
import { Star } from 'lucide-react';
import { PageError } from '@/components/cinepoint/PageShell';
import { PersonPageSkeleton, SearchInput, TypeFilterBar, StatCard, PersonRankingsTable } from '@/components/cinepoint/SharedUi';
import {
  useAnalysisData,
  computePersonRankings,
  formatAdm,
  HIT_THRESHOLD,
} from '@/lib/cinepoint';
import type { AnalysisMovie } from '@/lib/cinepoint';

function buildActorRankings(movies: AnalysisMovie[], typeFilter: 'all' | 'local' | 'international') {
  const filtered = typeFilter === 'all'
    ? movies.filter((m) => m.total_admission > 0)
    : movies.filter((m) => m.total_admission > 0 && m.type === typeFilter);
  return computePersonRankings(filtered, 'actors', 3);
}

export default function ActorsPage() {
  const { movies, loading, error } = useAnalysisData();
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'local' | 'international'>('all');

  const rankings = useMemo(() => buildActorRankings(movies, typeFilter), [movies, typeFilter]);
  const filtered = search ? rankings.filter((r) => r.name.toLowerCase().includes(search.toLowerCase())) : rankings;

  if (loading) {
    return <PersonPageSkeleton icon={Star} iconClassName="bg-indigo-500/10 border-indigo-500/20" title="Actor Database" message="Loading actor performance data…" />;
  }

  if (error) {
    return <div className="px-6 py-8"><PageError error={error} /></div>;
  }

  const totalActors = rankings.length;
  const bankable = rankings.filter((r) => r.avg_admission >= HIT_THRESHOLD).length;

  return (
    <div className="px-6 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-indigo-500/10 flex items-center justify-center border border-indigo-500/20">
            <Star className="w-5 h-5 text-indigo-500" />
          </div>
          <div>
            <h1 className="text-base font-black uppercase tracking-tighter">Actor Database</h1>
            <p className="text-sm text-muted-foreground/60 uppercase tracking-widest font-bold">
              {totalActors.toLocaleString()} actors (min 3 movies) · {bankable} bankable (avg ≥{formatAdm(HIT_THRESHOLD)})
            </p>
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Total Actors" value={totalActors.toLocaleString()} />
        <StatCard label="Bankable Stars" value={bankable} className="text-emerald-600" />
        <StatCard label="Top Avg" value={rankings[0] ? formatAdm(rankings[0].avg_admission) : '—'} sub={rankings[0]?.name} />
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <SearchInput value={search} onChange={setSearch} placeholder="Search actors…" />
        <TypeFilterBar value={typeFilter} onChange={setTypeFilter} />
        <span className="text-sm text-muted-foreground/40 font-mono ml-auto">{filtered.length} results</span>
      </div>

      {/* Table */}
      <PersonRankingsTable rankings={filtered} label="Actor" />
    </div>
  );
}
