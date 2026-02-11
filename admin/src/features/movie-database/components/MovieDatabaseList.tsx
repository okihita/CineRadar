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
                    <div className="text-center py-8 text-muted-foreground">
                        <Film className="w-10 h-10 mx-auto mb-2 opacity-40" />
                        <p>No movies showing today</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 gap-1">
                        {uniqueNowShowing.map((movie) => {
                            // Calculate days showing (from movie.date to today)
                            const movieDate = new Date(movie.date);
                            const today = new Date(data.date);
                            const daysShowing = Math.floor((today.getTime() - movieDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;

                            return (
                                <Link
                                    key={movie.movie_id}
                                    href={`/movies/${movie.movie_id}`}
                                    className="group relative cursor-pointer"
                                >
                                    {/* Poster */}
                                    <div className="aspect-[2/3] relative overflow-hidden rounded-md bg-muted ring-1 ring-border hover:ring-2 hover:ring-primary transition-all mb-2">
                                        {movie.poster ? (
                                            <Image
                                                src={movie.poster}
                                                alt={movie.title}
                                                fill
                                                className="object-cover transition-transform duration-500 group-hover:scale-110"
                                                sizes="200px"
                                            />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                                                <Film className="w-8 h-8" />
                                            </div>
                                        )}

                                        {/* Presale Badge */}
                                        {movie.is_presale && (
                                            <div className="absolute top-0 left-0 bg-amber-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-br z-10">
                                                PRESALE
                                            </div>
                                        )}

                                        {/* Hover Overlay */}
                                        <div className="absolute inset-x-0 bottom-0 bg-black/80 backdrop-blur-sm text-white p-3 translate-y-full transition-transform duration-300 group-hover:translate-y-0">
                                            {/* Age Rating at top */}
                                            {movie.age_category && (
                                                <div className="mb-2">
                                                    <Badge variant="outline" className="text-[10px] bg-white/10 text-white border-white/30">
                                                        {movie.age_category}
                                                    </Badge>
                                                </div>
                                            )}
                                            {/* Genres at bottom */}
                                            <div className="flex flex-wrap gap-1">
                                                {movie.genres?.slice(0, 3).map((g) => (
                                                    <Badge key={g} variant="secondary" className="text-[10px] bg-white/20 text-white border-0">
                                                        {g}
                                                    </Badge>
                                                ))}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Title */}
                                    <h3 className="font-semibold text-sm leading-tight line-clamp-1 group-hover:text-primary transition-colors" title={movie.title}>
                                        {movie.title}
                                    </h3>
                                    {/* Showing duration */}
                                    <p className="text-[10px] text-muted-foreground font-normal">
                                        Showing for {daysShowing} {daysShowing === 1 ? 'day' : 'days'}
                                    </p>
                                </Link>
                            );
                        })}
                    </div>
                )}
            </section>

            {/* PAST MOVIES */}
            {pastMovies.length > 0 && (
                <section className="pt-4 border-t">
                    <button
                        onClick={() => setIsArchiveOpen(!isArchiveOpen)}
                        className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors w-full group"
                    >
                        <div className="p-1 rounded bg-muted group-hover:bg-muted/80">
                            {isArchiveOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                        </div>
                        <Archive className="w-4 h-4" />
                        <span className="font-medium text-sm">Past Movies</span>
                        <Badge variant="outline" className="ml-auto font-normal">{pastMovies.length}</Badge>
                    </button>

                    {isArchiveOpen && (
                        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-10 gap-3 mt-4 animate-in slide-in-from-top-2 duration-200">
                            {pastMovies.map((movie) => (
                                <Link
                                    key={movie.id}
                                    href={`/movies/${movie.movie_id || movie.id}`}
                                    className="group relative opacity-70 hover:opacity-100 transition"
                                >
                                    <div className="aspect-[2/3] w-full relative rounded-md overflow-hidden bg-muted">
                                        {movie.poster ? (
                                            <Image
                                                src={movie.poster}
                                                alt={movie.title}
                                                fill
                                                className="object-cover grayscale group-hover:grayscale-0 transition-all"
                                                sizes="150px"
                                            />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                                                <Film className="w-4 h-4" />
                                            </div>
                                        )}
                                    </div>
                                    <p className="text-xs font-medium truncate mt-1.5">{movie.title}</p>
                                    {movie.last_updated && (
                                        <p className="text-[10px] text-muted-foreground">
                                            Last updated: {new Date(movie.last_updated).toLocaleDateString()}
                                        </p>
                                    )}
                                </Link>
                            ))}
                        </div>
                    )}
                </section>
            )}
        </div>
    );
}
