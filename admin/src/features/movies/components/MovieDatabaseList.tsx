/**
 * Movie Database List Component
 *
 * Shows movies split into "Now Showing" (from today's schedules)
 * and "Past Movies" (from movie_performance, not showing today).
 */
'use client';

import { useState } from 'react';
import useSWR from 'swr';
import Image from 'next/image';
import Link from 'next/link';
import { Loader2, Clapperboard, Archive, ChevronDown, ChevronRight, Film, AlertCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

interface ScheduleMovie {
    id: string;
    movie_id: string;
    title: string;
    poster: string;
    genres: string[];
    age_category: string;
    merchants: string[];
    is_presale: boolean;
    date: string;
    cities: Record<string, unknown>;
}

interface PastMovie {
    id: string;
    movie_id: string;
    title: string;
    poster: string;
    last_updated: string;
}

interface MovieDatabaseResponse {
    success: boolean;
    date: string;
    now_showing: ScheduleMovie[];
    past_movies: PastMovie[];
    error?: string;
}

export function MovieDatabaseList() {
    const [isArchiveOpen, setIsArchiveOpen] = useState(false);

    const { data, error, isLoading } = useSWR<MovieDatabaseResponse>(
        '/api/movies',
        fetcher
    );

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                <span className="ml-2 text-muted-foreground">Loading movies...</span>
            </div>
        );
    }

    if (error || !data?.success) {
        return (
            <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>
                    Failed to load movies: {data?.error || String(error)}
                </AlertDescription>
            </Alert>
        );
    }

    const nowShowing = data.now_showing || [];
    const pastMovies = data.past_movies || [];

    // Deduplicate now_showing by movie_id
    const uniqueNowShowing = Array.from(
        new Map(nowShowing.map((m) => [m.movie_id, m])).values()
    );

    return (
        <div className="space-y-10 animate-in fade-in duration-500">
            {/* NOW SHOWING */}
            <section>
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                        <Clapperboard className="w-5 h-5 text-primary" />
                        <h2 className="text-xl font-bold tracking-tight">
                            Now Showing · {data.date}
                        </h2>
                    </div>
                    <span className="text-sm text-muted-foreground">
                        {uniqueNowShowing.length} movies
                    </span>
                </div>

                {uniqueNowShowing.length === 0 ? (
                    <div className="text-center py-8 bg-muted/20 border border-border rounded-lg text-muted-foreground">
                        <Film className="w-8 h-8 mx-auto mb-2 opacity-40" />
                        <p className="text-sm">No movies showing today</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 gap-4">
                        {uniqueNowShowing.map((movie) => {
                            // Calculate days showing (from movie.date to today)
                            const movieDate = new Date(movie.date);
                            const today = new Date(data.date);
                            const daysShowing = Math.floor((today.getTime() - movieDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;

                            return (
                                <Link
                                    key={movie.movie_id}
                                    href={`/movies/${movie.movie_id}`}
                                    className="group flex flex-col cursor-pointer bg-card border border-border rounded-lg overflow-hidden hover:border-primary/50 transition-colors"
                                >
                                    {/* Poster */}
                                    <div className="aspect-[2/3] relative bg-muted border-b border-border">
                                        {movie.poster ? (
                                            <Image
                                                src={movie.poster}
                                                alt={movie.title}
                                                fill
                                                className="object-cover"
                                                sizes="(max-width: 768px) 50vw, (max-width: 1200px) 25vw, 15vw"
                                            />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                                                <Film className="w-8 h-8 opacity-20" />
                                            </div>
                                        )}

                                        {/* Presale Badge */}
                                        {movie.is_presale && (
                                            <div className="absolute top-2 left-2 bg-amber-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded shadow-sm">
                                                PRESALE
                                            </div>
                                        )}
                                        {/* Age Rating Badge */}
                                        {movie.age_category && (
                                            <div className="absolute top-2 right-2 bg-background/90 text-foreground border border-border text-[9px] font-bold px-1.5 py-0.5 rounded">
                                                {movie.age_category}
                                            </div>
                                        )}
                                    </div>

                                    {/* Content */}
                                    <div className="p-3 flex flex-col flex-1 group-hover:bg-muted/30 transition-colors">
                                        <h3 className="font-semibold text-xs leading-tight line-clamp-2 mb-1 group-hover:text-primary transition-colors" title={movie.title}>
                                            {movie.title}
                                        </h3>

                                        <div className="mt-auto">
                                            {/* Genres */}
                                            {movie.genres && movie.genres.length > 0 && (
                                                <div className="flex flex-wrap gap-1 mb-1.5">
                                                    {movie.genres.slice(0, 2).map((g) => (
                                                        <span key={g} className="text-[9px] px-1 py-0.5 bg-muted rounded text-muted-foreground truncate max-w-full">
                                                            {g}
                                                        </span>
                                                    ))}
                                                </div>
                                            )}

                                            {/* Showing duration */}
                                            <p className="text-[10px] text-muted-foreground font-medium">
                                                Showing {daysShowing} {daysShowing === 1 ? 'day' : 'days'}
                                            </p>
                                        </div>
                                    </div>
                                </Link>
                            );
                        })}
                    </div>
                )}
            </section>

            {/* PAST MOVIES */}
            {pastMovies.length > 0 && (
                <section className="pt-6 border-t border-border">
                    <button
                        onClick={() => setIsArchiveOpen(!isArchiveOpen)}
                        className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors w-full group"
                    >
                        <div className="p-1 rounded bg-muted/50 border border-transparent group-hover:border-border transition-colors">
                            {isArchiveOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                        </div>
                        <Archive className="w-4 h-4" />
                        <span className="font-medium text-sm">Past Movies</span>
                        <div className="ml-auto text-xs font-mono bg-muted px-2 py-0.5 rounded border border-border">
                            {pastMovies.length}
                        </div>
                    </button>

                    {isArchiveOpen && (
                        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 gap-3 mt-4 animate-in fade-in slide-in-from-top-2 duration-200">
                            {pastMovies.map((movie) => (
                                <Link
                                    key={movie.id}
                                    href={`/movies/${movie.movie_id || movie.id}`}
                                    className="group flex flex-col bg-card border border-border rounded-lg overflow-hidden hover:border-primary/50 transition-colors opacity-70 hover:opacity-100"
                                >
                                    <div className="aspect-[2/3] w-full relative bg-muted border-b border-border">
                                        {movie.poster ? (
                                            <Image
                                                src={movie.poster}
                                                alt={movie.title}
                                                fill
                                                className="object-cover grayscale group-hover:grayscale-0 transition-all duration-300"
                                                sizes="(max-width: 768px) 50vw, (max-width: 1200px) 25vw, 10vw"
                                            />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                                                <Film className="w-6 h-6 opacity-20" />
                                            </div>
                                        )}
                                    </div>
                                    <div className="p-2 group-hover:bg-muted/30 transition-colors flex-1 flex flex-col">
                                        <p className="text-[11px] font-semibold line-clamp-2 leading-tight group-hover:text-primary transition-colors">{movie.title}</p>
                                        {movie.last_updated && (
                                            <p className="text-[9px] text-muted-foreground mt-auto pt-1">
                                                {new Date(movie.last_updated).toLocaleDateString()}
                                            </p>
                                        )}
                                    </div>
                                </Link>
                            ))}
                        </div>
                    )}
                </section>
            )}
        </div>
    );
}
