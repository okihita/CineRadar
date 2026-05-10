'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Loader2, BarChart3, Film, Star, Users,
  Trophy, TrendingUp, Clapperboard, Sparkles, Target, Filter,
  Globe, Clock, Eye, SlidersHorizontal,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  useAnalysisData,
  formatAdm,
  TIER_COLORS,
  TIER_LABELS,
  TIER_KEYS,
  computeStats,
  computeGenreStats,
  computePersonRankings,
  computeLanguageStats,
  computeRatingStats,
  computeDurationBuckets,
  computeGenreCombos,
} from '@/lib/cinepoint';
import type { AnalysisMovie, FactorState } from '@/lib/cinepoint';

import { FilterPanel } from './_components/FilterPanel';
import { KpiRow } from './_components/KpiRow';
import { TierBar } from './_components/TierBar';
import { GenreSection } from './_components/GenreSection';
import { StarPower } from './_components/StarPower';
import { MarketSignals } from './_components/MarketSignals';
import { DeepDive } from './_components/DeepDive';

const FACTOR_CONFIG = [
  { key: 'genre' as const, label: 'Genre', icon: Film },
  { key: 'director' as const, label: 'Director', icon: Clapperboard },
  { key: 'actor' as const, label: 'Actor', icon: Star },
  { key: 'language' as const, label: 'Language', icon: Globe },
  { key: 'duration' as const, label: 'Duration', icon: Clock },
  { key: 'rating' as const, label: 'Age Rating', icon: Eye },
];

export default function CinePointAnalysisPage() {
  const { movies, loading } = useAnalysisData();

  // Filters
  const [factors, setFactors] = useState<FactorState>({
    genre: true, director: true, actor: true, language: true, duration: true, rating: true,
  });
  const [typeFilter, setTypeFilter] = useState<'all' | 'local' | 'international'>('all');
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [yearRangeFilter, setYearRangeFilter] = useState<[number, number]>([0, 0]);
  const [showFilters, setShowFilters] = useState(true);

  // Deep dive
  const [deepDiveQuery, setDeepDiveQuery] = useState('');
  const [deepDiveMovie, setDeepDiveMovie] = useState<AnalysisMovie | null>(null);

  // Animated tier bars
  const [tierAnimated, setTierAnimated] = useState(false);

  // Trigger tier bar animation after load
  const allGenres = useMemo(() => {
    const set = new Set<string>();
    for (const m of movies) for (const g of m.genres) set.add(g);
    return [...set].sort();
  }, [movies]);

  // Get year range
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

  // Trigger tier bar animation after load
  useMemo(() => {
    if (!loading) setTimeout(() => setTierAnimated(true), 50);
  }, [loading]);

  // ── Loading state ──
  if (loading) {
    return (
      <div className="min-h-screen">
        <div className="px-6 py-8 space-y-6 max-w-[1600px] mx-auto">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/20">
              <Target className="w-5 h-5 text-primary animate-pulse" />
            </div>
            <div>
              <h1 className="text-base font-black uppercase tracking-tighter">Success Predictor</h1>
              <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold opacity-60">Loading analysis data…</p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <SkeletonCard title="Genre Impact" subtitle="Which genres generate the most ticket sales?" />
            <SkeletonCard title="Star Power" subtitle="Do bankable directors guarantee a hit?" />
            <SkeletonCard title="Market Signals" subtitle="Language, duration, and age rating correlations" />
          </div>
          <div className="grid grid-cols-5 gap-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-24 rounded-xl border border-border/20 animate-pulse bg-muted/20" />
            ))}
          </div>
          <div className="h-80 rounded-xl border border-border/20 animate-pulse bg-muted/10" />
          <p className="text-center text-xs text-muted-foreground/40 font-medium">Analyzing {movies.length > 0 ? movies.length : '3,963'} movies…</p>
        </div>
      </div>
    );
  }

  // ── Loaded state ──
  return (
    <div className="px-6 py-8 space-y-6 max-w-[1600px] mx-auto">
      {/* Header + Filter Toggle */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/20">
            <Target className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-base font-black uppercase tracking-tighter">Success Predictor</h1>
            <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold opacity-60">
              {overview.total_movies.toLocaleString()} movies · {overview.with_admissions.toLocaleString()} with admissions
            </p>
          </div>
        </div>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={cn(
            'flex items-center gap-2 px-3 py-2 rounded-lg border text-[10px] font-bold uppercase tracking-wider transition-all',
            showFilters ? 'bg-primary/10 border-primary/20 text-primary' : 'border-border/40 text-muted-foreground hover:bg-muted',
          )}
        >
          <SlidersHorizontal className="w-3.5 h-3.5" />
          Filters
        </button>
      </div>

      {/* Filter Panel */}
      {showFilters && (
        <FilterPanel
          factors={factors} factorConfig={FACTOR_CONFIG} toggleFactor={toggleFactor}
          typeFilter={typeFilter} setTypeFilter={setTypeFilter}
          selectedGenres={selectedGenres} setSelectedGenres={setSelectedGenres} allGenres={allGenres}
          yearRangeFilter={yearRangeFilter} setYearRangeFilter={setYearRangeFilter}
          yearMin={yearMin} yearMax={yearMax}
          moviesCount={movies.length} filteredCount={filtered.length}
        />
      )}

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
            <p className="text-xs text-muted-foreground/50 mt-1">Try adjusting the type, genre, or year range filters</p>
            <button
              onClick={() => { setTypeFilter('all'); setSelectedGenres([]); setYearRangeFilter([0, 0]); }}
              className="mt-3 text-[10px] font-bold text-primary hover:underline"
            >
              Reset all filters
            </button>
          </CardContent>
        </Card>
      )}

      {/* Analysis sections */}
      {filtered.length > 0 && (
        <>
          <GenreSection factors={factors} genreStats={genreStats} genreCombos={genreCombos} />
          <StarPower factors={factors} directorRankings={directorRankings} actorRankings={actorRankings} />
          <MarketSignals factors={factors} languageStats={languageStats} ratingStats={ratingStats} durationBuckets={durationBuckets} />
        </>
      )}

      {/* Deep Dive */}
      <DeepDive movies={movies} filtered={filtered} query={deepDiveQuery} setQuery={setDeepDiveQuery} selectedMovie={deepDiveMovie} setSelectedMovie={setDeepDiveMovie} />
    </div>
  );
}

function SkeletonCard({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <Card className="border-dashed">
      <CardContent className="py-4">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-5 h-5 rounded bg-muted/40 animate-pulse" />
          <div className="h-4 w-24 bg-muted/30 rounded animate-pulse" />
        </div>
        <p className="text-xs font-bold text-muted-foreground/60">{title}</p>
        <p className="text-[10px] text-muted-foreground/30">{subtitle}</p>
      </CardContent>
    </Card>
  );
}
