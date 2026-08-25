'use client';

import Link from 'next/link';
import { Film, Languages, Clock, Play, ArrowUpRight, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { CinePointMovie } from '@/features/competitors/types';
import { formatAdm, LOCAL_COLOR, INTL_COLOR, TIER_COLORS } from '@/lib/cinepoint';
import { extractCrew, MovieSynopsis, MovieCastCrew, MovieAudienceRating, MovieWhereToWatch } from '@/components/cinepoint/MovieDetailSections';
import { TypeBadge } from '@/components/cinepoint/SharedUi';
import { format, parseISO } from 'date-fns';

export function EnrichedContent({ movie }: { movie: CinePointMovie }) {
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
                  <TypeBadge type={movie.type} />
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
                        color={TIER_COLORS.niche}
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
