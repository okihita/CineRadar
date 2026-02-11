/**
 * Performance Tab Component
 * 
 * Shows all movies with posters and today's performance summary.
 * Click a movie card to navigate to the detail page.
 */
'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Target, Trophy, Clapperboard, ChevronDown, ChevronRight, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import Image from 'next/image';
import { useRouter } from 'next/navigation';

interface TodayStats {
    date: string;
    total_showtimes: number;
    total_showtimes_scraped: number;
    avg_occupancy_pct: number;
    total_seats: number;
    total_sold: number;
    cities: string[];
}

interface MovieWithStats {
    id: string;
    movie_id: string;
    title: string;
    poster: string;
    last_updated: string;
    today?: TodayStats;
}

export function PerformanceTab() {
    const router = useRouter();
    const [movies, setMovies] = useState<MovieWithStats[]>([]);
    const [loadingMovies, setLoadingMovies] = useState(true);
    const [isArchiveOpen, setIsArchiveOpen] = useState(false);

    // 1. Fetch Movies List with today's stats
    useEffect(() => {
        async function fetchMovies() {
            try {
                const res = await fetch('/api/performance');
                const data = await res.json();
                if (data.success) {
                    setMovies(data.movies);
                } else {
                    console.error(data.error || 'Failed to load movies');
                }
            } catch (e) {
                console.error(String(e));
            } finally {
                setLoadingMovies(false);
            }
        }
        fetchMovies();
    }, []);

    // -------------------------------------------------------------------------
    // Tiered Logic
    // -------------------------------------------------------------------------
    const hasTodayStats = (m: MovieWithStats) => !!m.today && m.today.total_showtimes > 0;

    // Sort all by total_showtimes (desc) for meaningful start-of-day ranking
    const sortedMovies = [...movies].sort((a, b) => {
        const showsA = a.today?.total_showtimes || 0;
        const showsB = b.today?.total_showtimes || 0;
        return showsB - showsA;
    });

    // 1. Box Office Leaders (Top 5 active)
    const activeMovies = sortedMovies.filter(hasTodayStats);
    const leaders = activeMovies.slice(0, 5);
    const othersActive = activeMovies.slice(5);

    // 2. Archive (No shows today)
    const archiveMovies = sortedMovies.filter(m => !hasTodayStats(m));

    // Loading state
    if (loadingMovies) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                <span className="ml-2 text-muted-foreground">Loading movies...</span>
            </div>
        );
    }

    // Empty state
    if (movies.length === 0) {
        return (
            <Card>
                <CardContent className="pt-6 text-center">
                    <Target className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">No movies initialized yet.</p>
                </CardContent>
            </Card>
        );
    }

    const handleMovieClick = (movieId: string) => {
        router.push(`/performances/${movieId}`);
    };

    return (
        <div className="space-y-12 animate-in fade-in duration-500">

            {/* SECTION 1: BOX OFFICE LEADERS (Hero Cards) */}
            {leaders.length > 0 && (
                <section>
                    <div className="flex items-center gap-2 mb-4">
                        <Trophy className="w-5 h-5 text-amber-500" />
                        <h2 className="text-xl font-bold tracking-tight">Box Office Leaders</h2>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                        {leaders.map((movie, idx) => (
                            <div
                                key={movie.id}
                                className="group relative cursor-pointer"
                                onClick={() => handleMovieClick(movie.id)}
                            >
                                {/* Aspect Ratio Container */}
                                <div className="aspect-[2/3] relative overflow-hidden rounded-md bg-muted ring-1 ring-amber-500/20 hover:ring-2 hover:ring-amber-500 transition-all mb-2">
                                    {/* Rank Badge */}
                                    <div className="absolute top-0 left-0 bg-amber-500 text-white text-sm font-bold px-2.5 py-1 rounded-br shadow-sm z-10">
                                        #{idx + 1}
                                    </div>

                                    {/* Poster Image with Scale Effect */}
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
                                            <Target className="w-8 h-8" />
                                        </div>
                                    )}
                                </div>

                                {/* Title & Metrics (Below Image) */}
                                <div>
                                    <h3 className="font-semibold text-sm leading-tight mb-2 line-clamp-1 group-hover:text-amber-500 transition-colors" title={movie.title}>
                                        {movie.title}
                                    </h3>

                                    <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-xs">
                                        {/* Row 1: Scheduled vs Scraped */}
                                        <div className="flex flex-col">
                                            <span className="text-[10px] uppercase text-muted-foreground tracking-wider">Scheduled</span>
                                            <span className="font-mono font-medium">{movie.today?.total_showtimes}</span>
                                        </div>
                                        <div className="flex flex-col text-right">
                                            <span className="text-[10px] uppercase text-muted-foreground tracking-wider">Scraped</span>
                                            <span className={cn("font-mono font-medium",
                                                (movie.today?.total_showtimes_scraped || 0) < (movie.today?.total_showtimes || 0) ? "text-amber-600" : "text-green-600"
                                            )}>
                                                {movie.today?.total_showtimes_scraped}
                                            </span>
                                        </div>

                                        {/* Row 2: Tickets Sold (Full Width) */}
                                        <div className="col-span-2 flex flex-col pt-1 border-t border-border/50 mt-1">
                                            <div className="flex justify-between items-center">
                                                <span className="text-[10px] uppercase text-muted-foreground tracking-wider">Tickets Sold</span>
                                                <span className="font-mono font-bold">{movie.today?.total_sold.toLocaleString()}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>
            )}

            {/* SECTION 2: NOW SHOWING (Standard Grid) */}
            {othersActive.length > 0 && (
                <section>
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                            <Clapperboard className="w-5 h-5 text-primary" />
                            <h2 className="text-lg font-semibold">Now Showing</h2>
                        </div>
                        <span className="text-sm text-muted-foreground">{othersActive.length} movies</span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                        {othersActive.map((movie) => (
                            <div
                                key={movie.id}
                                className="group relative cursor-pointer overflow-hidden rounded-md bg-muted aspect-[2/3]"
                                onClick={() => handleMovieClick(movie.id)}
                            >
                                {/* Poster Image with Scale Effect */}
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
                                        <Target className="w-8 h-8" />
                                    </div>
                                )}

                                {/* Hover Overlay Sheet */}
                                <div className="absolute inset-x-0 bottom-0 bg-black/80 backdrop-blur-sm text-white p-3 translate-y-full transition-transform duration-300 group-hover:translate-y-0">
                                    <h3 className="font-semibold text-sm leading-tight mb-2 line-clamp-2" title={movie.title}>
                                        {movie.title}
                                    </h3>
                                    <div className="grid grid-cols-2 gap-2 text-xs text-white/80">
                                        <div>
                                            <div className="text-[10px] uppercase tracking-wider text-white/50">Shows</div>
                                            <div className="font-mono font-medium">{movie.today?.total_showtimes}</div>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-[10px] uppercase tracking-wider text-white/50">Sold</div>
                                            <div className="font-mono font-medium">{movie.today?.total_sold.toLocaleString()}</div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>
            )}

            {/* SECTION 3: ARCHIVE (Hidden by default) */}
            {archiveMovies.length > 0 && (
                <section className="pt-4 border-t">
                    <button
                        onClick={() => setIsArchiveOpen(!isArchiveOpen)}
                        className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors w-full group"
                    >
                        <div className="p-1 rounded bg-muted group-hover:bg-muted/80">
                            {isArchiveOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                        </div>
                        <span className="font-medium text-sm">Past Movies / No Data Today</span>
                        <Badge variant="outline" className="ml-auto font-normal">{archiveMovies.length}</Badge>
                    </button>

                    {isArchiveOpen && (
                        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 mt-4 animate-in slide-in-from-top-2 duration-200">
                            {archiveMovies.map((movie) => (
                                <div
                                    key={movie.id}
                                    className="cursor-pointer group relative opacity-70 hover:opacity-100 transition"
                                    onClick={() => handleMovieClick(movie.id)}
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
                                                <Target className="w-4 h-4" />
                                            </div>
                                        )}
                                    </div>
                                    <p className="text-xs font-medium truncate mt-1.5">{movie.title}</p>
                                    <p className="text-[10px] text-muted-foreground">Last updated: {new Date(movie.last_updated).toLocaleDateString()}</p>
                                </div>
                            ))}
                        </div>
                    )}
                </section>
            )}
        </div>
    );
}
