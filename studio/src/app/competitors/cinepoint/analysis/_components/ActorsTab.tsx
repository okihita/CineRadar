'use client';

import { useMemo, useState } from 'react';
import { SearchInput, TypeFilterBar, StatCard, PersonRankingsTable } from '@/components/cinepoint/SharedUi';
import {
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

export function ActorsTab({ movies }: { movies: AnalysisMovie[] }) {
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'local' | 'international'>('all');

  const rankings = useMemo(() => buildActorRankings(movies, typeFilter), [movies, typeFilter]);
  const filtered = search ? rankings.filter((r) => r.name.toLowerCase().includes(search.toLowerCase())) : rankings;

  const totalActors = rankings.length;
  const bankable = rankings.filter((r) => r.avg_admission >= HIT_THRESHOLD).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-foreground">Actor Power Rankings</h3>
          <p className="text-sm text-muted-foreground/60 uppercase tracking-widest font-bold">
            {totalActors.toLocaleString()} actors (min 3 movies) · {bankable} bankable (avg ≥{formatAdm(HIT_THRESHOLD)})
          </p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Total Actors" value={totalActors.toLocaleString()} />
        <StatCard label="Bankable Stars" value={bankable.toLocaleString()} sub={`Avg ≥${formatAdm(HIT_THRESHOLD)}`} />
        <StatCard label="Filtered Results" value={filtered.length.toLocaleString()} />
      </div>

      <div className="flex items-center justify-between gap-4">
        <TypeFilterBar value={typeFilter} onChange={setTypeFilter} />
        <SearchInput value={search} onChange={setSearch} placeholder="Search actors…" />
      </div>

      <PersonRankingsTable rankings={filtered} label="Actor" />
    </div>
  );
}
