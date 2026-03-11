/**
 * Movie Database List Component
 *
 * Shows movies split into "Now Showing" (from today's schedules)
 * and "Past Movies" (from movie_performance, not showing today).
 */
'use client';

import { useState, useMemo } from 'react';
import useSWR from 'swr';
import Image from 'next/image';
import Link from 'next/link';
import { Loader2, Clapperboard, Archive, ChevronDown, ChevronRight, Film, AlertCircle, ArrowUpDown } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

interface ScheduleMovie {
    id: string;
    movie_id: string;
    tix_metadata_id?: string;
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
    tix_metadata_id?: string;
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

type SortField = 'title' | 'schedule_id' | 'metadata_id' | 'date';
type SortDirection = 'asc' | 'desc';

export function MovieDatabaseList() {
    const [isArchiveOpen, setIsArchiveOpen] = useState(false);
    const [sortField, setSortField] = useState<SortField>('date');
    const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

    const { data, error, isLoading } = useSWR<MovieDatabaseResponse>(
        '/api/movies',
        fetcher
    );

    const toggleSort = (field: SortField) => {
        if (sortField === field) {
            setSortDirection(d => d === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortDirection('desc'); // Default to desc when changing fields
        }
    };

    const sortedNowShowing = useMemo(() => {
        if (!data?.now_showing) return [];
        // Deduplicate
        const unique = Array.from(
            new Map(data.now_showing.map((m) => [m.id || m.movie_id, m])).values()
        );
        
        return unique.sort((a, b) => {
            let comparison = 0;
            switch (sortField) {
                case 'title':
                    comparison = (a.title || '').localeCompare(b.title || '');
                    break;
                case 'schedule_id':
                    comparison = (a.id || a.movie_id || '').localeCompare(b.id || b.movie_id || '');
                    break;
                case 'metadata_id':
                    comparison = (a.tix_metadata_id || '').localeCompare(b.tix_metadata_id || '');
                    break;
                case 'date':
                    const dateA = a.date || '';
                    const dateB = b.date || '';
                    comparison = dateA.localeCompare(dateB);
                    break;
            }
            return sortDirection === 'asc' ? comparison : -comparison;
        });
    }, [data, sortField, sortDirection]);

    const sortedPastMovies = useMemo(() => {
        if (!data?.past_movies) return [];
        
        return [...data.past_movies].sort((a, b) => {
            let comparison = 0;
            switch (sortField) {
                case 'title':
                    comparison = (a.title || '').localeCompare(b.title || '');
                    break;
                case 'schedule_id':
                    comparison = (a.id || a.movie_id || '').localeCompare(b.id || b.movie_id || '');
                    break;
                case 'metadata_id':
                    comparison = (a.tix_metadata_id || '').localeCompare(b.tix_metadata_id || '');
                    break;
                case 'date':
                    const dateA = a.last_updated || '';
                    const dateB = b.last_updated || '';
                    comparison = dateA.localeCompare(dateB);
                    break;
            }
            return sortDirection === 'asc' ? comparison : -comparison;
        });
    }, [data, sortField, sortDirection]);

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

    const renderTableHeader = () => (
        <thead>
            <tr className="bg-muted/50 border-b text-left text-muted-foreground">
                <th className="py-2 px-3 font-medium w-12"></th>
                <th 
                    className="py-2 px-3 font-medium cursor-pointer hover:bg-muted transition-colors"
                    onClick={() => toggleSort('title')}
                >
                    <div className="flex items-center gap-1">
                        Movie
                        {sortField === 'title' && <ArrowUpDown className="w-3 h-3" />}
                    </div>
                </th>
                <th 
                    className="py-2 px-3 font-medium cursor-pointer hover:bg-muted transition-colors w-48"
                    onClick={() => toggleSort('schedule_id')}
                >
                    <div className="flex items-center gap-1">
                        Schedule ID (V1)
                        {sortField === 'schedule_id' && <ArrowUpDown className="w-3 h-3" />}
                    </div>
                </th>
                <th 
                    className="py-2 px-3 font-medium cursor-pointer hover:bg-muted transition-colors w-48"
                    onClick={() => toggleSort('metadata_id')}
                >
                    <div className="flex items-center gap-1">
                        Metadata ID (V2)
                        {sortField === 'metadata_id' && <ArrowUpDown className="w-3 h-3" />}
                    </div>
                </th>
                <th 
                    className="py-2 px-3 font-medium cursor-pointer hover:bg-muted transition-colors w-32"
                    onClick={() => toggleSort('date')}
                >
                    <div className="flex items-center gap-1">
                        Date / Updated
                        {sortField === 'date' && <ArrowUpDown className="w-3 h-3" />}
                    </div>
                </th>
            </tr>
        </thead>
    );

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
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
                        {sortedNowShowing.length} movies
                    </span>
                </div>

                {sortedNowShowing.length === 0 ? (
                    <div className="text-center py-8 bg-muted/20 border border-border rounded-lg text-muted-foreground">
                        <Film className="w-8 h-8 mx-auto mb-2 opacity-40" />
                        <p className="text-sm">No movies showing today</p>
                    </div>
                ) : (
                    <Card className="overflow-hidden border border-border">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                {renderTableHeader()}
                                <tbody className="divide-y divide-border">
                                    {sortedNowShowing.map((movie) => {
                                        const scheduleId = movie.id || movie.movie_id;
                                        const metadataId = movie.tix_metadata_id || 'Missing';
                                        const targetLink = `/movies/${movie.tix_metadata_id || scheduleId}`;

                                        return (
                                            <tr key={scheduleId} className="hover:bg-muted/30 transition-colors group">
                                                <td className="py-2 px-3">
                                                    <Link href={targetLink} className="block">
                                                        <div className="w-8 h-12 relative bg-muted rounded overflow-hidden">
                                                            {movie.poster ? (
                                                                <Image src={movie.poster} alt="" fill className="object-cover" sizes="32px" />
                                                            ) : (
                                                                <Film className="w-4 h-4 absolute inset-0 m-auto opacity-20" />
                                                            )}
                                                        </div>
                                                    </Link>
                                                </td>
                                                <td className="py-2 px-3">
                                                    <Link href={targetLink} className="font-semibold hover:text-primary transition-colors block">
                                                        {movie.title}
                                                    </Link>
                                                    <div className="flex gap-2 mt-1">
                                                        {movie.is_presale && (
                                                            <span className="text-[9px] font-bold bg-amber-500/10 text-amber-500 px-1.5 py-0.5 rounded">PRESALE</span>
                                                        )}
                                                        {movie.age_category && (
                                                            <span className="text-[9px] font-bold bg-muted text-muted-foreground px-1.5 py-0.5 rounded">{movie.age_category}</span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="py-2 px-3 font-mono text-xs text-muted-foreground">
                                                    {scheduleId}
                                                </td>
                                                <td className="py-2 px-3 font-mono text-xs text-primary/80">
                                                    {metadataId}
                                                </td>
                                                <td className="py-2 px-3 text-xs text-muted-foreground">
                                                    {movie.date}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </Card>
                )}
            </section>

            {/* PAST MOVIES */}
            {sortedPastMovies.length > 0 && (
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
                            {sortedPastMovies.length}
                        </div>
                    </button>

                    {isArchiveOpen && (
                        <div className="mt-4 animate-in fade-in slide-in-from-top-2 duration-200">
                            <Card className="overflow-hidden border border-border">
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        {renderTableHeader()}
                                        <tbody className="divide-y divide-border">
                                            {sortedPastMovies.map((movie) => {
                                                const scheduleId = movie.id || movie.movie_id;
                                                const metadataId = movie.tix_metadata_id || 'Missing';
                                                const targetLink = `/movies/${movie.tix_metadata_id || scheduleId}`;

                                                return (
                                                    <tr key={scheduleId} className="hover:bg-muted/30 transition-colors group opacity-80 hover:opacity-100">
                                                        <td className="py-2 px-3">
                                                            <Link href={targetLink} className="block">
                                                                <div className="w-8 h-12 relative bg-muted rounded overflow-hidden">
                                                                    {movie.poster ? (
                                                                        <Image src={movie.poster} alt="" fill className="object-cover grayscale group-hover:grayscale-0" sizes="32px" />
                                                                    ) : (
                                                                        <Film className="w-4 h-4 absolute inset-0 m-auto opacity-20" />
                                                                    )}
                                                                </div>
                                                            </Link>
                                                        </td>
                                                        <td className="py-2 px-3">
                                                            <Link href={targetLink} className="font-semibold hover:text-primary transition-colors block">
                                                                {movie.title}
                                                            </Link>
                                                        </td>
                                                        <td className="py-2 px-3 font-mono text-xs text-muted-foreground">
                                                            {scheduleId}
                                                        </td>
                                                        <td className="py-2 px-3 font-mono text-xs text-primary/80">
                                                            {metadataId}
                                                        </td>
                                                        <td className="py-2 px-3 text-xs text-muted-foreground">
                                                            {movie.last_updated && new Date(movie.last_updated).toLocaleDateString()}
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </Card>
                        </div>
                    )}
                </section>
            )}
        </div>
    );
}
