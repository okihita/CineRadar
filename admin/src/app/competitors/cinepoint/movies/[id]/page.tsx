'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft, Loader2, Film, ChevronRight, Eye,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import type { CinePointMovie } from '@/features/competitors/types';
import { EnrichedContent } from './_components/EnrichedContent';
import { TypeBadge } from '@/components/cinepoint/SharedUi';

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
                <img src={movie.image_title} alt="" className="w-full h-full object-cover" loading="eager" referrerPolicy="no-referrer" />
              </div>
            )}
            <div className="min-w-0">
              <h1 className="text-base font-black uppercase tracking-tighter truncate">{movie.title}</h1>
              <div className="flex items-center gap-2">
                <TypeBadge type={movie.type} short />
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

      <div className="px-6 py-8 space-y-6">
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

function Meta({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/40">{label}</p>
      <p className={cn('text-sm font-medium', mono && 'font-mono')}>{value}</p>
    </div>
  );
}
