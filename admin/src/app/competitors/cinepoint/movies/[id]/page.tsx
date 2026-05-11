'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  AreaChart, Area, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, BarChart, Bar, Cell,
} from 'recharts';
import { format, parseISO } from 'date-fns';
import {
  ArrowLeft, Loader2, Film, ChevronRight,
  Languages, Clock, Play, Eye, ArrowUpRight,
  TrendingUp,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import type { CinePointMovie } from '@/features/competitors/types';
import { formatAdm, LOCAL_COLOR, INTL_COLOR } from '@/lib/cinepoint';
import {
  extractCrew, MovieSynopsis, MovieCastCrew, MovieAudienceRating,
  MovieWhereToWatch,
} from '@/components/cinepoint/MovieDetailSections';

// ─── Page ──────────────────────────────────────────────────

export default function CinePointMovieDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [movie, setMovie] = useState<CinePointMovie | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [movieId, setMovieId] = useState<string>('');

  useEffect(() => {
    params.then((p) => setMovieId(p.id));
  }, [params]);

  const loadMovie = useCallback(async () => {
    if (!movieId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/competitors/cinepoint/movies/${movieId}/detail`);
      const json = await res.json();
      if (json.success && json.data) {
        setMovie(json.data);
      } else {
        setError(json.error || 'Movie not found');
      }
    } catch {
      setError('Failed to load movie');
    }
    setLoading(false);
  }, [movieId]);

  useEffect(() => { loadMovie(); }, [loadMovie]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary opacity-40" />
      </div>
    );
  }

  if (error || !movie) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <Film className="w-12 h-12 text-muted-foreground/20" />
        <p className="text-muted-foreground text-sm">{error || 'Movie not found'}</p>
        <Link href="/competitors/cinepoint">
          <Button variant="outline" size="sm">Back to Catalog</Button>
        </Link>
      </div>
    );
  }

  const isEnriched = !!movie.details_fetched_at;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-border/40 bg-background/95 backdrop-blur-md">
        <div className="px-6 h-16 flex items-center gap-4">
          <Link
            href="/competitors/cinepoint"
            className="w-9 h-9 rounded-xl border border-border/40 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div className="flex items-center gap-3 min-w-0 flex-1">
            {movie.image_title && (
              <div className="w-8 h-11 rounded overflow-hidden shrink-0 relative border border-border/20">
                <img src={movie.image_title} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              </div>
            )}
            <div className="min-w-0">
              <h1 className="text-base font-black uppercase tracking-tighter truncate">{movie.title}</h1>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className={cn(
                  'text-[8px] px-1.5 py-0',
                  movie.type === 'local' ? 'border-indigo-500/30 text-indigo-600' : 'border-amber-500/30 text-amber-600',
                )}>
                  {movie.type === 'local' ? 'Local' : 'International'}
                </Badge>
                {movie.movie_genre.map((g) => (
                  <span key={g} className="text-[8px] text-muted-foreground/40 font-medium uppercase tracking-wider">{g}</span>
                ))}
                {isEnriched && (
                  <span className="text-[8px] text-emerald-500/60 font-bold uppercase tracking-widest">Enriched</span>
                )}
              </div>
            </div>
          </div>

          {/* Quick stats */}
          <div className="flex items-center gap-4">
            {movie.score != null && (
              <div className="text-right">
                <p className="text-lg font-black">{movie.score.toFixed(1)}</p>
                <p className="text-[8px] text-muted-foreground/40 uppercase tracking-widest font-bold">Score</p>
              </div>
            )}
            {movie.language && (
              <div className="text-right">
                <p className="text-xs font-bold">{movie.language}</p>
                <p className="text-[8px] text-muted-foreground/40 uppercase tracking-widest font-bold">Language</p>
              </div>
            )}
            <Link href="/competitors/cinepoint/insights">
              <Button variant="outline" size="sm" className="h-8 gap-2 text-[10px] font-black uppercase tracking-wider rounded-xl">
                Insights
                <ChevronRight className="w-3 h-3" />
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <div className="px-6 py-8 space-y-6 max-w-[1600px] mx-auto">
        {/* Not enriched notice */}
        {!isEnriched && (
          <div className="p-4 rounded-xl border border-amber-500/20 bg-amber-500/5 text-sm text-amber-600 flex items-center gap-3">
            <Eye className="w-5 h-5 shrink-0" />
            <div>
              <p className="font-bold">Movie details not yet enriched</p>
              <p className="text-xs text-amber-600/60 mt-0.5">
                Run <code className="bg-amber-500/10 px-1 py-0.5 rounded text-[10px]">cinepoint_enrich.py --movie-id {movie.id}</code> to fetch casts, synopsis, trailer, and more.
              </p>
            </div>
          </div>
        )}

        {/* Enriched content */}
        {isEnriched && <EnrichedContent movie={movie} />}

        {/* Basic info fallback (always shown) */}
        {!isEnriched && (
          <Card>
            <CardHeader><CardTitle className="text-sm font-black uppercase tracking-[0.2em]">Basic Info</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <Meta label="ID" value={String(movie.id)} mono />
                <Meta label="Title" value={movie.title} />
                <Meta label="Type" value={movie.type} />
                <Meta label="Release Date" value={movie.release_date} mono />
                <Meta label="Duration" value={movie.duration ? `${movie.duration} min` : 'Unknown'} />
                <Meta label="Genre" value={movie.movie_genre.join(', ') || '—'} />
                <Meta label="Matched" value={movie.matched_movie_id ? 'Yes' : 'No'} />
                <Meta label="Scraped" value={movie.scraped_at?.slice(0, 10) || '—'} mono />
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

// ─── Enriched Content ──────────────────────────────────────

function EnrichedContent({ movie }: { movie: CinePointMovie }) {
  const { casts, directors, producers, writers, userRatings, topRating } = extractCrew(movie);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* ── Left: Poster + Synopsis + Cast ── */}
      <div className="lg:col-span-2 space-y-6">
        {/* Hero: Poster + Quick Info */}
        <div className="flex gap-6">
          {movie.image_title && (
            <div className="w-32 shrink-0 rounded-xl overflow-hidden border border-border/20 shadow-lg">
              <img
                src={movie.image_title}
                alt={movie.title}
                className="w-full aspect-[2/3] object-cover"
                referrerPolicy="no-referrer"
              />
            </div>
          )}
          <div className="flex-1 space-y-4">
            {/* Score + Badges */}
            <div className="flex items-start gap-4">
              {movie.score != null && (
                <div className="text-center">
                  <div className={cn(
                    'w-16 h-16 rounded-2xl flex flex-col items-center justify-center border-2',
                    movie.score >= 8 ? 'bg-emerald-500/10 border-emerald-500/20' :
                    movie.score >= 6 ? 'bg-amber-500/10 border-amber-500/20' :
                    'bg-red-500/10 border-red-500/20',
                  )}>
                    <span className="text-xl font-black">{movie.score.toFixed(1)}</span>
                    <span className="text-[8px] text-muted-foreground/60 uppercase tracking-widest">/ 10</span>
                  </div>
                </div>
              )}
              <div className="flex-1 space-y-2">
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline" className={cn(
                    movie.type === 'local' ? 'border-indigo-500/30 text-indigo-600' : 'border-amber-500/30 text-amber-600',
                  )}>
                    {movie.type === 'local' ? 'Local' : 'International'}
                  </Badge>
                  {movie.rating_category?.map((r) => (
                    <Badge key={r} variant="outline" className="border-red-500/30 text-red-600">{r}</Badge>
                  ))}
                  {movie.movie_genre.map((g) => (
                    <Badge key={g} variant="secondary">{g}</Badge>
                  ))}
                  {movie.language && (
                    <Badge variant="outline" className="border-border/40 text-muted-foreground">
                      <Languages className="w-3 h-3 mr-1" />{movie.language}
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  {movie.duration > 0 && (
                    <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{movie.duration} min</span>
                  )}
                  <span>{movie.release_date}</span>
                  {movie.production_status && (
                    <span className="capitalize">{movie.production_status}</span>
                  )}
                </div>
                {/* External ratings */}
                {movie.movie_rating && (movie.movie_rating.imdb || movie.movie_rating.rotten_tomatoes) && (
                  <div className="flex items-center gap-3 pt-1">
                    {movie.movie_rating.rotten_tomatoes != null && (
                      <span className="flex items-center gap-1 text-xs">
                        <span className="font-black text-red-600">RT</span>
                        <span className="font-mono">{movie.movie_rating.rotten_tomatoes}%</span>
                      </span>
                    )}
                    {movie.movie_rating.imdb != null && (
                      <span className="flex items-center gap-1 text-xs">
                        <span className="font-black text-amber-600">IMDb</span>
                        <span className="font-mono">{movie.movie_rating.imdb}</span>
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Trailer button */}
            {movie.trailer_url && (
              <a
                href={movie.trailer_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition-colors"
              >
                <Play className="w-4 h-4" />
                Watch Trailer
                <ArrowUpRight className="w-3 h-3" />
              </a>
            )}
          </div>
        </div>

        {/* Synopsis */}
        <MovieSynopsis description={movie.description} />

        {/* Cast & Crew */}
        <MovieCastCrew casts={casts} directors={directors} writers={writers} producers={producers} />

        {/* Similar movies */}
        {movie.similar_movies && movie.similar_movies.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-black uppercase tracking-[0.2em]">Similar Movies</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {movie.similar_movies.map((sm) => (
                  <Link
                    key={sm.id}
                    href={`/competitors/cinepoint/movies/${sm.id}`}
                    className="group p-3 rounded-xl border border-border/20 hover:border-primary/20 hover:bg-muted/30 transition-all"
                  >
                    <div className="flex gap-3">
                      {sm.image_title ? (
                        <div className="w-10 h-14 rounded overflow-hidden shrink-0 border border-border/10">
                          <img src={sm.image_title} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        </div>
                      ) : (
                        <div className="w-10 h-14 rounded bg-muted/20 flex items-center justify-center shrink-0">
                          <Film className="w-4 h-4 text-muted-foreground/20" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="text-xs font-bold group-hover:text-primary transition-colors truncate">{sm.title}</p>
                        <p className="text-[10px] text-muted-foreground/50 line-clamp-2 mt-0.5">{sm.description}</p>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* ── Right sidebar ── */}
      <div className="space-y-6">
        {/* Audience Rating */}
        <MovieAudienceRating score={movie.score} userRatings={userRatings} topRating={topRating} />

        {/* Where to Watch */}
        <MovieWhereToWatch playingAt={movie.playing_at ?? []} />

        {/* Comparison */}
        {movie.comparison && movie.comparison.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-black uppercase tracking-[0.2em] flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-indigo-500" /> Box Office Comparison
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {movie.comparison.map((c) => (
                <div key={c.periode}>
                  <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/40 mb-2">{c.periode.replace('_', ' ')}</p>
                  <div className="space-y-1.5">
                    <ComparisonBar
                      title={c.title}
                      admission={c.admission}
                      isHighlight
                      color={c.id === movie.id ? LOCAL_COLOR : INTL_COLOR}
                    />
                    {c.other_movie && (
                      <ComparisonBar
                        title={c.other_movie.title}
                        admission={c.other_movie.admission}
                        isHighlight={false}
                        color="#94a3b8"
                      />
                    )}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Metadata */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-black uppercase tracking-[0.2em]">Metadata</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5 text-xs">
            <MetaRow label="CinePoint ID" value={String(movie.id)} mono />
            <MetaRow label="Release Date" value={movie.release_date} mono />
            <MetaRow label="Duration" value={movie.duration ? `${movie.duration} min` : 'Unknown'} />
            <MetaRow label="Language" value={movie.language || '—'} />
            <MetaRow label="Status" value={movie.production_status || '—'} />
            <MetaRow label="Enriched" value={movie.details_fetched_at ? format(parseISO(movie.details_fetched_at), 'yyyy-MM-dd HH:mm') : 'No'} mono />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ─── Utility Components ────────────────────────────────────

function Meta({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/40">{label}</p>
      <p className={cn('text-sm font-medium', mono && 'font-mono')}>{value}</p>
    </div>
  );
}

function MetaRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between py-1 border-b border-border/5 last:border-0">
      <span className="text-muted-foreground/50">{label}</span>
      <span className={cn('font-medium', mono && 'font-mono')}>{value}</span>
    </div>
  );
}

function ComparisonBar({ title, admission, isHighlight, color }: { title: string; admission: number; isHighlight: boolean; color: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className={cn('text-[10px] truncate w-24', isHighlight ? 'font-bold' : 'text-muted-foreground/60')}>
        {title}
      </span>
      <div className="flex-1 h-2 bg-muted/30 rounded-full overflow-hidden">
        <div className="h-full rounded-full" style={{ backgroundColor: color, width: '100%' }} />
      </div>
      <span className="text-[10px] font-mono text-muted-foreground/60 w-14 text-right">{formatAdm(admission)}</span>
    </div>
  );
}
