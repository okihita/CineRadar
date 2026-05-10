/**
 * Shared movie detail section components.
 *
 * Used by insights MovieDetailPanel and movie detail EnrichedContent
 * to avoid duplicating ~125 lines of identical rendering logic.
 */

import {
  Film, Star, Clapperboard, PenTool, Megaphone,
  UserCircle, ArrowUpRight, Video, Play,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { CinePointMovie, CinePointUserRating, CinePointPlayingAt } from '@/features/competitors/types';

// ─── Helpers ──────────────────────────────────────────────

/** Extract structured crew data from a CinePoint movie's casts array */
export function extractCrew(movie: CinePointMovie) {
  const casts = movie.casts?.find((c) => c.role === 'casts')?.names ?? [];
  const directors = movie.casts?.find((c) => c.role === 'directors')?.names ?? [];
  const producers = movie.casts?.find((c) => c.role === 'producers')?.names ?? [];
  const writers = movie.casts?.find((c) => c.role === 'writers')?.names ?? [];
  const userRatings = movie.user_ratings ?? [];
  const topRating = userRatings.length > 0
    ? userRatings.reduce((best, r) => r.value > best.value ? r : best, userRatings[0])
    : null;
  return { casts, directors, producers, writers, userRatings, topRating };
}

// ─── Section Components ───────────────────────────────────

export function MovieSynopsis({ description }: { description?: string | null }) {
  if (!description) return null;
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-black uppercase tracking-[0.2em] flex items-center gap-2">
          <Film className="w-4 h-4 text-indigo-500" /> Synopsis
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm leading-relaxed text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  );
}

export function MovieCastCrew({ casts, directors, writers, producers }: {
  casts: string[];
  directors: string[];
  writers: string[];
  producers: string[];
}) {
  if (!directors.length && !writers.length && !casts.length && !producers.length) return null;
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-black uppercase tracking-[0.2em] flex items-center gap-2">
          <Clapperboard className="w-4 h-4 text-amber-500" /> Cast & Crew
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {directors.length > 0 && (
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 flex items-center gap-1 mb-1">
              <Megaphone className="w-3 h-3" /> Director{directors.length > 1 ? 's' : ''}
            </p>
            <div className="flex flex-wrap gap-2">
              {directors.map((name) => (
                <Badge key={name} variant="outline" className="border-amber-500/20 text-amber-700 text-xs">{name}</Badge>
              ))}
            </div>
          </div>
        )}
        {writers.length > 0 && (
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 flex items-center gap-1 mb-1">
              <PenTool className="w-3 h-3" /> Writer{writers.length > 1 ? 's' : ''}
            </p>
            <div className="flex flex-wrap gap-2">
              {writers.map((name) => (
                <Badge key={name} variant="outline" className="border-indigo-500/20 text-indigo-700 text-xs">{name}</Badge>
              ))}
            </div>
          </div>
        )}
        {casts.length > 0 && (
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 flex items-center gap-1 mb-1">
              <UserCircle className="w-3 h-3" /> Cast ({casts.length})
            </p>
            <div className="flex flex-wrap gap-1.5">
              {casts.map((name) => (
                <span key={name} className="text-xs text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-md">{name}</span>
              ))}
            </div>
          </div>
        )}
        {producers.length > 0 && (
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 flex items-center gap-1 mb-1">
              <Star className="w-3 h-3" /> Producer{producers.length > 1 ? 's' : ''}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {producers.map((name, i, arr) => (
                <span key={name} className="text-[10px] text-muted-foreground/70">
                  {name}{i < arr.length - 1 ? ' ·' : ''}
                </span>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function MovieAudienceRating({ score, userRatings, topRating }: {
  score?: number | null;
  userRatings: CinePointUserRating[];
  topRating: CinePointUserRating | null;
}) {
  if (!userRatings.length) return null;
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-black uppercase tracking-[0.2em] flex items-center gap-2">
          <Star className="w-4 h-4 text-amber-500" /> Audience Rating
        </CardTitle>
        <div className="flex items-center gap-2">
          <span className="text-2xl font-black">{score?.toFixed(1) ?? '?'}</span>
          <span className="text-[10px] text-muted-foreground">/ 10</span>
          {topRating && (
            <span className="text-[10px] text-muted-foreground/60 ml-auto">
              Peak: {topRating.rating}/10 ({topRating.value}%)
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-1">
          {userRatings.map((r) => (
            <div key={r.rating} className="flex items-center gap-2">
              <span className="text-[10px] font-mono w-4 text-right text-muted-foreground/60">{r.rating}</span>
              <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all"
                  style={{ width: `${Math.max(r.value, 0.5)}%` }}
                />
              </div>
              <span className="text-[10px] font-mono w-10 text-right text-muted-foreground">{r.value}%</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export function MovieWhereToWatch({ playingAt }: {
  playingAt: CinePointPlayingAt[];
}) {
  if (!playingAt.length) return null;
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-black uppercase tracking-[0.2em]">Where to Watch</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {playingAt.map((p) => (
          <a
            key={p.title}
            href={p.link}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors"
          >
            {p.image && (
              <img src={p.image} alt={p.title} className="w-8 h-8 rounded object-contain bg-muted/30" referrerPolicy="no-referrer" />
            )}
            <span className="text-sm font-medium">{p.title}</span>
            <ArrowUpRight className="w-3 h-3 text-muted-foreground/40 ml-auto" />
          </a>
        ))}
      </CardContent>
    </Card>
  );
}

export function MovieTrailerCard({ url }: { url: string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-black uppercase tracking-[0.2em] flex items-center gap-2">
          <Video className="w-4 h-4 text-red-500" /> Trailer
        </CardTitle>
      </CardHeader>
      <CardContent>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition-colors"
        >
          <Play className="w-4 h-4" />
          Watch on YouTube
          <ArrowUpRight className="w-3 h-3" />
        </a>
      </CardContent>
    </Card>
  );
}
