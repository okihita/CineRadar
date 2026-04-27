'use client';

import { useState, useMemo } from 'react';
import useSWR from 'swr';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Search, X, Calendar as CalendarIcon, Loader2 } from 'lucide-react';
import { format, isAfter, startOfDay } from 'date-fns';
import { DateRange } from 'react-day-picker';
import { cn } from '@/lib/utils';
import { fetcher } from '@/lib/api';
import { Movie, TrendingMovie, CHART_COLORS, abbreviateTitle } from '../types';

interface CompareControlPanelProps {
    selectedMovieIds: string[];
    movieColorsMap: Record<string, string>;
    dateRange: DateRange;
    isLoadingTrending: boolean;
    onAddMovie: (movie: Movie | TrendingMovie) => void;
    onRemoveMovie: (id: string) => void;
    onColorChange: (id: string, color: string) => void;
    onDateRangeChange: (range: DateRange) => void;
    onClearAll: () => void;
}

export function CompareControlPanel({
    selectedMovieIds,
    movieColorsMap,
    dateRange,
    isLoadingTrending,
    onAddMovie,
    onRemoveMovie,
    onColorChange,
    onDateRangeChange,
    onClearAll,
}: CompareControlPanelProps) {
    const [searchQuery, setSearchQuery] = useState('');
    const [isSearchOpen, setIsSearchOpen] = useState(false);

    const { data: moviesData, isLoading: isLoadingMovies } = useSWR('/api/movies', fetcher, {
        revalidateOnFocus: false,
    });

    const allMovies: Movie[] = useMemo(() => moviesData?.movies || [], [moviesData]);

    const filteredMovies = useMemo(() => {
        if (!searchQuery.trim()) return [];
        return allMovies
            .filter(m => m.title.toLowerCase().includes(searchQuery.toLowerCase()))
            .slice(0, 10);
    }, [searchQuery, allMovies]);

    const selectedMoviesDetails = useMemo(() => {
        return selectedMovieIds.map(id => {
            return allMovies.find(m => m.id === id) || { id, title: `Loading ${id}...`, poster: '' };
        });
    }, [selectedMovieIds, allMovies]);

    return (
        <Card className="overflow-visible shadow-sm">
            <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle className="text-lg">Configuration</CardTitle>
                        <CardDescription>Select up to 6 movies to compare side-by-side. Click on the color to pick another color for a movie.</CardDescription>
                    </div>
                    {selectedMovieIds.length > 0 && (
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={onClearAll}
                            className="text-muted-foreground hover:text-destructive"
                        >
                            <X className="w-4 h-4 mr-2" />
                            Clear All
                        </Button>
                    )}
                </div>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="flex flex-col md:flex-row gap-4 items-start">
                    {/* Movie Selector */}
                    <div className="flex-1 w-full relative">
                        <div className="relative">
                            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder={isLoadingMovies ? "Loading movie database..." : "Search movie to add..."}
                                value={searchQuery}
                                onChange={(e) => {
                                    setSearchQuery(e.target.value);
                                    setIsSearchOpen(true);
                                }}
                                onFocus={() => setIsSearchOpen(true)}
                                disabled={selectedMovieIds.length >= 6 || isLoadingMovies}
                                className="pl-8"
                            />
                        </div>

                        {/* Search Dropdown */}
                        {isSearchOpen && searchQuery && (
                            <div className="absolute z-50 w-full mt-1 bg-background border rounded-md shadow-lg max-h-[600px] overflow-auto">
                                {filteredMovies.length === 0 ? (
                                    <div className="p-3 text-sm text-muted-foreground text-center">No movies found.</div>
                                ) : (
                                    filteredMovies.map(movie => (
                                        <div
                                            key={movie.id}
                                            className="flex items-center gap-4 p-3 hover:bg-muted cursor-pointer border-b last:border-0"
                                            onClick={() => {
                                                onAddMovie(movie);
                                                setSearchQuery('');
                                                setIsSearchOpen(false);
                                            }}
                                        >
                                            {movie.poster ? (
                                                // eslint-disable-next-line @next/next/no-img-element
                                                <img src={movie.poster} alt="" className="w-16 h-24 object-cover rounded shadow-sm border" />
                                            ) : (
                                                <div className="w-16 h-24 bg-muted rounded flex items-center justify-center border border-dashed">
                                                    <span className="text-xs text-muted-foreground">No poster</span>
                                                </div>
                                            )}
                                            <div className="flex-1 overflow-hidden">
                                                <div className="font-bold text-base mb-1 truncate">{movie.title}</div>
                                                <div className="text-xs text-muted-foreground font-mono">ID: {movie.id}</div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        )}

                        <div className="mt-3 flex flex-wrap gap-2">
                            {selectedMoviesDetails.map((movie) => (
                                <Badge key={movie.id} variant="secondary" className="px-3 py-1.5 flex items-center gap-2 text-sm border-2">
                                    <Popover>
                                        <PopoverTrigger asChild>
                                            <button
                                                className="w-3 h-3 rounded-full flex-shrink-0 hover:scale-125 transition-transform cursor-pointer shadow-sm border border-black/10"
                                                style={{ backgroundColor: movieColorsMap[movie.id] }}
                                                title="Change color"
                                            />
                                        </PopoverTrigger>
                                        <PopoverContent className="w-auto p-3" align="start">
                                            <div className="space-y-3">
                                                <p className="text-xs font-medium">Pick a color for {movie.title}</p>
                                                <div className="grid grid-cols-6 gap-1">
                                                    {CHART_COLORS.map(color => (
                                                        <button
                                                            key={color}
                                                            className="w-5 h-5 rounded-full border border-black/10 hover:scale-110 transition-transform"
                                                            style={{ backgroundColor: color }}
                                                            onClick={() => onColorChange(movie.id, color)}
                                                        />
                                                    ))}
                                                </div>
                                                <div className="flex items-center gap-2 pt-2 border-t">
                                                    <label className="text-[10px] uppercase text-muted-foreground font-bold">Custom</label>
                                                    <input
                                                        type="color"
                                                        value={movieColorsMap[movie.id]}
                                                        onChange={(e) => onColorChange(movie.id, e.target.value)}
                                                        className="w-full h-6 rounded cursor-pointer bg-transparent"
                                                    />
                                                </div>
                                            </div>
                                        </PopoverContent>
                                    </Popover>
                                    <span
                                        className="font-bold whitespace-nowrap"
                                        style={{ color: movieColorsMap[movie.id] }}
                                    >
                                        {movie.title}{abbreviateTitle(movie.title) !== movie.title ? ` (${abbreviateTitle(movie.title)})` : ''}
                                    </span>
                                    <button
                                        onClick={() => onRemoveMovie(movie.id)}
                                        className="ml-1 text-muted-foreground hover:text-foreground p-0.5 rounded-full hover:bg-muted"
                                    >
                                        <X className="w-3 h-3" />
                                    </button>
                                </Badge>
                            ))}
                            {selectedMovieIds.length === 0 && (
                                <span className="text-sm text-muted-foreground italic flex items-center gap-2">
                                    <Loader2 className={`w-3 h-3 animate-spin ${isLoadingTrending ? 'opacity-100' : 'opacity-0'}`} />
                                    Select up to 6 movies or choose from trending below
                                </span>
                            )}
                        </div>
                    </div>

                    {/* Date Pickers */}
                    <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
                        <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-medium text-muted-foreground ml-1">Start Date</label>
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant={"outline"}
                                        className={cn(
                                            "w-full sm:w-[180px] justify-start text-left font-normal",
                                            !dateRange?.from && "text-muted-foreground"
                                        )}
                                    >
                                        <CalendarIcon className="mr-2 h-4 w-4" />
                                        {dateRange?.from ? format(dateRange.from, "PPP") : <span>Pick a date</span>}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="start">
                                    <Calendar
                                        mode="single"
                                        selected={dateRange?.from}
                                        onSelect={(date) => {
                                            if (date) {
                                                onDateRangeChange({ from: date, to: dateRange?.to });
                                            }
                                        }}
                                        disabled={(date) =>
                                            isAfter(date, startOfDay(new Date()))
                                        }
                                        initialFocus
                                    />
                                </PopoverContent>
                            </Popover>
                        </div>

                        <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-medium text-muted-foreground ml-1">End Date</label>
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant={"outline"}
                                        className={cn(
                                            "w-full sm:w-[180px] justify-start text-left font-normal",
                                            !dateRange?.to && "text-muted-foreground"
                                        )}
                                    >
                                        <CalendarIcon className="mr-2 h-4 w-4" />
                                        {dateRange?.to ? format(dateRange.to, "PPP") : <span>Pick a date</span>}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="start">
                                    <Calendar
                                        mode="single"
                                        selected={dateRange?.to}
                                        onSelect={(date) => {
                                            if (date) {
                                                onDateRangeChange({ from: dateRange?.from, to: date });
                                            }
                                        }}
                                        disabled={(date) =>
                                            isAfter(date, startOfDay(new Date())) || (dateRange?.from ? date < startOfDay(dateRange.from) : false)
                                        }
                                        initialFocus
                                    />
                                </PopoverContent>
                            </Popover>
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
