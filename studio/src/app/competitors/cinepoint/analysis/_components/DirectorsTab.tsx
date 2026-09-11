'use client';

import { useMemo, useState } from 'react';
import { SearchInput, TypeFilterBar, StatCard, PersonRankingsTable } from '@/components/cinepoint/SharedUi';
import {
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

export function DirectorsTab({ movies }: { movies: AnalysisMovie[] }) {
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'local' | 'international'>('all');

  const rankings = useMemo(() => buildDirectorRankings(movies, typeFilter), [movies, typeFilter]);
  const filtered = search ? rankings.filter((r) => r.name.toLowerCase().includes(search.toLowerCase())) : rankings;

  const totalDirectors = rankings.length;
  const bankable = rankings.filter((r) => r.avg_admission >= HIT_THRESHOLD).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-foreground">Director Performance Database</h3>
          <p className="text-sm text-muted-foreground/60 uppercase tracking-widest font-bold">
            {totalDirectors.toLocaleString()} directors (min 2 movies) · {bankable} bankable (avg ≥{formatAdm(HIT_THRESHOLD)})
          </p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Total Directors" value={totalDirectors.toLocaleString()} />
        <StatCard label="Bankable Directors" value={bankable.toLocaleString()} sub={`Avg ≥${formatAdm(HIT_THRESHOLD)}`} />
        <StatCard label="Filtered Results" value={filtered.length.toLocaleString()} />
      </div>

      <div className="flex items-center justify-between gap-4">
        <TypeFilterBar value={typeFilter} onChange={setTypeFilter} />
        <SearchInput value={search} onChange={setSearch} placeholder="Search directors…" />
      </div>

      <PersonRankingsTable rankings={filtered} label="Director" />
    </div>
  );
}
