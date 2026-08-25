'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Clock, Eye, Languages } from 'lucide-react';
import type { CinePointMovie } from '@/features/competitors/types';
import { extractCrew, MovieSynopsis, MovieCastCrew, MovieAudienceRating, MovieWhereToWatch, MovieTrailerCard } from '@/components/cinepoint/MovieDetailSections';

export function MovieDetailPanel({ movie }: { movie: CinePointMovie }) {
  const { casts, directors, producers, writers, userRatings, topRating } = extractCrew(movie);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div className="lg:col-span-2 space-y-4">
        <MovieSynopsis description={movie.description} />
        <MovieCastCrew casts={casts} directors={directors} writers={writers} producers={producers} />
        {movie.trailer_url && <MovieTrailerCard url={movie.trailer_url} />}
      </div>
      <div className="space-y-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-black uppercase tracking-[0.2em]">Movie Info</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {movie.language && (
              <div className="flex items-center gap-2">
                <Languages className="w-4 h-4 text-muted-foreground/60" />
                <span className="text-xs text-muted-foreground">Language</span>
                <span className="text-sm font-medium ml-auto">{movie.language}</span>
              </div>
            )}
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-muted-foreground/60" />
              <span className="text-xs text-muted-foreground">Duration</span>
              <span className="text-sm font-medium ml-auto">{movie.duration || '?'} min</span>
            </div>
            {movie.rating_category && movie.rating_category.length > 0 && (
              <div className="flex items-center gap-2">
                <Eye className="w-4 h-4 text-muted-foreground/60" />
                <span className="text-xs text-muted-foreground">Rating</span>
                <Badge variant="outline" className="ml-auto text-xs border-red-500/30 text-red-600">{movie.rating_category[0]}</Badge>
              </div>
            )}
            {movie.movie_rating && (movie.movie_rating.imdb || movie.movie_rating.rotten_tomatoes) && (
              <div className="flex items-center gap-2 pt-2 border-t">
                <span className="text-xs font-bold text-amber-600">IMDb</span>
                <span className="text-sm font-mono ml-1">{movie.movie_rating.imdb ?? '—'}</span>
                <span className="text-xs font-bold text-red-600 ml-auto">RT</span>
                <span className="text-sm font-mono ml-1">{movie.movie_rating.rotten_tomatoes != null ? `${movie.movie_rating.rotten_tomatoes}%` : '—'}</span>
              </div>
            )}
            {movie.movie_genre && movie.movie_genre.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-2 border-t">
                {movie.movie_genre.map((g) => (<Badge key={g} variant="secondary" className="text-[10px]">{g}</Badge>))}
              </div>
            )}
          </CardContent>
        </Card>
        <MovieAudienceRating score={movie.score} userRatings={userRatings} topRating={topRating} />
        <MovieWhereToWatch playingAt={movie.playing_at ?? []} />
        {movie.similar_movies && movie.similar_movies.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-black uppercase tracking-[0.2em]">Similar Movies</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {movie.similar_movies.map((sm) => (
                <div key={sm.id} className="space-y-1">
                  <p className="text-sm font-medium">{sm.title}</p>
                  <p className="text-[11px] text-muted-foreground/60 line-clamp-2">{sm.description}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

export function MetaChip({ icon, value, className }: { icon: React.ReactNode; value: string; className?: string }) {
  return (
    <div className={`flex items-center gap-1 text-[10px] text-muted-foreground ${className ?? ''}`}>
      {icon}
      <span className="font-medium">{value}</span>
    </div>
  );
}
