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

const fetcher = (url: string) => fetch(url).then((res) => res.json());

interface MovieDetailResponse {
    success: boolean;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    movie?: Record<string, any>;
    error?: string;
}

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

        // Special case: objects with id/name that might be rendered directly
        // Convert to string representation instead
        if (entries.length <= 3 && (obj.id !== undefined || obj.name !== undefined)) {
            const parts = entries.map(([k, v]) => `${k}: ${String(v)}`).join(', ');
            return <span className="text-sm font-mono bg-muted px-2 py-0.5 rounded">{parts}</span>;
        }

        if (depth > 2) {
            return <pre className="text-xs bg-muted p-2 rounded overflow-auto">{JSON.stringify(value, null, 2)}</pre>;
        }
        return (
            <div className="space-y-2 pl-4 border-l-2 border-border">
                {entries.map(([key, val]) => (
                    <div key={key}>
                        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{key}</span>
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
                    <span className="ml-2 text-muted-foreground">Loading movie...</span>
                </div>
            </div>
        );
    }

    if (error || !data?.success || !data.movie) {
        return (
            <div className="min-h-screen bg-background text-foreground p-6">
                <Link href="/movies" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6">
                    <ArrowLeft className="w-4 h-4" /> Back to Movie Database
                </Link>
                <Alert variant="destructive">
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
        cast: 'Cast',
        producers: 'Producers',
        writers: 'Writers',
        production_companies: 'Production Companies',
        distributors: 'Distributors',
        countries: 'Countries',
        languages: 'Languages',
        rating: 'Rating',
        vote_count: 'Vote Count',
        popularity: 'Popularity',
        budget: 'Budget',
        revenue: 'Revenue',
        poster: 'Poster URL',
        backdrop: 'Backdrop URL',
        trailer: 'Trailer URL',
        website: 'Official Website',
        imdb_id: 'IMDb ID',
        tmdb_id: 'TMDb ID',
        is_presale: 'Presale',
        uploaded_at: 'Uploaded At',
        last_updated: 'Last Updated',
        created_at: 'Created At',
        updated_at: 'Updated At',
    };

    // Organize fields into sections
    const overviewFields = ['rating', 'vote_count'];
    const technicalFields = ['original_title', 'directors', 'producers', 'writers'];
    const distributionFields = ['production_companies', 'distributors', 'countries', 'languages'];
    const metadataFields = ['movie_id', 'imdb_id', 'tmdb_id', 'uploaded_at', 'last_updated', 'created_at', 'updated_at'];
    const excludeFields = ['title', 'name', 'poster', 'poster_path', 'id', 'genres', 'age_category', 'is_presale', 'casts', 'release_date', 'duration', 'synopsis', 'scraped_at', 'status'];

    const getFieldsForSection = (fieldList: string[]) => {
        return Object.entries(movie)
            .filter(([key]) => fieldList.includes(key))
            .map(([key, value]) => ({ key, value, label: fieldLabels[key] || key }));
    };

    const otherFields = Object.entries(movie)
        .filter(([key]) =>
            !overviewFields.includes(key) &&
            !technicalFields.includes(key) &&
            !distributionFields.includes(key) &&
            !metadataFields.includes(key) &&
            !excludeFields.includes(key)
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
            // If it's a number, check if it's in seconds or milliseconds
            // Timestamps before year 2000 in milliseconds would be > 946684800000
            // If the number is less than that, it's likely in seconds
            date = releaseDate < 10000000000
                ? new Date(releaseDate * 1000) // seconds to milliseconds
                : new Date(releaseDate); // already in milliseconds
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
            <div className="mb-6">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">{title}</h3>
                <div className="space-y-3">
                    {fields.map(({ key, value, label }) => (
                        <div key={key} className="grid grid-cols-1 md:grid-cols-[180px_1fr] gap-2">
                            <div className="font-medium text-sm">{label}</div>
                            <div>{renderValue(value)}</div>
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
            <div className="flex flex-col md:flex-row gap-6 mb-8">
                {/* Poster */}
                <div className="w-48 flex-shrink-0">
                    <div className="aspect-[2/3] relative rounded-lg overflow-hidden bg-muted ring-1 ring-border">
                        {poster ? (
                            <Image
                                src={poster}
                                alt={title}
                                fill
                                className="object-cover"
                                sizes="200px"
                                priority
                            />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                                <Film className="w-12 h-12" />
                            </div>
                        )}
                    </div>
                </div>

                {/* Title & Info */}
                <div className="flex-1">
                    <h1 className="text-3xl font-bold tracking-tight mb-2">{title}</h1>

                    {/* Release Date & Duration & ID & Status & Last Update */}
                    <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground mb-4">
                        {formattedReleaseDate ? (
                            <span>{formattedReleaseDate}</span>
                        ) : null}
                        {movie.duration ? (
                            <span>• {movie.duration as number} min</span>
                        ) : null}
                        <span className="flex items-center gap-1.5 ml-1">
                            <span className="text-xs bg-muted px-1.5 py-0.5 rounded border font-mono select-all">
                                {movieId}
                            </span>
                        </span>

                        {/* Status */}
                        {movie.status ? (
                            <Badge variant="outline" className="ml-1 border-primary/30 text-primary bg-primary/5">
                                {movie.status as string}
                            </Badge>
                        ) : null}

                        {/* Last Scraped */}
                        {movie.scraped_at ? (
                            <span className="text-xs ml-1 flex items-center gap-1" title={String(movie.scraped_at)}>
                                <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block"></span>
                                Last update {(() => {
                                    try {
                                        const date = new Date(movie.scraped_at as string);
                                        const now = new Date();
                                        const diffMs = now.getTime() - date.getTime();
                                        const diffMins = Math.floor(diffMs / 60000);
                                        const diffHours = Math.floor(diffMins / 60);
                                        const diffDays = Math.floor(diffHours / 24);

                                        if (diffMins < 60) return `${diffMins}m ago`;
                                        if (diffHours < 24) return `${diffHours}h ago`;
                                        return `${diffDays}d ago`;
                                    } catch {
                                        return movie.scraped_at as string;
                                    }
                                })()}
                            </span>
                        ) : null}
                    </div>

                    {/* Quick badges */}
                    <div className="flex flex-wrap gap-2 mb-4">
                        {renderBadges()}
                    </div>

                    {/* Synopsis */}
                    {movie.synopsis && (
                        <div>
                            <h3 className="text-sm font-semibold mb-2">Synopsis</h3>
                            <p className="text-sm text-muted-foreground leading-relaxed">
                                {movie.synopsis as string}
                            </p>
                        </div>
                    )}
                </div>
            </div>

            {/* Cast Section */}
            {Array.isArray(movie.casts) && movie.casts.length > 0 && (
                <Card className="mb-6">
                    <CardHeader>
                        <CardTitle className="text-lg">Cast</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex gap-4 overflow-x-auto pb-2">
                            {(movie.casts as Record<string, unknown>[]).map((cast, idx: number) => {
                                const actorName = (cast.name as string) || (cast.actor_name as string) || 'Unknown';
                                const characterName = (cast.character as string) || (cast.role as string) || '';
                                let profilePath = (cast.profile_photo as string) || '';

                                // If profilePath is already a full URL, use it as-is
                                if (profilePath && profilePath.startsWith('http')) {
                                    // Already a full URL, use as-is
                                } else if (profilePath && profilePath.startsWith('/')) {
                                    // Relative path, add TMDb base URL
                                    profilePath = `https://image.tmdb.org/t/p/w185${profilePath}`;
                                }

                                return (
                                    <div key={idx} className="flex-shrink-0 w-32">
                                        <div className="aspect-[2/3] relative rounded-md overflow-hidden bg-muted mb-2">
                                            {profilePath ? (
                                                <Image
                                                    src={profilePath}
                                                    alt={actorName}
                                                    fill
                                                    className="object-cover"
                                                    sizes="128px"
                                                    unoptimized
                                                />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                                                    <Film className="w-8 h-8" />
                                                </div>
                                            )}
                                        </div>
                                        <p className="font-semibold text-xs line-clamp-2 mb-0.5" title={actorName}>
                                            {actorName}
                                        </p>
                                        {characterName && (
                                            <p className="text-[10px] text-muted-foreground line-clamp-2" title={characterName}>
                                                {characterName}
                                            </p>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Organized Data Sections */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Overview */}
                {overview.length > 0 && (
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg">Overview</CardTitle>
                        </CardHeader>
                        <CardContent>
                            {renderSection('', overview)}
                        </CardContent>
                    </Card>
                )}

                {/* Technical Details */}
                {technical.length > 0 && (
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg">Technical Details</CardTitle>
                        </CardHeader>
                        <CardContent>
                            {renderSection('', technical)}
                        </CardContent>
                    </Card>
                )}

                {/* Distribution */}
                {distribution.length > 0 && (
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg">Distribution</CardTitle>
                        </CardHeader>
                        <CardContent>
                            {renderSection('', distribution)}
                        </CardContent>
                    </Card>
                )}

                {/* Metadata */}
                {metadata.length > 0 && (
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg">Metadata</CardTitle>
                        </CardHeader>
                        <CardContent>
                            {renderSection('', metadata)}
                        </CardContent>
                    </Card>
                )}
            </div>

            {/* Other Fields (if any) */}
            {otherFields.length > 0 && (
                <Card className="mt-6">
                    <CardHeader>
                        <CardTitle className="text-lg">Additional Data</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {renderSection('', otherFields)}
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
