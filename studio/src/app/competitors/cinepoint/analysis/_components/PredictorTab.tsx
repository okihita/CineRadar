'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Film, Star,
  Clapperboard, Filter,
  Globe, Clock, Eye,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { CinePointErrorBoundary } from '@/components/cinepoint/ErrorBoundary';
import {
  computeStats,
  computeGenreStats,
  computePersonRankings,
  computeLanguageStats,
  computeRatingStats,
  computeDurationBuckets,
  computeGenreCombos,
} from '@/lib/cinepoint';
import type { AnalysisMovie, FactorState } from '@/lib/cinepoint';

import { FilterPanel } from './FilterPanel';
import { KpiRow } from './KpiRow';
import { TierBar } from './TierBar';
import { GenreSection } from './GenreSection';
import { StarPower } from './StarPower';
import { MarketSignals } from './MarketSignals';
import { DeepDive } from './DeepDive';

const FACTOR_CONFIG = [
  { key: 'genre' as const, label: 'Genre', icon: Film },
  { key: 'director' as const, label: 'Director', icon: Clapperboard },
  { key: 'actor' as const, label: 'Actor', icon: Star },
  { key: 'language' as const, label: 'Language', icon: Globe },
  { key: 'duration' as const, label: 'Duration', icon: Clock },
  { key: 'rating' as const, label: 'Age Rating', icon: Eye },
];

export function PredictorTab({ movies }: { movies: AnalysisMovie[] }) {
  // Filters
  const [factors, setFactors] = useState<FactorState>({
    genre: true, director: true, actor: true, language: true, duration: true, rating: true,
  });
  const [typeFilter, setTypeFilter] = useState<'all' | 'local' | 'international'>('all');
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [yearRangeFilter, setYearRangeFilter] = useState<[number, number]>([0, 0]);

  // Deep dive
  const [deepDiveQuery, setDeepDiveQuery] = useState('');
  const [deepDiveMovie, setDeepDiveMovie] = useState<AnalysisMovie | null>(null);

  // Animated tier bars
  const [tierAnimated, setTierAnimated] = useState(false);

  const allGenres = useMemo(() => {
    const set = new Set<string>();
    for (const m of movies) for (const g of m.genres) set.add(g);
    return [...set].sort();
  }, [movies]);

  const [yearMin, yearMax] = useMemo(() => {
    const years = movies.map((m) => m.release_year).filter((y) => y > 0);
    return years.length ? [Math.min(...years), Math.max(...years)] : [2020, 2026];
  }, [movies]);

  // Apply filters to get working set
  const filtered = useMemo(() => {
    let result = movies;
    if (typeFilter === 'local') result = result.filter((m) => m.type === 'local');
    else if (typeFilter === 'international') result = result.filter((m) => m.type === 'international');
    if (selectedGenres.length > 0) {
      result = result.filter((m) => selectedGenres.some((g) => m.genres.includes(g)));
    }
    if (yearRangeFilter[0] > 0) result = result.filter((m) => m.release_year >= yearRangeFilter[0]);
    if (yearRangeFilter[1] > 0) result = result.filter((m) => m.release_year <= yearRangeFilter[1]);
    return result;
  }, [movies, typeFilter, selectedGenres, yearRangeFilter]);

  // Compute all stats from filtered set
  const overview = useMemo(() => computeStats(filtered), [filtered]);
  const genreStats = useMemo(() => computeGenreStats(filtered), [filtered]);
  const directorRankings = useMemo(() => computePersonRankings(filtered, 'directors', 3), [filtered]);
  const actorRankings = useMemo(() => computePersonRankings(filtered, 'actors', 5), [filtered]);
  const languageStats = useMemo(() => computeLanguageStats(filtered), [filtered]);
  const ratingStats = useMemo(() => computeRatingStats(filtered), [filtered]);
  const durationBuckets = useMemo(() => computeDurationBuckets(filtered), [filtered]);
  const genreCombos = useMemo(() => computeGenreCombos(filtered), [filtered]);

  const toggleFactor = (key: keyof FactorState) => {
    setFactors((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  useEffect(() => {
    const t = setTimeout(() => setTierAnimated(true), 50);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="space-y-6">
      {/* Filter Panel */}
      <FilterPanel
        factors={factors} factorConfig={FACTOR_CONFIG} toggleFactor={toggleFactor}
        typeFilter={typeFilter} setTypeFilter={setTypeFilter}
        selectedGenres={selectedGenres} setSelectedGenres={setSelectedGenres}
        allGenres={allGenres}
        yearRangeFilter={yearRangeFilter} setYearRangeFilter={setYearRangeFilter}
        yearMin={yearMin} yearMax={yearMax}
        moviesCount={movies.length} filteredCount={filtered.length}
      />

      {/* KPIs */}
      <KpiRow overview={overview} />

      {/* Tier Bar */}
      <TierBar overview={overview} animated={tierAnimated} />

      {/* Empty State */}
      {filtered.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <Filter className="w-8 h-8 text-muted-foreground/20 mx-auto mb-3" />
            <p className="text-sm font-bold text-muted-foreground">No movies match your filters</p>
            <p className="text-sm text-muted-foreground/50 mt-1">Try adjusting the type, genre, or year range filters</p>
            <button
              onClick={() => { setTypeFilter('all'); setSelectedGenres([]); setYearRangeFilter([0, 0]); }}
              className="mt-3 text-sm font-bold text-primary hover:underline"
            >
              Reset all filters
            </button>
          </CardContent>
        </Card>
      )}

      {/* Analysis sections */}
      {filtered.length > 0 && (
        <CinePointErrorBoundary>
          <GenreSection factors={factors} genreStats={genreStats} genreCombos={genreCombos} />
          <StarPower factors={factors} directorRankings={directorRankings} actorRankings={actorRankings} />
          <MarketSignals factors={factors} languageStats={languageStats} ratingStats={ratingStats} durationBuckets={durationBuckets} />
        </CinePointErrorBoundary>
      )}

      {/* Deep Dive */}
      <DeepDive movies={movies} overallAvg={overview.avg_admission} query={deepDiveQuery} setQuery={setDeepDiveQuery} selectedMovie={deepDiveMovie} setSelectedMovie={setDeepDiveMovie}
        genreStats={genreStats} languageStats={languageStats} durationBuckets={durationBuckets} />
    </div>
  );
}
