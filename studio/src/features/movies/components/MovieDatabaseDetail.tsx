/**
 * Movie Database Detail Component
 *
 * Displays all data from a Firestore /movies/{id} document.
 */
'use client';

import React from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import { Loader2, ArrowLeft, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { fetcher } from '@/lib/api';
import type { MovieDetailResponse } from '../types';

// Sub-components
import { MovieHero } from './detail/MovieHero';
import { MovieCastSection } from './detail/MovieCastSection';
import { MovieMediaSection } from './detail/MovieMediaSection';
import { MovieSidebar } from './detail/MovieSidebar';

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

    return (
        <div className="min-h-screen bg-background text-foreground p-6">
            {/* Back link */}
            <Link href="/movies" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors">
                <ArrowLeft className="w-4 h-4" /> Back to Movie Database
            </Link>

            {/* Hero Section */}
            <MovieHero movie={movie} movieId={movieId} />

            {/* Structured Content Grid */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                {/* Left Column (Main Content) */}
                <div className="xl:col-span-2 space-y-6">
                    <MovieCastSection movie={movie} />
                    <MovieMediaSection movie={movie} />
                </div>

                {/* Right Column (Sidebar) */}
                <div className="xl:col-span-1">
                    <MovieSidebar movie={movie} />
                </div>
            </div>
        </div>
    );
}

