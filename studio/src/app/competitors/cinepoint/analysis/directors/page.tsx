'use client';

import { useMemo, useState } from 'react';
import { Clapperboard } from 'lucide-react';
import { PageError } from '@/components/cinepoint/PageShell';
import { PersonPageSkeleton, SearchInput, TypeFilterBar, StatCard, PersonRankingsTable } from '@/components/cinepoint/SharedUi';
import {
  useAnalysisData,
  computePersonRankings,
  formatAdm,
  HIT_THRESHOLD,
  JUNK_DIRECTOR_NAMES,
} from '@/lib/cinepoint';
import type { AnalysisMovie } from '@/lib/cinepoint';

function buildDirectorRankings(movies: AnalysisMovie[], typeFilter: 'all' | 'local' | 'international') {
  const filtered = typeFilter === 'all'
    ? movies.filter((m) => m.total_admission > 0)
    : movies.filter((m) => m.total_admission > 0 && m.type === typeFilter);
  return computePersonRankings(
    filtered.map((m) => ({ ...m, directors: m.directors.filter((d) => !JUNK_DIRECTOR_NAMES.has(d) && d.length >= 2) })),
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
    return <PersonPageSkeleton icon={Clapperboard} iconClassName="bg-amber-500/10 border-amber-500/20" title="Director Database" message="Loading director performance data…" />;
  }

  if (error) {
    return <div className="px-6 py-8"><PageError error={error} /></div>;
  }

  const totalDirectors = rankings.length;
  const bankable = rankings.filter((r) => r.avg_admission >= HIT_THRESHOLD).length;

  return (
    <div className="px-6 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-500/10 flex items-center justify-center border border-amber-500/20">
            <Clapperboard className="w-5 h-5 text-amber-500" />
          </div>
          <div>
            <h1 className="text-base font-black uppercase tracking-tighter">Director Database</h1>
            <p className="text-sm text-muted-foreground/60 uppercase tracking-widest font-bold">
              {totalDirectors.toLocaleString()} directors (min 2 movies) · {bankable} bankable (avg ≥{formatAdm(HIT_THRESHOLD)})
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Total Directors" value={totalDirectors.toLocaleString()} />
        <StatCard label="Bankable" value={bankable} className="text-emerald-600" />
        <StatCard label="Top Avg" value={rankings[0] ? formatAdm(rankings[0].avg_admission) : '—'} sub={rankings[0]?.name} />
      </div>

      <div className="flex items-center gap-3">
        <SearchInput value={search} onChange={setSearch} placeholder="Search directors…" />
        <TypeFilterBar value={typeFilter} onChange={setTypeFilter} />
        <span className="text-sm text-muted-foreground/40 font-mono ml-auto">{filtered.length} results</span>
      </div>

      <PersonRankingsTable rankings={filtered} label="Director" />
    </div>
  );
}
