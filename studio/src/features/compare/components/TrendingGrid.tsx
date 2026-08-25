import Image from 'next/image';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { X, GitCompare, Flame, TrendingUp } from 'lucide-react';
import { TrendingMovie, abbreviateTitle } from '../types';

interface TrendingGridProps {
    trendingMovies: TrendingMovie[];
    isLoading: boolean;
    error: Error | undefined;
    onAddMovie: (movie: TrendingMovie) => void;
    onCompareTop: (count: number) => void;
}

export function TrendingGrid({ trendingMovies, isLoading, error, onAddMovie, onCompareTop }: TrendingGridProps) {
    return (
        <div className="space-y-8 animate-in fade-in duration-700">
            {/* Hero + Quick Actions */}
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-4 bg-muted/5 border-2 border-dashed rounded-xl border-primary/20">
                <GitCompare className="w-16 h-16 opacity-20 text-primary" />
                <div className="text-center">
                    <h3 className="text-xl font-bold text-foreground">Discover Market Battles</h3>
                    <p className="max-w-md mx-auto text-muted-foreground mt-2">
                        Compare the latest blockbusters and tracking their performance across the archipelago.
                    </p>
                </div>

                {/* Quick Actions */}
                <div className="flex flex-wrap items-center justify-center gap-3 mt-4">
                    <Button
                        variant="default"
                        className="shadow-lg shadow-primary/20 font-bold"
                        disabled={isLoading || trendingMovies.length < 2}
                        onClick={() => onCompareTop(2)}
                    >
                        <Flame className="w-4 h-4 mr-2" />
                        Top 2 Leaders
                    </Button>
                    <Button
                        variant="secondary"
                        className="font-bold"
                        disabled={isLoading || trendingMovies.length < 3}
                        onClick={() => onCompareTop(3)}
                    >
                        <TrendingUp className="w-4 h-4 mr-2" />
                        Top 3 Contenders
                    </Button>
                    <Button
                        variant="secondary"
                        className="font-bold"
                        disabled={isLoading || trendingMovies.length < 5}
                        onClick={() => onCompareTop(5)}
                    >
                        <GitCompare className="w-4 h-4 mr-2" />
                        Top 5 Battles
                    </Button>
                    <Button
                        variant="secondary"
                        className="font-bold"
                        disabled={isLoading || trendingMovies.length < 8}
                        onClick={() => onCompareTop(8)}
                    >
                        <TrendingUp className="w-4 h-4 mr-2" />
                        All 8 Leaders
                    </Button>
                </div>
            </div>

            {/* Trending Grid */}
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <h3 className="text-lg font-bold flex items-center gap-2">
                        <Flame className="w-4 h-4 text-primary" /> Today&apos;s Market Leaders
                    </h3>
                    <span className="text-xs text-muted-foreground uppercase tracking-widest font-mono">
                        Sorted by Tickets Sold
                    </span>
                </div>

                {error ? (
                    <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2">
                        <X className="w-6 h-6 text-destructive" />
                        <p className="text-sm">Failed to load trending movies. Please try again later.</p>
                    </div>
                ) : isLoading ? (
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
                        {[...Array(8)].map((_, i) => (
                            <div key={i} className="space-y-3 animate-pulse">
                                <div className="aspect-[2/3] bg-muted rounded-lg" />
                                <div className="h-4 bg-muted rounded w-3/4 mx-auto" />
                                <div className="h-3 bg-muted rounded w-1/2 mx-auto" />
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
                        {trendingMovies.map((movie) => (
                            <Card
                                key={movie.id}
                                className="group cursor-pointer overflow-hidden hover:ring-2 hover:ring-primary transition-all duration-300 shadow-sm hover:shadow-xl"
                                onClick={() => onAddMovie(movie)}
                            >
                                <div className="relative aspect-[2/3]">
                                    {movie.poster ? (
                                        <Image
                                            src={movie.poster}
                                            alt={movie.title}
                                            fill
                                            className="object-cover transition-transform duration-500 group-hover:scale-110"
                                            sizes="(max-width: 768px) 50vw, (max-width: 1024px) 25vw, 12vw"
                                        />
                                    ) : (
                                        <div className="w-full h-full bg-muted flex items-center justify-center text-xs text-muted-foreground">
                                            No Poster
                                        </div>
                                    )}
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-2">
                                        <span className="text-[10px] text-white font-bold uppercase">Add to Compare</span>
                                    </div>
                                </div>
                                <CardContent className="p-2 space-y-2">
                                    <div className="font-bold text-[13px] leading-tight truncate" title={movie.title}>
                                        {abbreviateTitle(movie.title)}
                                    </div>
                                    <div className="flex flex-col gap-1">
                                        <div className="flex items-center justify-between">
                                            <span className="text-[10px] text-muted-foreground">Tickets</span>
                                            <span className="text-[11px] font-bold text-primary">{(movie.today?.total_sold || 0).toLocaleString()}</span>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <span className="text-[10px] text-muted-foreground">Shows</span>
                                            <span className="text-[11px] font-bold">{(movie.today?.total_showtimes || 0).toLocaleString()}</span>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
