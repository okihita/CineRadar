'use client';

import Link from 'next/link';
import { Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { formatAdm, classifyTier, TIER_COLORS, TIER_LABELS } from '@/lib/cinepoint';
import type { AnalysisMovie, OverviewStats } from '@/lib/cinepoint';

interface DeepDiveProps {
  movies: AnalysisMovie[];
  filtered: AnalysisMovie[];
  query: string;
  setQuery: (q: string) => void;
  selectedMovie: AnalysisMovie | null;
  setSelectedMovie: (m: AnalysisMovie | null) => void;
}

export function DeepDive({ movies, filtered, query, setQuery, selectedMovie, setSelectedMovie }: DeepDiveProps) {
  // Search results
  const results = query.trim()
    ? movies.filter((m) => m.title.toLowerCase().includes(query.toLowerCase().trim())).slice(0, 8)
    : [];

  // Comparison profile
  const profile = selectedMovie ? buildProfile(selectedMovie, filtered) : null;

  return (
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
          <input type="text" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search for a movie…"
            className="w-full pl-9 pr-4 py-2 text-sm rounded-lg border border-border/40 bg-muted/20 focus:outline-none focus:border-primary/40 focus:ring-1 focus:ring-primary/20" />
        </div>

        {/* Search results */}
        {query.trim() && !selectedMovie && (
          <div className="border rounded-lg divide-y max-h-60 overflow-auto">
            {results.length === 0 && <p className="p-3 text-xs text-muted-foreground text-center">No movies found</p>}
            {results.map((m) => (
              <button key={m.id} onClick={() => { setSelectedMovie(m); setQuery(m.title); }}
                className="w-full flex items-center justify-between p-2.5 hover:bg-muted/30 text-left transition-colors">
                <div>
                  <p className="text-xs font-bold">{m.title}</p>
                  <p className="text-[10px] text-muted-foreground">{m.release_year || '—'} · {m.language} · {m.genres.slice(0, 3).join(', ')}</p>
                </div>
                {m.total_admission > 0 && (
                  <span className={cn('text-xs font-mono font-bold', m.total_admission >= 1_000_000 ? 'text-emerald-600' : m.total_admission >= 500_000 ? 'text-indigo-600' : 'text-muted-foreground')}>
                    {formatAdm(m.total_admission)}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}

        {/* Profile */}
        {profile && (
          <div className="space-y-4">
            <div className="flex items-start justify-between p-4 rounded-xl bg-muted/20 border border-border/30">
              <div>
                <Link href={`/competitors/cinepoint/movies/${profile.movie.id}`} className="text-sm font-black hover:text-primary transition-colors">{profile.movie.title}</Link>
                <div className="flex flex-wrap items-center gap-2 mt-1">
                  <span className="text-[10px] text-muted-foreground">{profile.movie.release_year || '—'}</span>
                  <span className="text-[10px] text-muted-foreground">·</span>
                  <span className="text-[10px] text-muted-foreground">{profile.movie.language}</span>
                  <span className="text-[10px] text-muted-foreground">·</span>
                  <span className="text-[10px] text-muted-foreground">{profile.movie.duration} min</span>
                  {profile.movie.genres.map((g) => <Badge key={g} variant="outline" className="text-[9px] px-1.5 py-0">{g}</Badge>)}
                </div>
                {profile.movie.directors.length > 0 && <p className="text-[10px] text-muted-foreground/60 mt-1">Dir: {profile.movie.directors.slice(0, 3).join(', ')}</p>}
              </div>
              <div className="text-right">
                <p className="text-lg font-black" style={{ color: TIER_COLORS[profile.tier] }}>{profile.movie.total_admission > 0 ? formatAdm(profile.movie.total_admission) : 'N/A'}</p>
                <span className={cn('text-[9px] font-bold px-2 py-0.5 rounded-full text-white',
                  profile.tier === 'mega_hit' || profile.tier === 'hit' ? 'bg-emerald-500' : profile.tier === 'moderate' ? 'bg-amber-500' : 'bg-gray-400')}>
                  {TIER_LABELS[profile.tier]}
                </span>
              </div>
            </div>

            {/* Comparison grid */}
            {profile.vsOverall && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <ComparisonCard label="vs Overall Avg" movieValue={profile.vsOverall.value} avgValue={profile.vsOverall.avg} />
                {profile.vsLanguage && <ComparisonCard label={`vs ${profile.vsLanguage.label} Avg`} movieValue={profile.vsLanguage.value} avgValue={profile.vsLanguage.avg} />}
                {profile.vsDuration && <ComparisonCard label={`vs ${profile.vsDuration.label} Avg`} movieValue={profile.vsDuration.value} avgValue={profile.vsDuration.avg} />}
                {profile.movie.score > 0 && (
                  <div className="px-3 py-2 rounded-lg border border-border/30 bg-card">
                    <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/50">Audience Score</p>
                    <p className={cn('text-base font-black', profile.movie.score >= 7 ? 'text-emerald-600' : profile.movie.score >= 5 ? 'text-amber-600' : 'text-red-500')}>
                      {profile.movie.score.toFixed(1)}<span className="text-[10px] text-muted-foreground font-normal">/10</span>
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Genre comparison */}
            {Object.keys(profile.genreAvgs).length > 0 && profile.movie.total_admission > 0 && (
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 mb-2">vs Genre Averages</p>
                <div className="flex flex-wrap gap-2">
                  {profile.movie.genres.map((g) => {
                    const avg = profile.genreAvgs[g] || 0;
                    const above = profile.movie.total_admission >= avg;
                    return (
                      <div key={g} className={cn('px-3 py-1.5 rounded-lg border text-xs font-medium',
                        above ? 'border-emerald-500/30 bg-emerald-500/5 text-emerald-700' : 'border-red-500/30 bg-red-500/5 text-red-600')}>
                        {g}: {above ? '↑' : '↓'} {formatAdm(Math.abs(profile.movie.total_admission - avg))}
                        <span className="text-[9px] text-muted-foreground ml-1">vs {formatAdm(avg)} avg</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <button onClick={() => { setSelectedMovie(null); setQuery(''); }} className="text-[10px] text-muted-foreground hover:text-primary transition-colors">
              ← Clear selection
            </button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ComparisonCard({ label, movieValue, avgValue }: { label: string; movieValue: number; avgValue: number }) {
  const delta = movieValue - avgValue;
  const pctDelta = avgValue > 0 ? ((delta / avgValue) * 100).toFixed(0) : '—';
  const above = delta >= 0;
  return (
    <div className="px-3 py-2 rounded-lg border border-border/30 bg-card">
      <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/50">{label}</p>
      <p className={cn('text-base font-black', above ? 'text-emerald-600' : 'text-red-500')}>
        {above ? '+' : ''}{formatAdm(delta)}
        <span className="text-[10px] text-muted-foreground font-normal ml-1">({above ? '+' : ''}{pctDelta}%)</span>
      </p>
      <p className="text-[9px] text-muted-foreground/50 font-mono mt-0.5">{formatAdm(movieValue)} vs {formatAdm(avgValue)} avg</p>
    </div>
  );
}

function buildProfile(movie: AnalysisMovie, filtered: AnalysisMovie[]) {
  const withAdm = filtered.filter((f) => f.total_admission > 0);
  const overallAvg = withAdm.length ? Math.round(withAdm.reduce((s, f) => s + f.total_admission, 0) / withAdm.length) : 0;

  const genreAvgs: Record<string, number> = {};
  for (const g of movie.genres) {
    const gMovies = withAdm.filter((f) => f.genres.includes(g));
    genreAvgs[g] = gMovies.length ? Math.round(gMovies.reduce((s, f) => s + f.total_admission, 0) / gMovies.length) : 0;
  }

  const langMovies = withAdm.filter((f) => f.language === movie.language);
  const langAvg = langMovies.length ? Math.round(langMovies.reduce((s, f) => s + f.total_admission, 0) / langMovies.length) : 0;

  const durBucket = movie.duration < 80 ? '<80' : movie.duration < 100 ? '80-100' : movie.duration < 120 ? '100-120' : movie.duration < 140 ? '120-140' : '140+';
  const durMovies = withAdm.filter((f) => {
    if (durBucket === '<80') return f.duration < 80;
    if (durBucket === '80-100') return f.duration >= 80 && f.duration < 100;
    if (durBucket === '100-120') return f.duration >= 100 && f.duration < 120;
    if (durBucket === '120-140') return f.duration >= 120 && f.duration < 140;
    return f.duration >= 140;
  });
  const durAvg = durMovies.length ? Math.round(durMovies.reduce((s, f) => s + f.total_admission, 0) / durMovies.length) : 0;

  const tier = classifyTier(movie.total_admission);

  return {
    movie,
    tier,
    genreAvgs,
    vsOverall: movie.total_admission > 0 ? { value: movie.total_admission, avg: overallAvg } : null,
    vsLanguage: movie.total_admission > 0 ? { value: movie.total_admission, avg: langAvg, label: movie.language } : null,
    vsDuration: movie.total_admission > 0 ? { value: movie.total_admission, avg: durAvg, label: `${durBucket} min` } : null,
  };
}
