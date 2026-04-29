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
import { Loader2, Clapperboard, Film, AlertCircle, ArrowUpDown, Star, Search } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

import { fetcher } from '@/lib/api';
import { SortDirection } from '@/features/performances/types/performance';
import type { MovieDatabaseResponse } from '../types';

type SortField = 'title' | 'schedule_id' | 'metadata_id' | 'date' | 'status' | 'rating' | 'release_date';

export function MovieDatabaseList() {
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedGenre, setSelectedGenre] = useState<string | null>(null);
    const [sortField, setSortField] = useState<SortField>('status');
    const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

    const { data, error, isLoading } = useSWR<MovieDatabaseResponse>(
        '/api/movies',
        fetcher
    );

    // Extract unique genres from data
    const availableGenres = useMemo(() => {
        if (!data?.movies) return [];
        const genreSet = new Set<string>();
        data.movies.forEach(m => {
            m.genres.forEach(g => genreSet.add(g));
        });
        return Array.from(genreSet).sort();
    }, [data]);

    const toggleSort = (field: SortField) => {
        if (sortField === field) {
            setSortDirection(d => d === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortDirection('desc');
        }
    };

    const sortedMovies = useMemo(() => {
        if (!data?.movies) return [];
        
        let filtered = [...data.movies];
        
        // 1. Title Search Filter
        if (searchTerm.trim()) {
            const term = searchTerm.toLowerCase();
            filtered = filtered.filter(m => m.title.toLowerCase().includes(term));
        }

        // 2. Genre Chip Filter
        if (selectedGenre) {
            filtered = filtered.filter(m => m.genres.includes(selectedGenre));
        }

        return filtered.sort((a, b) => {
            let comparison = 0;
            switch (sortField) {
                case 'status':
                    // Sort by showing status first
                    comparison = (a.is_showing_today ? 1 : 0) - (b.is_showing_today ? 1 : 0);
                    if (comparison === 0) {
                        // secondary sort by date
                        comparison = (a.last_updated || '').localeCompare(b.last_updated || '');
                    }
                    break;
                case 'title':
                    comparison = (a.title || '').localeCompare(b.title || '');
                    break;
                case 'schedule_id':
                    comparison = (a.movie_id || '').localeCompare(b.movie_id || '');
                    break;
                case 'metadata_id':
                    comparison = (a.id || '').localeCompare(b.id || '');
                    break;
                case 'date':
                    comparison = (a.last_updated || '').localeCompare(b.last_updated || '');
                    break;
                case 'release_date':
                    comparison = (a.release_date || 0) - (b.release_date || 0);
                    break;
                case 'rating':
                    comparison = (a.rating?.average || 0) - (b.rating?.average || 0);
                    break;
            }
            return sortDirection === 'asc' ? comparison : -comparison;
        });
    }, [data, sortField, sortDirection, searchTerm, selectedGenre]);

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                <span className="ml-2 text-muted-foreground">Loading movie database...</span>
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

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                    <Clapperboard className="w-5 h-5 text-primary" />
                    <h2 className="text-xl font-bold tracking-tight">
                        Archive & Live Inventory
                    </h2>
                </div>
                
                <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
                    <div className="relative w-full sm:w-64">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search movie title..."
                            className="pl-9"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded border border-border whitespace-nowrap">
                        {sortedMovies.length} movies
                    </span>
                </div>
            </div>

            {/* Genre Chips */}
            {availableGenres.length > 0 && (
                <div className="flex flex-wrap gap-2 py-1">
                    <button
                        onClick={() => setSelectedGenre(null)}
                        className={cn(
                            "px-3 py-1 rounded-full text-xs font-medium transition-all border",
                            selectedGenre === null 
                                ? "bg-primary text-primary-foreground border-primary shadow-sm" 
                                : "bg-muted/50 text-muted-foreground border-transparent hover:bg-muted"
                        )}
                    >
                        All Genres
                    </button>
                    {availableGenres.map(genre => (
                        <button
                            key={genre}
                            onClick={() => setSelectedGenre(genre === selectedGenre ? null : genre)}
                            className={cn(
                                "px-3 py-1 rounded-full text-xs font-medium transition-all border",
                                selectedGenre === genre 
                                    ? "bg-primary text-primary-foreground border-primary shadow-sm" 
                                    : "bg-muted/50 text-muted-foreground border-transparent hover:bg-muted"
                            )}
                        >
                            {genre}
                        </button>
                    ))}
                </div>
            )}

            <Card className="overflow-hidden border border-border shadow-sm">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="bg-muted/50 border-b text-left text-muted-foreground">
                                <th 
                                    className="py-2.5 px-4 font-medium w-24 text-center cursor-pointer hover:bg-muted transition-colors"
                                    onClick={() => toggleSort('status')}
                                >
                                    <div className="flex items-center justify-center gap-1">
                                        Status
                                        {sortField === 'status' && <ArrowUpDown className="w-3 h-3" />}
                                    </div>
                                </th>
                                <th className="py-2.5 px-3 font-medium w-12"></th>
                                <th 
                                    className="py-2.5 px-3 font-medium cursor-pointer hover:bg-muted transition-colors"
                                    onClick={() => toggleSort('title')}
                                >
                                    <div className="flex items-center gap-1">
                                        Movie
                                        {sortField === 'title' && <ArrowUpDown className="w-3 h-3" />}
                                    </div>
                                </th>
                                <th 
                                    className="py-2.5 px-3 font-medium cursor-pointer hover:bg-muted transition-colors w-48"
                                    onClick={() => toggleSort('metadata_id')}
                                >
                                    <div className="flex items-center gap-1">
                                        Metadata ID
                                        {sortField === 'metadata_id' && <ArrowUpDown className="w-3 h-3" />}
                                    </div>
                                </th>
                                <th 
                                    className="py-2.5 px-3 font-medium cursor-pointer hover:bg-muted transition-colors w-48"
                                    onClick={() => toggleSort('schedule_id')}
                                >
                                    <div className="flex items-center gap-1">
                                        Schedule ID
                                        {sortField === 'schedule_id' && <ArrowUpDown className="w-3 h-3" />}
                                    </div>
                                </th>
                                <th 
                                    className="py-2.5 px-3 font-medium cursor-pointer hover:bg-muted transition-colors w-32"
                                    onClick={() => toggleSort('date')}
                                >
                                    <div className="flex items-center gap-1">
                                        Last Updated
                                        {sortField === 'date' && <ArrowUpDown className="w-3 h-3" />}
                                    </div>
                                </th>
                                <th 
                                    className="py-2.5 px-3 font-medium cursor-pointer hover:bg-muted transition-colors w-32"
                                    onClick={() => toggleSort('release_date')}
                                >
                                    <div className="flex items-center gap-1">
                                        Release Date
                                        {sortField === 'release_date' && <ArrowUpDown className="w-3 h-3" />}
                                    </div>
                                </th>
                                <th 
                                    className="py-2.5 px-3 font-medium cursor-pointer hover:bg-muted transition-colors w-24"
                                    onClick={() => toggleSort('rating')}
                                >
                                    <div className="flex items-center gap-1">
                                        Rating
                                        {sortField === 'rating' && <ArrowUpDown className="w-3 h-3" />}
                                    </div>
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {sortedMovies.map((movie) => {
                                const targetLink = `/movies/${movie.id}`;

                                return (
                                    <tr key={movie.id} className={cn(
                                        "hover:bg-muted/30 transition-colors group",
                                        !movie.is_showing_today && "opacity-70"
                                    )}>
                                        <td className="py-3 px-4 text-center">
                                            {movie.is_showing_today ? (
                                                <div className="flex flex-col items-center gap-0.5">
                                                    <span className="text-[10px] font-black bg-emerald-500 text-white px-1.5 py-0.5 rounded shadow-sm">
                                                        LIVE
                                                    </span>
                                                </div>
                                            ) : (
                                                <span className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-tighter">
                                                    Past
                                                </span>
                                            )}
                                        </td>
                                        <td className="py-3 px-3">
                                            <Link href={targetLink} className="block">
                                                <div className="w-10 h-14 relative bg-muted rounded overflow-hidden shadow-sm border border-border/50">
                                                    {movie.poster ? (
                                                        <Image 
                                                            src={movie.poster} 
                                                            alt="" 
                                                            fill 
                                                            className={cn("object-cover", !movie.is_showing_today && "grayscale opacity-80")} 
                                                            sizes="40px" 
                                                        />
                                                    ) : (
                                                        <Film className="w-5 h-5 absolute inset-0 m-auto opacity-20" />
                                                    )}
                                                </div>
                                            </Link>
                                        </td>
                                        <td className="py-3 px-3">
                                            <Link href={targetLink} className="font-bold hover:text-primary transition-colors block text-base truncate max-w-[300px]">
                                                {movie.title}
                                            </Link>
                                            <div className="flex flex-wrap gap-1.5 mt-1.5">
                                                {movie.age_category && (
                                                    <span className="text-[9px] font-black bg-muted text-muted-foreground px-1.5 py-0.5 rounded uppercase tracking-wider border border-border/50">{movie.age_category}</span>
                                                )}
                                                {movie.genres.slice(0, 2).map((genre, idx) => (
                                                    <span key={idx} className="text-[9px] font-medium bg-primary/5 text-primary/70 px-1.5 py-0.5 rounded border border-primary/10">
                                                        {genre}
                                                    </span>
                                                ))}
                                                {movie.genres.length > 2 && (
                                                    <span className="text-[9px] text-muted-foreground/50 self-center">+{movie.genres.length - 2}</span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="py-3 px-3 font-mono text-xs text-primary/80">
                                            {movie.id}
                                        </td>
                                        <td className="py-3 px-3 font-mono text-xs text-muted-foreground">
                                            {movie.movie_id}
                                        </td>
                                        <td className="py-3 px-3 text-xs text-muted-foreground">
                                            {movie.last_updated ? new Date(movie.last_updated).toLocaleDateString('en-GB', {
                                                day: '2-digit',
                                                month: 'short',
                                                year: 'numeric'
                                            }) : 'N/A'}
                                        </td>
                                        <td className="py-3 px-3 text-xs text-muted-foreground">
                                            {movie.release_date && movie.release_date > 0 ? new Date(movie.release_date * 1000).toLocaleDateString('en-GB', {
                                                day: '2-digit',
                                                month: 'short',
                                                year: 'numeric'
                                            }) : 'N/A'}
                                        </td>
                                        <td className="py-3 px-3">
                                            {movie.rating && movie.rating.count > 0 ? (
                                                <div className="flex flex-col gap-0.5">
                                                    <div className="flex items-center gap-1 text-amber-500 font-bold">
                                                        <Star className="w-3 h-3 fill-current" />
                                                        {movie.rating.average.toFixed(1)}
                                                    </div>
                                                    <span className="text-[10px] text-muted-foreground/60 leading-none">
                                                        {movie.rating.count.toLocaleString()} votes
                                                    </span>
                                                </div>
                                            ) : (
                                                <span className="text-xs text-muted-foreground/40 italic">No rating</span>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </Card>
        </div>
    );
}
