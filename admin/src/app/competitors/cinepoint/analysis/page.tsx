'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from 'recharts';
import {
  Loader2, BarChart3, Film, Star, Users,
  Trophy, TrendingUp, ChevronRight,
  Clapperboard, Sparkles, Target, Filter,
  Globe, Clock, Eye, SlidersHorizontal, Search,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

// ─── Types ─────────────────────────────────────────────────

interface AnalysisMovie {
  id: number;
  title: string;
  type: string;
  language: string;
  genres: string[];
  duration: number;
  total_admission: number;
  score: number;
  rating_category: string[];
  directors: string[];
  actors: string[];
  release_year: number;
}

interface FactorState {
  genre: boolean;
  director: boolean;
  actor: boolean;
  language: boolean;
  duration: boolean;
  rating: boolean;
}

interface FilterState {
  factors: FactorState;
  typeFilter: 'all' | 'local' | 'international';
  selectedGenres: string[];
  yearRange: [number, number]; // [min, max] — 0 means no filter
}

// ─── Constants ─────────────────────────────────────────────

const TIER_COLORS: Record<string, string> = {
  mega_hit: '#10b981', hit: '#6366f1', moderate: '#f59e0b', niche: '#94a3b8', flop: '#f87171',
};
const TIER_LABELS: Record<string, string> = {
  mega_hit: 'Mega Hit (≥1M)', hit: 'Hit (500K–1M)', moderate: 'Moderate (100K–500K)', niche: 'Niche (10K–100K)', flop: 'Flop (<10K)',
};
const TIER_KEYS = ['mega_hit', 'hit', 'moderate', 'niche', 'flop'] as const;

const FACTOR_CONFIG = [
  { key: 'genre' as const, label: 'Genre', icon: Film },
  { key: 'director' as const, label: 'Director', icon: Clapperboard },
  { key: 'actor' as const, label: 'Actor', icon: Star },
  { key: 'language' as const, label: 'Language', icon: Globe },
  { key: 'duration' as const, label: 'Duration', icon: Clock },
  { key: 'rating' as const, label: 'Age Rating', icon: Eye },
];

function formatAdm(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return n.toLocaleString();
}

function median(values: number[]): number {
  if (!values.length) return 0;
  const s = [...values].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function classifyTier(a: number): string {
  if (a >= 1_000_000) return 'mega_hit';
  if (a >= 500_000) return 'hit';
  if (a >= 100_000) return 'moderate';
  if (a >= 10_000) return 'niche';
  return 'flop';
}

// ─── Computation Functions ─────────────────────────────────

function computeStats(movies: AnalysisMovie[]) {
  const withAdm = movies.filter((m) => m.total_admission > 0);
  const admissions = withAdm.map((m) => m.total_admission);
  const total = admissions.reduce((s, v) => s + v, 0);

  const tiers: Record<string, number> = { mega_hit: 0, hit: 0, moderate: 0, niche: 0, flop: 0 };
  for (const a of admissions) tiers[classifyTier(a)]++;

  return {
    total_movies: movies.length,
    with_admissions: withAdm.length,
    total_admissions: total,
    avg_admission: withAdm.length ? Math.round(total / withAdm.length) : 0,
    median_admission: Math.round(median(admissions)),
    tiers,
  };
}

function computeGenreStats(movies: AnalysisMovie[]) {
  const map = new Map<string, { admissions: number[]; scores: number[]; total_count: number }>();
  const withAdm = movies.filter((m) => m.total_admission > 0);

  for (const m of movies) {
    for (const g of m.genres) {
      if (!map.has(g)) map.set(g, { admissions: [], scores: [], total_count: 0 });
      map.get(g)!.total_count++;
    }
  }
  for (const m of withAdm) {
    for (const g of m.genres) {
      if (!map.has(g)) map.set(g, { admissions: [], scores: [], total_count: 0 });
      map.get(g)!.admissions.push(m.total_admission);
      if (m.score > 0) map.get(g)!.scores.push(m.score);
    }
  }

  return [...map.entries()]
    .map(([genre, d]) => ({
      genre,
      count: d.total_count,
      with_admissions: d.admissions.length,
      avg_admission: d.admissions.length ? Math.round(d.admissions.reduce((s, v) => s + v, 0) / d.admissions.length) : 0,
      median_admission: Math.round(median(d.admissions)),
      hit_rate_pct: d.admissions.length ? Math.round((d.admissions.filter((v) => v >= 500_000).length / d.admissions.length) * 1000) / 10 : 0,
      avg_score: d.scores.length ? Math.round((d.scores.reduce((s, v) => s + v, 0) / d.scores.length) * 10) / 10 : 0,
      total_admission: d.admissions.reduce((s, v) => s + v, 0),
    }))
    .sort((a, b) => b.avg_admission - a.avg_admission);
}

function computePersonRankings(movies: AnalysisMovie[], role: 'directors' | 'actors', minMovies: number) {
  const map = new Map<string, { id: number; title: string; total_admission: number }[]>();
  const withAdm = movies.filter((m) => m.total_admission > 0);

  for (const m of withAdm) {
    for (const name of m[role]) {
      if (!map.has(name)) map.set(name, []);
      map.get(name)!.push({ id: m.id, title: m.title, total_admission: m.total_admission });
    }
  }

  return [...map.entries()]
    .filter(([, ms]) => ms.length >= minMovies)
    .map(([name, ms]) => {
      const adm = ms.map((m) => m.total_admission);
      const best = ms.reduce((a, b) => a.total_admission > b.total_admission ? a : b);
      return {
        name,
        movie_count: ms.length,
        avg_admission: Math.round(adm.reduce((s, v) => s + v, 0) / adm.length),
        median_admission: Math.round(median(adm)),
        total_admission: adm.reduce((s, v) => s + v, 0),
        best_movie: best,
      };
    })
    .sort((a, b) => b.avg_admission - a.avg_admission)
    .slice(0, 50);
}

function computeLanguageStats(movies: AnalysisMovie[]) {
  const map = new Map<string, AnalysisMovie[]>();
  for (const m of movies) {
    if (!m.language) continue;
    if (!map.has(m.language)) map.set(m.language, []);
    map.get(m.language)!.push(m);
  }
  return Object.fromEntries(
    [...map.entries()].map(([lang, ms]) => {
      const withAdm = ms.filter((m) => m.total_admission > 0);
      const adm = withAdm.map((m) => m.total_admission);
      // Top genres
      const gMap = new Map<string, { count: number; admissions: number[] }>();
      for (const m of withAdm) {
        for (const g of m.genres) {
          if (!gMap.has(g)) gMap.set(g, { count: 0, admissions: [] });
          gMap.get(g)!.count++;
          gMap.get(g)!.admissions.push(m.total_admission);
        }
      }
      const top_genres = [...gMap.entries()]
        .map(([genre, d]) => ({
          genre,
          count: d.count,
          avg_admission: d.admissions.length ? Math.round(d.admissions.reduce((s, v) => s + v, 0) / d.admissions.length) : 0,
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 8);
      return [lang, {
        count: ms.length,
        with_admissions: withAdm.length,
        avg_admission: adm.length ? Math.round(adm.reduce((s, v) => s + v, 0) / adm.length) : 0,
        median_admission: Math.round(median(adm)),
        total_admission: adm.reduce((s, v) => s + v, 0),
        hit_rate_pct: adm.length ? Math.round((adm.filter((v) => v >= 500_000).length / adm.length) * 1000) / 10 : 0,
        top_genres,
      }];
    })
  );
}

function computeRatingStats(movies: AnalysisMovie[]) {
  const map = new Map<string, number[]>();
  for (const m of movies.filter((m) => m.total_admission > 0)) {
    for (const r of m.rating_category) {
      if (!r || r === 'N/A') continue;
      if (!map.has(r)) map.set(r, []);
      map.get(r)!.push(m.total_admission);
    }
  }
  return [...map.entries()]
    .map(([rating, admissions]) => ({
      rating,
      count: admissions.length,
      avg_admission: Math.round(admissions.reduce((s, v) => s + v, 0) / admissions.length),
      median_admission: Math.round(median(admissions)),
    }))
    .sort((a, b) => b.avg_admission - a.avg_admission);
}

function computeDurationBuckets(movies: AnalysisMovie[]) {
  const buckets = [
    { range: '< 80 min', min: 0, max: 80 },
    { range: '80–100', min: 80, max: 100 },
    { range: '100–120', min: 100, max: 120 },
    { range: '120–140', min: 120, max: 140 },
    { range: '140+', min: 140, max: 999 },
  ];
  return buckets.map((b) => {
    const matching = movies.filter((m) => m.total_admission > 0 && m.duration >= b.min && m.duration < b.max);
    const adm = matching.map((m) => m.total_admission);
    return {
      range: b.range,
      count: matching.length,
      avg_admission: adm.length ? Math.round(adm.reduce((s, v) => s + v, 0) / adm.length) : 0,
      median_admission: Math.round(median(adm)),
    };
  });
}

function computeGenreCombos(movies: AnalysisMovie[]) {
  const map = new Map<string, { genres: string[]; admissions: number[] }>();
  for (const m of movies.filter((m) => m.total_admission > 0 && m.genres.length >= 2)) {
    const sorted = [...m.genres].sort();
    const key = sorted.join(' + ');
    if (!map.has(key)) map.set(key, { genres: sorted, admissions: [] });
    map.get(key)!.admissions.push(m.total_admission);
  }
  return [...map.entries()]
    .filter(([, d]) => d.admissions.length >= 10)
    .map(([combo, d]) => ({
      combo,
      genres: d.genres,
      count: d.admissions.length,
      avg_admission: Math.round(d.admissions.reduce((s, v) => s + v, 0) / d.admissions.length),
    }))
    .sort((a, b) => b.avg_admission - a.avg_admission)
    .slice(0, 20);
}

// ─── Page ──────────────────────────────────────────────────

export default function CinePointAnalysisPage() {
  const [movies, setMovies] = useState<AnalysisMovie[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadProgress, setLoadProgress] = useState('');

  // Filters
  const [factors, setFactors] = useState<FactorState>({
    genre: true, director: true, actor: true, language: true, duration: true, rating: true,
  });
  const [typeFilter, setTypeFilter] = useState<'all' | 'local' | 'international'>('all');
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [yearRangeFilter, setYearRangeFilter] = useState<[number, number]>([0, 0]); // 0 = no filter
  const [showFilters, setShowFilters] = useState(true);

  // Deep dive
  const [deepDiveQuery, setDeepDiveQuery] = useState('');
  const [deepDiveMovie, setDeepDiveMovie] = useState<AnalysisMovie | null>(null);

  // Animated tier bars
  const [tierAnimated, setTierAnimated] = useState(false);

  // Fetch raw data
  useEffect(() => {
    setLoadProgress('Fetching movie data from Firestore…');
    const t0 = Date.now();
    fetch('/api/competitors/cinepoint/analysis')
      .then(async (r) => {
        setLoadProgress('Parsing response…');
        const json = await r.json();
        if (json.success) {
          setMovies(json.data);
          const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
          setLoadProgress(`Loaded ${json.count} movies in ${elapsed}s`);
        }
      })
      .catch(() => setLoadProgress('Failed to load data'))
      .finally(() => setLoading(false));
  }, []);

  // Trigger tier bar animation after load
  useEffect(() => {
    if (!loading) {
      const t = setTimeout(() => setTierAnimated(true), 50);
      return () => clearTimeout(t);
    }
  }, [loading]);

  // Get all available genres
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
    if (yearRangeFilter[0] > 0) {
      result = result.filter((m) => m.release_year >= yearRangeFilter[0]);
    }
    if (yearRangeFilter[1] > 0) {
      result = result.filter((m) => m.release_year <= yearRangeFilter[1]);
    }
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

  // Deep dive: search results
  const deepDiveResults = useMemo(() => {
    if (!deepDiveQuery.trim()) return [];
    const q = deepDiveQuery.toLowerCase().trim();
    return movies
      .filter((m) => m.title.toLowerCase().includes(q))
      .slice(0, 8);
  }, [movies, deepDiveQuery]);

  // Deep dive: comparison profile
  const deepDiveProfile = useMemo(() => {
    if (!deepDiveMovie) return null;
    const m = deepDiveMovie;
    const withAdm = filtered.filter((f) => f.total_admission > 0);
    const overallAvg = withAdm.length ? Math.round(withAdm.reduce((s, f) => s + f.total_admission, 0) / withAdm.length) : 0;
    const overallMedian = Math.round(median(withAdm.map((f) => f.total_admission)));

    // Genre averages
    const genreAvgs: Record<string, number> = {};
    for (const g of m.genres) {
      const gMovies = withAdm.filter((f) => f.genres.includes(g));
      genreAvgs[g] = gMovies.length ? Math.round(gMovies.reduce((s, f) => s + f.total_admission, 0) / gMovies.length) : 0;
    }

    // Language average
    const langMovies = withAdm.filter((f) => f.language === m.language);
    const langAvg = langMovies.length ? Math.round(langMovies.reduce((s, f) => s + f.total_admission, 0) / langMovies.length) : 0;

    // Duration bucket average
    const durBucket = m.duration < 80 ? '<80' : m.duration < 100 ? '80-100' : m.duration < 120 ? '100-120' : m.duration < 140 ? '120-140' : '140+';
    const durMovies = withAdm.filter((f) => {
      if (durBucket === '<80') return f.duration < 80;
      if (durBucket === '80-100') return f.duration >= 80 && f.duration < 100;
      if (durBucket === '100-120') return f.duration >= 100 && f.duration < 120;
      if (durBucket === '120-140') return f.duration >= 120 && f.duration < 140;
      return f.duration >= 140;
    });
    const durAvg = durMovies.length ? Math.round(durMovies.reduce((s, f) => s + f.total_admission, 0) / durMovies.length) : 0;

    return {
      movie: m,
      tier: classifyTier(m.total_admission),
      overallAvg,
      overallMedian,
      genreAvgs,
      langAvg,
      durAvg,
      durBucket,
      vsOverall: m.total_admission > 0 ? { value: m.total_admission, avg: overallAvg, delta: m.total_admission - overallAvg } : null,
      vsLanguage: m.total_admission > 0 ? { value: m.total_admission, avg: langAvg, label: m.language } : null,
      vsDuration: m.total_admission > 0 ? { value: m.total_admission, avg: durAvg, label: `${durBucket} min` } : null,
    };
  }, [deepDiveMovie, filtered]);

  const toggleFactor = (key: keyof FactorState) => {
    setFactors((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // ── Loading state with skeleton ──
  if (loading) {
    return (
      <div className="min-h-screen">
        <div className="px-6 py-8 space-y-6 max-w-[1600px] mx-auto">
          {/* Header */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/20">
              <Target className="w-5 h-5 text-primary animate-pulse" />
            </div>
            <div>
              <h1 className="text-base font-black uppercase tracking-tighter">Success Predictor</h1>
              <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold opacity-60">{loadProgress}</p>
            </div>
          </div>

          {/* Insight teasers while loading */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <SkeletonCard title="Genre Impact" subtitle="Which genres generate the most ticket sales?" />
            <SkeletonCard title="Star Power" subtitle="Do bankable directors guarantee a hit?" />
            <SkeletonCard title="Market Signals" subtitle="Language, duration, and age rating correlations" />
          </div>

          {/* KPI skeletons */}
          <div className="grid grid-cols-5 gap-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-24 rounded-xl border border-border/20 animate-pulse bg-muted/20" />
            ))}
          </div>

          {/* Chart skeleton */}
          <div className="h-80 rounded-xl border border-border/20 animate-pulse bg-muted/10" />

          <p className="text-center text-xs text-muted-foreground/40 font-medium">
            Analyzing {movies.length > 0 ? movies.length : '3,963'} movies…
          </p>
        </div>
    </div>
  );
}

function ComparisonCard({ label, movieValue, avgValue }: { label: string; movieValue: number; avgValue: number }) {
  const delta = movieValue - avgValue;
  const pctDelta = avgValue > 0 ? ((delta / avgValue) * 100).toFixed(0) : '—';
  const above = delta >= 0;
  return (
    <div className="px-3 py-2 rounded-lg border border-border/30 bg-card">
      <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/50">{label}</p>
      <p className={cn(
        'text-base font-black',
        above ? 'text-emerald-600' : 'text-red-500',
      )}>
        {above ? '+' : ''}{formatAdm(delta)}
        <span className="text-[10px] text-muted-foreground font-normal ml-1">({above ? '+' : ''}{pctDelta}%)</span>
      </p>
      <p className="text-[9px] text-muted-foreground/50 font-mono mt-0.5">
        {formatAdm(movieValue)} vs {formatAdm(avgValue)} avg
      </p>
    </div>
  );
}

  // ── Loaded state ──
  return (
    <div className="px-6 py-8 space-y-6 max-w-[1600px] mx-auto">
      {/* ── Header + Filter Toggle ── */}
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

      {/* ── Filter Panel (collapsible) ── */}
      {showFilters && (
        <Card>
          <CardContent className="py-4 space-y-4">
            {/* Factor toggles */}
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 mb-2">Analysis Factors</p>
              <div className="flex flex-wrap gap-2">
                {FACTOR_CONFIG.map(({ key, label, icon: Icon }) => (
                  <button
                    key={key}
                    onClick={() => toggleFactor(key)}
                    className={cn(
                      'flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all',
                      factors[key]
                        ? 'bg-primary/10 border-primary/20 text-primary'
                        : 'bg-muted/30 border-border/20 text-muted-foreground/40',
                    )}
                  >
                    <Icon className="w-3 h-3" />
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Type filter */}
            <div className="flex items-center gap-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">Type</p>
              <div className="flex gap-1">
                {(['all', 'local', 'international'] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setTypeFilter(t)}
                    className={cn(
                      'px-3 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all',
                      typeFilter === t
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted/30 text-muted-foreground hover:bg-muted/50',
                    )}
                  >
                    {t === 'all' ? 'All' : t === 'local' ? 'Local' : 'International'}
                  </button>
                ))}
              </div>
            </div>

            {/* Genre filter */}
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 mb-2">
                Genre Filter
                {selectedGenres.length > 0 && (
                  <button
                    onClick={() => setSelectedGenres([])}
                    className="ml-2 text-primary hover:underline normal-case tracking-normal font-medium"
                  >
                    Clear ({selectedGenres.length})
                  </button>
                )}
              </p>
              <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                {allGenres.map((g) => (
                  <button
                    key={g}
                    onClick={() => setSelectedGenres((prev) =>
                      prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g]
                    )}
                    className={cn(
                      'px-2 py-0.5 rounded text-[10px] font-medium border transition-all',
                      selectedGenres.includes(g)
                        ? 'bg-indigo-500/10 border-indigo-500/30 text-indigo-600'
                        : 'bg-muted/20 border-border/20 text-muted-foreground/50 hover:bg-muted/40',
                    )}
                  >
                    {g}
                  </button>
                ))}
              </div>
            </div>

            {/* Year range filter */}
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 mb-2">
                Year Range
                {(yearRangeFilter[0] > 0 || yearRangeFilter[1] > 0) && (
                  <button
                    onClick={() => setYearRangeFilter([0, 0])}
                    className="ml-2 text-primary hover:underline normal-case tracking-normal font-medium"
                  >
                    Reset
                  </button>
                )}
              </p>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={yearRangeFilter[0] || ''}
                  onChange={(e) => setYearRangeFilter(([_, max]) => [Number(e.target.value) || 0, max])}
                  placeholder={String(yearMin)}
                  min={yearMin}
                  max={yearMax}
                  className="w-20 px-2 py-1 text-xs rounded-md border border-border/40 bg-background text-center font-mono"
                />
                <span className="text-[10px] text-muted-foreground/50">to</span>
                <input
                  type="number"
                  value={yearRangeFilter[1] || ''}
                  onChange={(e) => setYearRangeFilter(([min]) => [min, Number(e.target.value) || 0])}
                  placeholder={String(yearMax)}
                  min={yearMin}
                  max={yearMax}
                  className="w-20 px-2 py-1 text-xs rounded-md border border-border/40 bg-background text-center font-mono"
                />
                <span className="text-[10px] text-muted-foreground/40 font-mono">{yearMin}–{yearMax}</span>
              </div>
            </div>

            {/* Active filters summary */}
            {(typeFilter !== 'all' || selectedGenres.length > 0 || yearRangeFilter[0] > 0 || yearRangeFilter[1] > 0) && (
              <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                <Filter className="w-3 h-3" />
                <span>Showing {filtered.length.toLocaleString()} of {movies.length.toLocaleString()} movies</span>
                {typeFilter !== 'all' && <Badge variant="outline" className="text-[9px] px-1.5 py-0">{typeFilter}</Badge>}
                {selectedGenres.map((g) => (
                  <Badge key={g} variant="outline" className="text-[9px] px-1.5 py-0 border-indigo-500/30 text-indigo-600">{g}</Badge>
                ))}
                {(yearRangeFilter[0] > 0 || yearRangeFilter[1] > 0) && (
                  <Badge variant="outline" className="text-[9px] px-1.5 py-0 border-amber-500/30 text-amber-600">
                    {yearRangeFilter[0] || yearMin}–{yearRangeFilter[1] || yearMax}
                  </Badge>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── KPI Row ── */}
      <div className="grid grid-cols-5 gap-3">
        {[
          { label: 'Total Movies', value: overview.total_movies.toLocaleString(), color: 'indigo', icon: Film },
          { label: 'Total Admissions', value: formatAdm(overview.total_admissions), color: 'emerald', icon: Users },
          { label: 'Avg per Movie', value: formatAdm(overview.avg_admission), color: 'amber', icon: TrendingUp },
          { label: 'Median', value: formatAdm(overview.median_admission), color: 'purple', icon: BarChart3 },
          { label: 'Mega Hits (≥1M)', value: String(overview.tiers.mega_hit), color: 'rose', icon: Trophy },
        ].map(({ label, value, color, icon: Icon }) => (
          <div key={label} className="px-4 py-3 rounded-xl border border-border/30 bg-card">
            <div className="flex items-center gap-2 mb-1">
              <Icon className={cn('w-3.5 h-3.5', `text-${color}-500`)} />
              <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/50">{label}</span>
            </div>
            <p className="text-xl font-black tracking-tight">{value}</p>
          </div>
        ))}
      </div>

      {/* ── Success Tier Bar ── */}
      <Card>
        <CardContent className="py-4">
          <div className="flex h-6 rounded-lg overflow-hidden">
            {TIER_KEYS.map((tier) => {
              const count = overview.tiers[tier];
              const pct = overview.with_admissions > 0 ? (count / overview.with_admissions) * 100 : 0;
              return (
                <div
                  key={tier}
                  className="flex items-center justify-center text-[9px] font-bold text-white transition-all duration-700 ease-out"
                  style={{
                    width: tierAnimated ? `${pct}%` : '0%',
                    backgroundColor: TIER_COLORS[tier],
                    minWidth: count > 0 ? 20 : 0,
                    opacity: tierAnimated ? 1 : 0,
                  }}
                  title={`${TIER_LABELS[tier]}: ${count} (${pct.toFixed(1)}%)`}
                >
                  {pct >= 8 ? count : ''}
                </div>
              );
            })}
          </div>
          <div className="flex flex-wrap gap-3 mt-2">
            {TIER_KEYS.map((tier) => (
              <span key={tier} className="flex items-center gap-1 text-[9px] text-muted-foreground">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: TIER_COLORS[tier] }} />
                {TIER_LABELS[tier]}: {overview.tiers[tier]}
              </span>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* ── Empty State ── */}
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

      {/* ── Sections below only show when there's data ── */}
      {filtered.length > 0 && (
      <>
      {/* ── Genre Impact ── */}
      {factors.genre && (
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
                        <th className="p-2 text-left">Genre</th>
                        <th className="p-2 text-right">Avg</th>
                        <th className="p-2 text-right">Hit%</th>
                        <th className="p-2 text-right">Score</th>
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
      )}

      {/* ── Genre Combos ── */}
      {factors.genre && genreCombos.length > 0 && (
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

      {/* ── Star Power ── */}
      {(factors.director || factors.actor) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {factors.director && (
            <Card>
              <CardHeader className="pb-2 border-b">
                <CardTitle className="text-sm font-black uppercase tracking-[0.2em] flex items-center gap-2">
                  <Clapperboard className="w-4 h-4 text-amber-500" /> Top Directors
                  <Link href="/competitors/cinepoint/analysis/directors" className="ml-auto text-[10px] font-bold text-primary hover:underline normal-case tracking-normal">
                    View all →
                  </Link>
                </CardTitle>
                <CardDescription className="text-[9px]">Min 3 movies, by avg admissions</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <PersonTable rankings={directorRankings} role="director" />
              </CardContent>
            </Card>
          )}
          {factors.actor && (
            <Card>
              <CardHeader className="pb-2 border-b">
                <CardTitle className="text-sm font-black uppercase tracking-[0.2em] flex items-center gap-2">
                  <Star className="w-4 h-4 text-indigo-500" /> Top Actors
                  <Link href="/competitors/cinepoint/analysis/actors" className="ml-auto text-[10px] font-bold text-primary hover:underline normal-case tracking-normal">
                    View all →
                  </Link>
                </CardTitle>
                <CardDescription className="text-[9px]">Min 5 movies, by avg admissions</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <PersonTable rankings={actorRankings} role="actor" />
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* ── Language & Duration ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {factors.language && (
          <div className="space-y-4">
            {Object.entries(languageStats).map(([lang, stats]) => (
              <Card key={lang}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-black uppercase tracking-[0.2em] flex items-center gap-2">
                    <span className={cn('w-2.5 h-2.5 rounded-full', lang === 'Indonesia' ? 'bg-indigo-500' : 'bg-amber-500')} />
                    {lang}
                    <span className="text-muted-foreground font-normal normal-case tracking-normal text-xs ml-auto">
                      {stats.count} movies · Avg {formatAdm(stats.avg_admission)} · Hit {stats.hit_rate_pct}%
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={160}>
                    <BarChart data={stats.top_genres}>
                      <CartesianGrid strokeDasharray="3 3" className="opacity-20" />
                      <XAxis dataKey="genre" tick={{ fontSize: 9 }} />
                      <YAxis tick={{ fontSize: 9 }} tickFormatter={(v) => formatAdm(Number(v))} />
                      <Tooltip formatter={(v) => Number(v).toLocaleString()} />
                      <Bar dataKey="avg_admission" radius={[3, 3, 0, 0]}
                        fill={lang === 'Indonesia' ? '#6366f1' : '#f59e0b'} fillOpacity={0.7} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <div className="space-y-4">
          {factors.duration && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-black uppercase tracking-[0.2em]">Duration Sweet Spot</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={durationBuckets}>
                    <CartesianGrid strokeDasharray="3 3" className="opacity-20" />
                    <XAxis dataKey="range" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 9 }} tickFormatter={(v) => formatAdm(Number(v))} />
                    <Tooltip formatter={(v) => Number(v).toLocaleString()} />
                    <Bar dataKey="avg_admission" radius={[3, 3, 0, 0]}>
                      {durationBuckets.map((d, i) => {
                        const max = Math.max(...durationBuckets.map((x) => x.avg_admission));
                        return <Cell key={i} fill={d.avg_admission === max ? '#10b981' : '#6366f1'} fillOpacity={d.avg_admission === max ? 1 : 0.4} />;
                      })}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {factors.rating && ratingStats.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-black uppercase tracking-[0.2em]">Age Rating Impact</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={ratingStats} layout="vertical" margin={{ left: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" className="opacity-20" />
                    <XAxis type="number" tick={{ fontSize: 9 }} tickFormatter={(v) => formatAdm(Number(v))} />
                    <YAxis type="category" dataKey="rating" width={50} tick={{ fontSize: 10 }} />
                    <Tooltip formatter={(v) => Number(v).toLocaleString()} />
                    <Bar dataKey="avg_admission" radius={[0, 3, 3, 0]} fill="#8b5cf6" fillOpacity={0.7} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
      </>
      )}

      {/* ── Movie Deep Dive ── */}
      <Card>
        <CardHeader className="pb-2 border-b">
          <CardTitle className="text-sm font-black uppercase tracking-[0.2em] flex items-center gap-2">
            <Search className="w-4 h-4 text-cyan-500" /> Movie Deep Dive
          </CardTitle>
          <CardDescription className="text-[9px]">Pick any movie to see its success profile compared against averages</CardDescription>
        </CardHeader>
        <CardContent className="py-4 space-y-4">
          {/* Search */}
          <div className="relative">
            <Search className="w-4 h-4 text-muted-foreground/40 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={deepDiveQuery}
              onChange={(e) => setDeepDiveQuery(e.target.value)}
              placeholder="Search for a movie…"
              className="w-full pl-9 pr-4 py-2 text-sm rounded-lg border border-border/40 bg-muted/20 focus:outline-none focus:border-primary/40 focus:ring-1 focus:ring-primary/20"
            />
          </div>

          {/* Search results dropdown */}
          {deepDiveQuery.trim() && !deepDiveMovie && (
            <div className="border rounded-lg divide-y max-h-60 overflow-auto">
              {deepDiveResults.length === 0 && (
                <p className="p-3 text-xs text-muted-foreground text-center">No movies found</p>
              )}
              {deepDiveResults.map((m) => (
                <button
                  key={m.id}
                  onClick={() => { setDeepDiveMovie(m); setDeepDiveQuery(m.title); }}
                  className="w-full flex items-center justify-between p-2.5 hover:bg-muted/30 text-left transition-colors"
                >
                  <div>
                    <p className="text-xs font-bold">{m.title}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {m.release_year || '—'} · {m.language} · {m.genres.slice(0, 3).join(', ')}
                    </p>
                  </div>
                  {m.total_admission > 0 && (
                    <span className={cn(
                      'text-xs font-mono font-bold',
                      m.total_admission >= 1_000_000 ? 'text-emerald-600' : m.total_admission >= 500_000 ? 'text-indigo-600' : 'text-muted-foreground',
                    )}>
                      {formatAdm(m.total_admission)}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}

          {/* Selected movie profile */}
          {deepDiveProfile && (
            <div className="space-y-4">
              {/* Movie header */}
              <div className="flex items-start justify-between p-4 rounded-xl bg-muted/20 border border-border/30">
                <div>
                  <Link
                    href={`/competitors/cinepoint/movies/${deepDiveProfile.movie.id}`}
                    className="text-sm font-black hover:text-primary transition-colors"
                  >
                    {deepDiveProfile.movie.title}
                  </Link>
                  <div className="flex flex-wrap items-center gap-2 mt-1">
                    <span className="text-[10px] text-muted-foreground">{deepDiveProfile.movie.release_year || '—'}</span>
                    <span className="text-[10px] text-muted-foreground">·</span>
                    <span className="text-[10px] text-muted-foreground">{deepDiveProfile.movie.language}</span>
                    <span className="text-[10px] text-muted-foreground">·</span>
                    <span className="text-[10px] text-muted-foreground">{deepDiveProfile.movie.duration} min</span>
                    {deepDiveProfile.movie.genres.map((g) => (
                      <Badge key={g} variant="outline" className="text-[9px] px-1.5 py-0">{g}</Badge>
                    ))}
                  </div>
                  {deepDiveProfile.movie.directors.length > 0 && (
                    <p className="text-[10px] text-muted-foreground/60 mt-1">
                      Dir: {deepDiveProfile.movie.directors.slice(0, 3).join(', ')}
                    </p>
                  )}
                </div>
                <div className="text-right">
                  <p className="text-lg font-black" style={{ color: TIER_COLORS[deepDiveProfile.tier] }}>
                    {deepDiveProfile.movie.total_admission > 0 ? formatAdm(deepDiveProfile.movie.total_admission) : 'N/A'}
                  </p>
                  <span className={cn(
                    'text-[9px] font-bold px-2 py-0.5 rounded-full text-white',
                    deepDiveProfile.tier === 'mega_hit' || deepDiveProfile.tier === 'hit' ? 'bg-emerald-500' :
                    deepDiveProfile.tier === 'moderate' ? 'bg-amber-500' : 'bg-gray-400',
                  )}>
                    {TIER_LABELS[deepDiveProfile.tier]}
                  </span>
                </div>
              </div>

              {/* Comparison grid */}
              {deepDiveProfile.vsOverall && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <ComparisonCard
                    label="vs Overall Avg"
                    movieValue={deepDiveProfile.vsOverall.value}
                    avgValue={deepDiveProfile.vsOverall.avg}
                  />
                  {deepDiveProfile.vsLanguage && (
                    <ComparisonCard
                      label={`vs ${deepDiveProfile.vsLanguage.label} Avg`}
                      movieValue={deepDiveProfile.vsLanguage.value}
                      avgValue={deepDiveProfile.vsLanguage.avg}
                    />
                  )}
                  {deepDiveProfile.vsDuration && (
                    <ComparisonCard
                      label={`vs ${deepDiveProfile.vsDuration.label} Avg`}
                      movieValue={deepDiveProfile.vsDuration.value}
                      avgValue={deepDiveProfile.vsDuration.avg}
                    />
                  )}
                  {deepDiveProfile.movie.score > 0 && (
                    <div className="px-3 py-2 rounded-lg border border-border/30 bg-card">
                      <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/50">Audience Score</p>
                      <p className={cn(
                        'text-base font-black',
                        deepDiveProfile.movie.score >= 7 ? 'text-emerald-600' : deepDiveProfile.movie.score >= 5 ? 'text-amber-600' : 'text-red-500',
                      )}>
                        {deepDiveProfile.movie.score.toFixed(1)}
                        <span className="text-[10px] text-muted-foreground font-normal">/10</span>
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Genre comparison */}
              {Object.keys(deepDiveProfile.genreAvgs).length > 0 && deepDiveProfile.movie.total_admission > 0 && (
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 mb-2">vs Genre Averages</p>
                  <div className="flex flex-wrap gap-2">
                    {deepDiveProfile.movie.genres.map((g) => {
                      const avg = deepDiveProfile.genreAvgs[g] || 0;
                      const above = deepDiveProfile.movie.total_admission >= avg;
                      return (
                        <div key={g} className={cn(
                          'px-3 py-1.5 rounded-lg border text-xs font-medium',
                          above ? 'border-emerald-500/30 bg-emerald-500/5 text-emerald-700' : 'border-red-500/30 bg-red-500/5 text-red-600',
                        )}>
                          {g}: {above ? '↑' : '↓'} {formatAdm(Math.abs(deepDiveProfile.movie.total_admission - avg))}
                          <span className="text-[9px] text-muted-foreground ml-1">vs {formatAdm(avg)} avg</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Clear button */}
              <button
                onClick={() => { setDeepDiveMovie(null); setDeepDiveQuery(''); }}
                className="text-[10px] text-muted-foreground hover:text-primary transition-colors"
              >
                ← Clear selection
              </button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Sub-components ────────────────────────────────────────

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

function PersonTable({ rankings, role }: { rankings: { name: string; movie_count: number; avg_admission: number; total_admission: number; best_movie: { id: number; title: string; total_admission: number } | null }[]; role: 'actor' | 'director' }) {
  return (
    <div className="overflow-auto max-h-[500px]">
      <table className="w-full text-xs">
        <thead className="sticky top-0 bg-background z-10">
          <tr className="border-b text-[9px] font-black uppercase tracking-widest text-muted-foreground/50">
            <th className="p-2 text-left w-8">#</th>
            <th className="p-2 text-left">Name</th>
            <th className="p-2 text-right">Movies</th>
            <th className="p-2 text-right">Avg</th>
            <th className="p-2 text-left">Best Movie</th>
          </tr>
        </thead>
        <tbody>
          {rankings.map((p, i) => (
            <tr key={p.name} className="border-b last:border-0 hover:bg-muted/20">
              <td className="p-2 text-muted-foreground/30 font-mono">{i + 1}</td>
              <td className="p-2">
                <button
                  onClick={() => { window.location.href = `/competitors/cinepoint/analysis/person/${encodeURIComponent(p.name)}`; }}
                  className="font-bold hover:text-primary transition-colors text-left cursor-pointer"
                >
                  {p.name}
                </button>
              </td>
              <td className="p-2 text-right font-mono text-muted-foreground">{p.movie_count}</td>
              <td className="p-2 text-right font-mono font-bold">{formatAdm(p.avg_admission)}</td>
              <td className="p-2">
                {p.best_movie && (
                  <Link
                    href={`/competitors/cinepoint/movies/${p.best_movie.id}`}
                    className="text-[10px] text-primary hover:underline"
                  >
                    {p.best_movie.title}
                    <span className="text-muted-foreground ml-1 font-mono">({formatAdm(p.best_movie.total_admission)})</span>
                  </Link>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
