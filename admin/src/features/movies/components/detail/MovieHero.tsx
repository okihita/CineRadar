'use client';

import React from 'react';
import Image from 'next/image';
import { Film } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { formatRelativeWIB } from '@/lib/timeUtils';

interface MovieHeroProps {
    movie: Record<string, unknown>;
    movieId: string;
}

export function MovieHero({ movie, movieId }: MovieHeroProps) {
    const title = (movie.title as string) || (movie.name as string) || `Movie ${movieId}`;
    const poster = (movie.poster_path as string) || (movie.poster as string);
    const status = typeof movie.status === 'string' ? movie.status : null;
    const synopsis = typeof movie.synopsis === 'string' ? movie.synopsis : typeof movie.information === 'string' ? movie.information : null;
    const duration = typeof movie.duration === 'number' ? movie.duration : null;
    const scrapedAt = typeof movie.scraped_at === 'string' ? movie.scraped_at : null;

    // Format release date
    const releaseDate = movie.release_date;
    let formattedReleaseDate = null;

    if (releaseDate) {
        let date: Date;
        if (typeof releaseDate === 'number') {
            date = releaseDate < 10000000000
                ? new Date(releaseDate * 1000)
                : new Date(releaseDate);
        } else {
            date = new Date(releaseDate as string);
        }

        formattedReleaseDate = date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    }

    const renderBadges = () => {
        const badges: React.ReactNode[] = [];

        // Genre badges
        if (movie.genres && Array.isArray(movie.genres)) {
            const genres = movie.genres as Array<string | { name?: string; id?: number }>;
            genres.forEach((g, idx) => {
                const genreName = typeof g === 'string' ? g : (g.name || String(g));
                badges.push(
                    <Badge key={`genre-${idx}-${genreName}`} variant="secondary">{genreName}</Badge>
                );
            });
        }

        // Age category badge
        if (movie.age_category) {
            badges.push(
                <Badge key="age-category" variant="outline">{String(movie.age_category)}</Badge>
            );
        }

        // Presale badge
        if (movie.is_presale) {
            badges.push(
                <Badge key="presale" className="bg-amber-500 text-white">PRESALE</Badge>
            );
        }

        return <>{badges}</>;
    };

    return (
        <div className="flex flex-col md:flex-row gap-8 mb-10">
            {/* Poster */}
            <div className="w-56 flex-shrink-0">
                <div className="aspect-[2/3] relative rounded-lg overflow-hidden bg-muted border border-border shadow-sm">
                    {poster ? (
                        <Image
                            src={poster}
                            alt={title}
                            fill
                            className="object-cover"
                            sizes="250px"
                            priority
                        />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center text-muted-foreground bg-muted/30">
                            <Film className="w-12 h-12 opacity-20" />
                        </div>
                    )}
                </div>
            </div>

            {/* Title & Info */}
            <div className="flex-1">
                <h1 className="text-4xl font-bold tracking-tight mb-3 text-foreground/90">{title}</h1>

                {/* Release Date & Duration & ID & Status & Last Update */}
                <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground mb-6 font-medium">
                    {formattedReleaseDate && <span>{formattedReleaseDate}</span>}
                    {duration != null && <span>• {duration} min</span>}
                    <span className="flex items-center gap-1.5 ml-1">
                        <span className="text-xs bg-muted/50 px-2 py-0.5 rounded border border-border/50 font-mono select-all text-foreground/70">
                            {movieId}
                        </span>
                    </span>

                    {/* Status */}
                    {status && (
                        <Badge variant="outline" className="ml-1 border-primary/20 text-primary bg-primary/5 rounded-sm shadow-none">
                            {status}
                        </Badge>
                    )}

                    {/* Last Scraped */}
                    {scrapedAt && (
                        <span className="text-[11px] ml-1 flex items-center gap-1.5 text-muted-foreground/80 font-mono" title={scrapedAt}>
                            <span className="w-1.5 h-1.5 rounded-full bg-green-500/80 inline-block shadow-[0_0_4px_rgba(34,197,94,0.4)]"></span>
                            Updated {formatRelativeWIB(scrapedAt)}
                        </span>
                    )}
                </div>

                {/* Quick badges */}
                <div className="flex flex-wrap gap-2 mb-6">
                    {renderBadges()}
                </div>

                {/* Synopsis */}
                {synopsis && (
                    <div className="prose prose-sm dark:prose-invert max-w-3xl">
                        <p className="text-muted-foreground leading-relaxed text-[15px]">
                            {synopsis}
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}
