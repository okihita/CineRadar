/**
 * Movie Database Detail Component
 *
 * Displays all data from a Firestore /movies/{id} document.
 */
'use client';

import React from 'react';
import useSWR from 'swr';
import Image from 'next/image';
import Link from 'next/link';
import { Loader2, ArrowLeft, Film, AlertCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { formatRelativeWIB } from '@/lib/timeUtils';

import { fetcher } from '@/lib/api';
import type { MovieDetailResponse } from '../types';

// Render a value in a human-readable way
function renderValue(value: unknown, depth = 0): React.ReactNode {
    if (value === null || value === undefined) {
        return <span className="text-muted-foreground italic">null</span>;
    }

    if (typeof value === 'boolean') {
        return (
            <Badge variant={value ? 'default' : 'outline'}>
                {value ? 'Yes' : 'No'}
            </Badge>
        );
    }

    if (typeof value === 'number') {
        return <span className="font-mono">{value.toLocaleString()}</span>;
    }

    if (typeof value === 'string') {
        // Check if it looks like a URL
        if (value.startsWith('http')) {
            return (
                <a href={value} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline break-all text-sm">
                    {value}
                </a>
            );
        }
        return <span className="text-sm">{value}</span>;
    }

    if (Array.isArray(value)) {
        if (value.length === 0) {
            return <span className="text-muted-foreground italic text-sm">empty</span>;
        }
        // Simple array of primitives
        if (value.every((v) => typeof v === 'string' || typeof v === 'number')) {
            return (
                <div className="flex flex-wrap gap-1.5">
                    {value.map((v, i) => (
                        <Badge key={i} variant="secondary" className="font-normal">
                            {String(v)}
                        </Badge>
                    ))}
                </div>
            );
        }
        // Complex array
        return (
            <div className="space-y-2 pl-4 border-l-2 border-border">
                {value.map((v, i) => (
                    <div key={i} className="text-sm">
                        <span className="text-muted-foreground text-xs mr-2">[{i}]</span>
                        {renderValue(v, depth + 1)}
                    </div>
                ))}
            </div>
        );
    }

    if (typeof value === 'object') {
        const obj = value as Record<string, unknown>;
        const entries = Object.entries(obj);

        // Special case: `rating_score` object from TIX.id
        if (entries.length > 0 && obj.vote_average !== undefined) {
            return (
                <div className="flex items-center gap-2">
                    <Badge className="bg-amber-500 font-bold hover:bg-amber-600 shadow-none border-transparent">
                        ★ {Number(obj.vote_average).toFixed(1)}
                    </Badge>
                    <span className="text-xs text-muted-foreground font-medium">({(obj.vote_count as number) || 0} votes)</span>
                </div>
            );
        }

        // Special case: `trailer` object from TIX.id
        if (obj.path && typeof obj.path === 'string' && obj.path.includes('youtu')) {
            return (
                <a href={obj.path} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm font-medium text-red-500 hover:text-red-600 transition-colors">
                    ▶ Watch Trailer
                </a>
            );
        }

        if (depth > 2) {
            return <pre className="text-xs bg-muted p-2 rounded overflow-auto border border-border">{JSON.stringify(value, null, 2)}</pre>;
        }
        return (
            <div className="space-y-2 pl-3 border-l-[3px] border-muted">
                {entries.map(([key, val]) => (
                    <div key={key}>
                        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{key}</span>
                        <div className="mt-0.5">{renderValue(val, depth + 1)}</div>
                    </div>
                ))}
            </div>
        );
    }

    return <span>{String(value)}</span>;
}

export function MovieDatabaseDetail({ movieId }: { movieId: string }) {
    const { data, error, isLoading } = useSWR<MovieDetailResponse>(
        `/api/movies/${movieId}`,
        fetcher
    );

    if (isLoading) {
        return (
            <div className="min-h-screen bg-background text-foreground p-6">
                <div className="flex items-center justify-center py-20">
                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                    <span className="ml-2 text-muted-foreground font-medium">Loading movie...</span>
                </div>
            </div>
        );
    }

    if (error || !data?.success || !data.movie) {
        return (
            <div className="min-h-screen bg-background text-foreground p-6">
                <Link href="/movies" className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground mb-6 transition-colors">
                    <ArrowLeft className="w-4 h-4" /> Back to Movie Database
                </Link>
                <Alert variant="destructive" className="border-destructive/50 shadow-none rounded-none border-l-4">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Error</AlertTitle>
                    <AlertDescription>
                        {data?.error || 'Movie not found'}
                    </AlertDescription>
                </Alert>
            </div>
        );
    }

    const movie = data.movie;
    const title = (movie.title as string) || (movie.name as string) || `Movie ${movieId}`;

    // Use poster_path if available, fallback to poster
    const posterPath = (movie.poster_path as string) || (movie.poster as string);
    const poster = posterPath;

    // Field mapping for human-readable labels
    const fieldLabels: Record<string, string> = {
        movie_id: 'Movie ID',
        title: 'Title',
        original_title: 'Original Title',
        synopsis: 'Synopsis',
        duration: 'Duration',
        release_date: 'Release Date',
        age_category: 'Age Rating',
        genres: 'Genres',
        directors: 'Directors',
        director: 'Director',
        cast: 'Cast',
        actor: 'Actor',
        producers: 'Producers',
        producer: 'Producer',
        writers: 'Writers',
        production_companies: 'Production Companies',
        production_company: 'Production Company',
        distributors: 'Distributors',
        countries: 'Countries',
        country: 'Country',
        languages: 'Languages',
        rating: 'Rating',
        rating_score: 'Rating Score',
        vote_count: 'Vote Count',
        popularity: 'Popularity',
        budget: 'Budget',
        revenue: 'Revenue',
        poster: 'Poster URL',
        backdrop: 'Backdrop URL',
        trailer: 'Trailer',
        trailer_path: 'Trailer Source URL',
        website: 'Official Website',
        imdb_id: 'IMDb ID',
        tmdb_id: 'TMDb ID',
        is_presale: 'Presale',
        presale_flag: 'Presale Flag',
        uploaded_at: 'Uploaded At',
        last_updated: 'Last Updated',
        created_at: 'Created At',
        updated_at: 'Updated At',
    };

    // Organize fields into sections
    const overviewFields = ['rating', 'rating_score', 'vote_count', 'popularity'];
    const technicalFields = ['original_title', 'directors', 'director', 'producers', 'producer', 'writers'];
    const distributionFields = ['production_companies', 'production_company', 'distributors', 'countries', 'country', 'languages'];
    const metadataFields = ['movie_id', 'imdb_id', 'tmdb_id', 'uploaded_at', 'last_updated', 'created_at', 'updated_at'];

    // Extracted out complex object fields so they don't break the generic renderer layout
    const excludeFields = ['title', 'name', 'poster', 'poster_path', 'id', 'genres', 'age_category', 'is_presale', 'presale_flag', 'casts', 'cast', 'actor', 'release_date', 'duration', 'synopsis', 'scraped_at', 'status', 'videos', 'images', 'information', 'trailer_thumbnail_path'];

    const getFieldsForSection = (fieldList: string[]) => {
        return Object.entries(movie)
            .filter(([key]) => fieldList.includes(key) && movie[key] !== '' && movie[key] !== null)
            .map(([key, value]) => ({ key, value, label: fieldLabels[key] || key }));
    };

    const otherFields = Object.entries(movie)
        .filter(([key]) =>
            !overviewFields.includes(key) &&
            !technicalFields.includes(key) &&
            !distributionFields.includes(key) &&
            !metadataFields.includes(key) &&
            !excludeFields.includes(key) &&
            movie[key] !== '' &&
            movie[key] !== null
        )
        .map(([key, value]) => ({ key, value, label: fieldLabels[key] || key }));

    const overview = getFieldsForSection(overviewFields);
    const technical = getFieldsForSection(technicalFields);
    const distribution = getFieldsForSection(distributionFields);
    const metadata = getFieldsForSection(metadataFields);

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

    const renderSection = (title: string, fields: Array<{ key: string; value: unknown; label: string }>) => {
        if (fields.length === 0) return null;
        return (
            <div className="mb-6 last:mb-0">
                {title && <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-4">{title}</h3>}
                <div className="space-y-4">
                    {fields.map(({ key, value, label }) => (
                        <div key={key} className="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-4 border-b border-border/50 pb-3 last:border-0 last:pb-0">
                            <div className="font-semibold text-sm sm:w-[160px] flex-shrink-0 text-foreground/80">{label}</div>
                            <div className="flex-1 text-sm">{renderValue(value)}</div>
                        </div>
                    ))}
                </div>
            </div>
        );
    };

    // Render all badges
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
        <div className="min-h-screen bg-background text-foreground p-6">
            {/* Back link */}
            <Link href="/movies" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors">
                <ArrowLeft className="w-4 h-4" /> Back to Movie Database
            </Link>

            {/* Hero Section */}
            {/* Hero Section */}
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
                        {formattedReleaseDate ? (
                            <span>{formattedReleaseDate}</span>
                        ) : null}
                        {movie.duration ? (
                            <span>• {movie.duration as number} min</span>
                        ) : null}
                        <span className="flex items-center gap-1.5 ml-1">
                            <span className="text-xs bg-muted/50 px-2 py-0.5 rounded border border-border/50 font-mono select-all text-foreground/70">
                                {movieId}
                            </span>
                        </span>

                        {/* Status */}
                        {movie.status ? (
                            <Badge variant="outline" className="ml-1 border-primary/20 text-primary bg-primary/5 rounded-sm shadow-none">
                                {movie.status as string}
                            </Badge>
                        ) : null}

                        {/* Last Scraped */}
                        {movie.scraped_at ? (
                            <span className="text-[11px] ml-1 flex items-center gap-1.5 text-muted-foreground/80 font-mono" title={String(movie.scraped_at)}>
                                <span className="w-1.5 h-1.5 rounded-full bg-green-500/80 inline-block shadow-[0_0_4px_rgba(34,197,94,0.4)]"></span>
                                Updated {formatRelativeWIB(movie.scraped_at as string)}
                            </span>
                        ) : null}
                    </div>

                    {/* Quick badges */}
                    <div className="flex flex-wrap gap-2 mb-6">
                        {renderBadges()}
                    </div>

                    {/* Synopsis (If available, show prominently below title) */}
                    {(movie.synopsis || movie.information) && (
                        <div className="prose prose-sm dark:prose-invert max-w-3xl">
                            <p className="text-muted-foreground leading-relaxed text-[15px]">
                                {(movie.synopsis as string) || (movie.information as string)}
                            </p>
                        </div>
                    )}
                </div>
            </div>

            {/* Structured Content Grid */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

                {/* Left Column (Main Content) */}
                <div className="xl:col-span-2 space-y-6">
                    {/* Cast Section */}
                    {(Array.isArray(movie.casts) || typeof movie.actor === 'string') && (
                        <Card className="rounded border-border shadow-none">
                            <CardHeader className="pb-3 border-b border-border/50 bg-muted/20">
                                <CardTitle className="text-sm font-semibold tracking-tight">Cast & Crew</CardTitle>
                            </CardHeader>
                            <CardContent className="pt-6">
                                {Array.isArray(movie.casts) && movie.casts.length > 0 ? (
                                    <div className="flex gap-4 overflow-x-auto pb-2 custom-scrollbar">
                                        {(movie.casts as Record<string, unknown>[]).map((cast, idx: number) => {
                                            const actorName = (cast.name as string) || (cast.actor_name as string) || 'Unknown';
                                            const characterName = (cast.character as string) || (cast.role as string) || '';
                                            const castType = (cast.cast_type as string) || '';
                                            let profilePath = (cast.profile_photo as string) || '';

                                            // Determine correct image URL
                                            if (profilePath && profilePath.startsWith('/')) {
                                                profilePath = `https://image.tmdb.org/t/p/w185${profilePath}`;
                                            }

                                            return (
                                                <div key={idx} className="flex-shrink-0 w-28 group">
                                                    <div className="aspect-[2/3] relative rounded overflow-hidden bg-muted/30 border border-border/50 mb-2.5 transition-colors group-hover:border-primary/30">
                                                        {profilePath ? (
                                                            <Image
                                                                src={profilePath}
                                                                alt={actorName}
                                                                fill
                                                                className="object-cover transition-transform duration-500 group-hover:scale-105"
                                                                sizes="112px"
                                                                unoptimized
                                                            />
                                                        ) : (
                                                            <div className="w-full h-full flex items-center justify-center text-muted-foreground/30">
                                                                <Film className="w-6 h-6" />
                                                            </div>
                                                        )}
                                                    </div>
                                                    <p className="font-semibold text-[13px] leading-tight line-clamp-2 mb-1 text-foreground/90 group-hover:text-primary transition-colors" title={actorName}>
                                                        {actorName}
                                                    </p>
                                                    {(characterName || castType) && (
                                                        <p className="text-[11px] text-muted-foreground line-clamp-2 leading-snug" title={characterName || castType}>
                                                            {characterName || castType}
                                                        </p>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <div className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
                                        {movie.actor as string}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    )}

                    {/* Media / Trailers */}
                    {Array.isArray(movie.videos) && movie.videos.length > 0 && (
                        <Card className="rounded border-border shadow-none">
                            <CardHeader className="pb-3 border-b border-border/50 bg-muted/20">
                                <CardTitle className="text-sm font-semibold tracking-tight">Media & Videos</CardTitle>
                            </CardHeader>
                            <CardContent className="pt-6">
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {(movie.videos as Record<string, unknown>[]).map((video, idx: number) => {
                                        const path = (video.path as string) || '';
                                        const title = (video.title as string) || 'Video';
                                        const thumbnail = (video.thumbnail as string) || '';

                                        if (!path) return null;

                                        return (
                                            <a key={idx} href={path} target="_blank" rel="noopener noreferrer" className="group block border border-border rounded overflow-hidden hover:border-primary/50 transition-colors">
                                                <div className="aspect-video relative bg-muted flex items-center justify-center">
                                                    {thumbnail ? (
                                                        <Image src={thumbnail} alt={title} fill className="object-cover opacity-80 group-hover:opacity-100 transition-opacity" unoptimized />
                                                    ) : (
                                                        <Film className="w-8 h-8 opacity-20" />
                                                    )}
                                                    <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-transparent transition-colors">
                                                        <div className="w-10 h-10 rounded-full bg-red-600/90 text-white flex items-center justify-center shadow-lg transform group-hover:scale-110 transition-transform">
                                                            ▶
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="p-3 bg-card border-t border-border group-hover:bg-muted/30 transition-colors">
                                                    <p className="text-xs font-medium line-clamp-2 text-foreground/80 leading-tight">{title}</p>
                                                </div>
                                            </a>
                                        );
                                    })}
                                </div>
                            </CardContent>
                        </Card>
                    )}

                </div>

                {/* Right Column (Side Data) */}
                <div className="space-y-6">
                    {/* Overview card */}
                    {overview.length > 0 && (
                        <Card className="rounded border-border shadow-none">
                            <CardHeader className="pb-3 border-b border-border/50 bg-muted/20">
                                <CardTitle className="text-sm font-semibold tracking-tight">Overview</CardTitle>
                            </CardHeader>
                            <CardContent className="pt-5">
                                {renderSection('', overview)}
                            </CardContent>
                        </Card>
                    )}

                    {/* Technical Details */}
                    {technical.length > 0 && (
                        <Card className="rounded border-border shadow-none">
                            <CardHeader className="pb-3 border-b border-border/50 bg-muted/20">
                                <CardTitle className="text-sm font-semibold tracking-tight">Technical Details</CardTitle>
                            </CardHeader>
                            <CardContent className="pt-5">
                                {renderSection('', technical)}
                            </CardContent>
                        </Card>
                    )}

                    {/* Distribution */}
                    {distribution.length > 0 && (
                        <Card className="rounded border-border shadow-none">
                            <CardHeader className="pb-3 border-b border-border/50 bg-muted/20">
                                <CardTitle className="text-sm font-semibold tracking-tight">Distribution</CardTitle>
                            </CardHeader>
                            <CardContent className="pt-5">
                                {renderSection('', distribution)}
                            </CardContent>
                        </Card>
                    )}

                    {/* Metadata */}
                    {metadata.length > 0 && (
                        <Card className="rounded border-border shadow-none">
                            <CardHeader className="pb-3 border-b border-border/50 bg-muted/20">
                                <CardTitle className="text-sm font-semibold tracking-tight">Metadata System</CardTitle>
                            </CardHeader>
                            <CardContent className="pt-5">
                                {renderSection('', metadata)}
                            </CardContent>
                        </Card>
                    )}

                    {/* Other Fields (if any stray fields leak through) */}
                    {otherFields.length > 0 && (
                        <Card className="rounded border-border shadow-none opacity-80">
                            <CardHeader className="pb-3 border-b border-border/50 bg-muted/20">
                                <CardTitle className="text-sm font-semibold tracking-tight text-muted-foreground">Additional Payload Data</CardTitle>
                            </CardHeader>
                            <CardContent className="pt-5">
                                {renderSection('', otherFields)}
                            </CardContent>
                        </Card>
                    )}
                </div>
            </div>
        </div>
    );
}
