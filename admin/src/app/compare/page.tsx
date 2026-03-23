'use client';

import React, { useState, useMemo, Suspense } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import useSWR from 'swr';
import { PageHeader } from '@/components/PageHeader';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Search, X, Calendar as CalendarIcon, Loader2, GitCompare, Users, MonitorPlay, Percent } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer } from 'recharts';
import { format, subDays, parseISO, isAfter, startOfDay } from 'date-fns';
import { DateRange } from 'react-day-picker';
import { cn } from '@/lib/utils';

const fetcher = (url: string) => fetch(url).then(res => res.json());

interface Movie {
    id: string;
    title: string;
    poster: string;
    is_showing_today?: boolean;
    last_updated?: string;
}

const CHART_COLORS = [
    '#2563eb', // Indigo 600
    '#059669', // Emerald 600
    '#d97706', // Amber 600
    '#db2777', // Pink 600
    '#7c3aed', // Violet 600
    '#dc2626', // Red 600
];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
        return (
            <div className="bg-background border border-border p-3 rounded-lg shadow-lg">
                <p className="font-bold mb-2 text-sm">{label}</p>
                <div className="space-y-1.5">
                    {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                    {payload.map((entry: any, index: number) => (
                        <div key={index} className="flex items-center justify-between gap-6" style={{ color: entry.stroke || entry.color }}>
                            <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.stroke || entry.color }} />
                                <span className="text-xs font-medium">{entry.name}:</span>
                            </div>
                            <span className="text-xs font-bold text-right">
                                {entry.dataKey.includes('occupancy') 
                                    ? `${entry.value.toFixed(1)}%` 
                                    : entry.value.toLocaleString()}
                            </span>
                        </div>
                    ))}
                </div>
            </div>
        );
    }
    return null;
};

// Separate component for useSearchParams to wrap in Suspense
function CompareDashboard() {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();

    // URL State
    const urlMovies = searchParams.get('m');
    const selectedMovieIds = useMemo(() => urlMovies ? urlMovies.split(',') : [], [urlMovies]);
    const urlColors = searchParams.get('c');
    
    const startDateStr = searchParams.get('start');
    const endDateStr = searchParams.get('end');

    // Map of movieId -> hex color
    const movieColorsMap = useMemo(() => {
        const colors = urlColors ? urlColors.split(',') : [];
        const map: Record<string, string> = {};
        selectedMovieIds.forEach((id, index) => {
            // Use URL color if exists, otherwise fallback to default palette
            map[id] = colors[index] ? `#${colors[index]}` : CHART_COLORS[index % CHART_COLORS.length];
        });
        return map;
    }, [selectedMovieIds, urlColors]);

    // Initialize date range from URL or default to last 7 days
    const dateRange = useMemo<DateRange>(() => {
        const end = endDateStr ? parseISO(endDateStr) : new Date();
        const start = startDateStr ? parseISO(startDateStr) : subDays(end, 7);
        return { from: start, to: end };
    }, [startDateStr, endDateStr]);

    // Local State for Search
    const [searchQuery, setSearchQuery] = useState('');
    const [isSearchOpen, setIsSearchOpen] = useState(false);

    // Fetch master movie list for search
    const { data: moviesData, isLoading: isLoadingMovies } = useSWR('/api/movies', fetcher, {
        revalidateOnFocus: false,
    });

    const allMovies: Movie[] = useMemo(() => moviesData?.movies || [], [moviesData]);

    // Fetch comparison data if movies selected
    const compareUrl = selectedMovieIds.length > 0
        ? `/api/compare?movies=${selectedMovieIds.join(',')}${dateRange.from ? `&startDate=${format(dateRange.from, 'yyyy-MM-dd')}` : ''}${dateRange.to ? `&endDate=${format(dateRange.to, 'yyyy-MM-dd')}` : ''}`
        : null;

    const { data: compareData, isLoading, isValidating } = useSWR(compareUrl, fetcher);

    // Better loading state calculation
    const isComparing = (isLoading || isValidating) && !compareData;

    // Filter movies based on search query
    const filteredMovies = useMemo(() => {
        if (!searchQuery.trim()) return [];
        return allMovies
            .filter(m => m.title.toLowerCase().includes(searchQuery.toLowerCase()))
            .slice(0, 10); // Limit to 10 results
    }, [searchQuery, allMovies]);

    // Derived selected movies details
    const selectedMoviesDetails = useMemo(() => {
        return selectedMovieIds.map(id => {
            return allMovies.find(m => m.id === id) || { id, title: `Loading ${id}...`, poster: '' };
        });
    }, [selectedMovieIds, allMovies]);

    // Calculate Summary Metrics
    const summaryMetrics = useMemo(() => {
        if (!compareData || !compareData.data) return {};
        
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const metrics: Record<string, any> = {};
        
        selectedMovieIds.forEach(id => {
            let totalAdmissions = 0;
            let totalShowtimes = 0;
            let totalSeats = 0;
            
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            compareData.data.forEach((day: any) => {
                if (day[id]) {
                    totalAdmissions += day[id].admissions || 0;
                    totalShowtimes += day[id].showtimes || 0;
                    totalSeats += day[id].total_seats || 0;
                }
            });
            
            metrics[id] = {
                totalAdmissions,
                totalShowtimes,
                avgOccupancy: totalSeats > 0 ? (totalAdmissions / totalSeats) * 100 : 0,
                admissionsPerShowtime: totalShowtimes > 0 ? totalAdmissions / totalShowtimes : 0
            };
        });
        
        return metrics;
    }, [compareData, selectedMovieIds]);

    // Prepare Chart Data
    const chartData = useMemo(() => {
        if (!compareData || !compareData.data) return [];
        
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return compareData.data.map((day: any) => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const formattedDay: Record<string, any> = { date: day.date };
            
            selectedMovieIds.forEach(id => {
                if (day[id]) {
                    formattedDay[`${id}_admissions`] = day[id].admissions;
                    formattedDay[`${id}_showtimes`] = day[id].showtimes;
                    formattedDay[`${id}_occupancy`] = day[id].occupancy;
                }
            });
            
            return formattedDay;
        });
    }, [compareData, selectedMovieIds]);

    // Handlers for URL updates
    const updateUrl = (newIds: string[], range?: DateRange, customColorsMap?: Record<string, string>) => {
        const params = new URLSearchParams(searchParams.toString());
        
        if (newIds.length > 0) {
            params.set('m', newIds.join(','));
            
            // Sync colors
            const colorsArray = newIds.map(id => {
                const color = customColorsMap ? customColorsMap[id] : movieColorsMap[id];
                return color ? color.replace('#', '') : CHART_COLORS[newIds.indexOf(id) % CHART_COLORS.length].replace('#', '');
            });
            params.set('c', colorsArray.join(','));
        } else {
            params.delete('m');
            params.delete('c');
        }

        if (range?.from) {
            params.set('start', format(range.from, 'yyyy-MM-dd'));
        }
        if (range?.to) {
            params.set('end', format(range.to, 'yyyy-MM-dd'));
        }
        
        // Next.js router.push will automatically encode commas into %2C if we just pass the URL string.
        // URLSearchParams also encodes the comma. Let's decode just the commas for aesthetic URLs.
        const queryString = params.toString().replace(/%2C/g, ',');
        router.push(`${pathname}?${queryString}`);
    };

    const handleAddMovie = (movie: Movie) => {
        if (selectedMovieIds.length >= 6) return;
        if (selectedMovieIds.includes(movie.id)) return;
        updateUrl([...selectedMovieIds, movie.id], dateRange);
        setSearchQuery('');
        setIsSearchOpen(false);
    };

    const handleRemoveMovie = (id: string) => {
        updateUrl(selectedMovieIds.filter(mId => mId !== id), dateRange);
    };

    const handleColorChange = (id: string, newColor: string) => {
        const newMap = { ...movieColorsMap, [id]: newColor };
        updateUrl(selectedMovieIds, dateRange, newMap);
    };

    const handleDateRangeChange = (range: DateRange | undefined) => {
        if (range) {
            updateUrl(selectedMovieIds, range);
        }
    };

    return (
        <div className="p-6 space-y-6 max-w-[1600px] mx-auto">
            <PageHeader
                title="Head-to-Head Compare"
                description="Compare admissions and showtime performance across multiple movies."
            />

            {/* Control Panel */}
            <Card className="overflow-visible">
                <CardHeader>
                    <CardTitle className="text-lg">Configuration</CardTitle>
                    <CardDescription>Select up to 6 movies to compare side-by-side.</CardDescription>
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
                                                onClick={() => handleAddMovie(movie)}
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
                                                                onClick={() => handleColorChange(movie.id, color)}
                                                            />
                                                        ))}
                                                    </div>
                                                    <div className="flex items-center gap-2 pt-2 border-t">
                                                        <label className="text-[10px] uppercase text-muted-foreground font-bold">Custom</label>
                                                        <input 
                                                            type="color" 
                                                            value={movieColorsMap[movie.id]} 
                                                            onChange={(e) => handleColorChange(movie.id, e.target.value)}
                                                            className="w-full h-6 rounded cursor-pointer bg-transparent"
                                                        />
                                                    </div>
                                                </div>
                                            </PopoverContent>
                                        </Popover>
                                        <span className="max-w-[150px] truncate" title={movie.title}>{movie.title}</span>
                                        <button
                                            onClick={() => handleRemoveMovie(movie.id)}
                                            className="ml-1 text-muted-foreground hover:text-foreground p-0.5 rounded-full hover:bg-muted"
                                        >
                                            <X className="w-3 h-3" />
                                        </button>
                                    </Badge>
                                ))}
                                {selectedMovieIds.length === 0 && (
                                    <span className="text-sm text-muted-foreground italic">No movies selected</span>
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
                                                    handleDateRangeChange({ from: date, to: dateRange?.to });
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
                                                    handleDateRangeChange({ from: dateRange?.from, to: date });
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

            {/* Dashboard Area / Results */}
            {selectedMovieIds.length > 0 ? (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    {isComparing ? (
                        <div className="flex items-center justify-center p-12 text-muted-foreground gap-3">
                            <Loader2 className="w-6 h-6 animate-spin" />
                            Fetching comparison data...
                        </div>
                    ) : (
                        <>
                            {/* Summary Metrics */}
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                {/* Total Admissions Card */}
                                <Card>
                                    <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
                                        <CardTitle className="text-sm font-medium">Total Admissions</CardTitle>
                                        <Users className="h-4 w-4 text-muted-foreground" />
                                    </CardHeader>
                                    <CardContent>
                                        <div className="space-y-2">
                                            {selectedMovieIds.map((id) => (
                                                <div key={id} className="flex justify-between items-center text-sm">
                                                    <div className="flex items-center gap-2 truncate max-w-[120px]">
                                                        <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: movieColorsMap[id] }} />
                                                        <span className="truncate" title={compareData?.movies?.[id]?.title || id}>
                                                            {compareData?.movies?.[id]?.title || 'Unknown'}
                                                        </span>
                                                    </div>
                                                    <span className="font-bold">
                                                        {(summaryMetrics[id]?.totalAdmissions || 0).toLocaleString()}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </CardContent>
                                </Card>

                                {/* Total Showtimes Card */}
                                <Card>
                                    <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
                                        <CardTitle className="text-sm font-medium">Total Showtimes</CardTitle>
                                        <MonitorPlay className="h-4 w-4 text-muted-foreground" />
                                    </CardHeader>
                                    <CardContent>
                                        <div className="space-y-2">
                                            {selectedMovieIds.map((id) => (
                                                <div key={id} className="flex justify-between items-center text-sm">
                                                    <div className="flex items-center gap-2 truncate max-w-[120px]">
                                                        <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: movieColorsMap[id] }} />
                                                        <span className="truncate" title={compareData?.movies?.[id]?.title || id}>
                                                            {compareData?.movies?.[id]?.title || 'Unknown'}
                                                        </span>
                                                    </div>
                                                    <span className="font-bold">
                                                        {(summaryMetrics[id]?.totalShowtimes || 0).toLocaleString()}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </CardContent>
                                </Card>
                                
                                {/* Admissions per Showtime */}
                                <Card>
                                    <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
                                        <CardTitle className="text-sm font-medium">Avg Adm. / Showtime</CardTitle>
                                        <Users className="h-4 w-4 text-muted-foreground" />
                                    </CardHeader>
                                    <CardContent>
                                        <div className="space-y-2">
                                            {selectedMovieIds.map((id) => (
                                                <div key={id} className="flex justify-between items-center text-sm">
                                                    <div className="flex items-center gap-2 truncate max-w-[120px]">
                                                        <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: movieColorsMap[id] }} />
                                                        <span className="truncate" title={compareData?.movies?.[id]?.title || id}>
                                                            {compareData?.movies?.[id]?.title || 'Unknown'}
                                                        </span>
                                                    </div>
                                                    <span className="font-bold">
                                                        {(summaryMetrics[id]?.admissionsPerShowtime || 0).toFixed(1)}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </CardContent>
                                </Card>

                                {/* Occupancy Card */}
                                <Card>
                                    <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
                                        <CardTitle className="text-sm font-medium">Avg Occupancy</CardTitle>
                                        <Percent className="h-4 w-4 text-muted-foreground" />
                                    </CardHeader>
                                    <CardContent>
                                        <div className="space-y-2">
                                            {selectedMovieIds.map((id) => (
                                                <div key={id} className="flex justify-between items-center text-sm">
                                                    <div className="flex items-center gap-2 truncate max-w-[120px]">
                                                        <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: movieColorsMap[id] }} />
                                                        <span className="truncate" title={compareData?.movies?.[id]?.title || id}>
                                                            {compareData?.movies?.[id]?.title || 'Unknown'}
                                                        </span>
                                                    </div>
                                                    <span className="font-bold">
                                                        {(summaryMetrics[id]?.avgOccupancy || 0).toFixed(1)}%
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>

                            {/* Chart Area */}
                            <Card className="col-span-full">
                                <CardHeader>
                                    <CardTitle>Performance Timelines</CardTitle>
                                    <CardDescription>
                                        Daily trends for selected metrics over the chosen period.
                                    </CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <Tabs defaultValue="admissions" className="w-full">
                                        <TabsList className="mb-4">
                                            <TabsTrigger value="admissions">Admissions</TabsTrigger>
                                            <TabsTrigger value="showtimes">Showtimes</TabsTrigger>
                                            <TabsTrigger value="occupancy">Occupancy %</TabsTrigger>
                                        </TabsList>
                                        
                                        <TabsContent value="admissions" className="mt-4 border rounded-md p-4 bg-card">
                                            <div style={{ width: '100%', height: 600 }}>
                                                <ResponsiveContainer width="100%" height="100%">
                                                    <LineChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                                                        <XAxis dataKey="date" stroke="#6b7280" fontSize={12} tickLine={false} axisLine={false} />
                                                        <YAxis stroke="#6b7280" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(val) => val >= 1000 ? `${(val/1000).toFixed(1)}k` : val} />
                                                        <RechartsTooltip content={<CustomTooltip />} />
                                                        <Legend />
                                                        {selectedMovieIds.map((id) => (
                                                            <Line 
                                                                key={id}
                                                                type="linear" 
                                                                dataKey={`${id}_admissions`} 
                                                                name={compareData?.movies?.[id]?.title || id} 
                                                                stroke={movieColorsMap[id]} 
                                                                strokeWidth={4}
                                                                dot={{ r: 4, strokeWidth: 2 }}
                                                                activeDot={{ r: 6 }}
                                                            />
                                                        ))}
                                                    </LineChart>
                                                </ResponsiveContainer>
                                            </div>
                                        </TabsContent>
                                        
                                        <TabsContent value="showtimes" className="mt-4 border rounded-md p-4 bg-card">
                                            <div style={{ width: '100%', height: 600 }}>
                                                <ResponsiveContainer width="100%" height="100%">
                                                    <LineChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                                                        <XAxis dataKey="date" stroke="#6b7280" fontSize={12} tickLine={false} axisLine={false} />
                                                        <YAxis stroke="#6b7280" fontSize={12} tickLine={false} axisLine={false} />
                                                        <RechartsTooltip content={<CustomTooltip />} />
                                                        <Legend />
                                                        {selectedMovieIds.map((id) => (
                                                            <Line 
                                                                key={id}
                                                                type="linear" 
                                                                dataKey={`${id}_showtimes`} 
                                                                name={compareData?.movies?.[id]?.title || id} 
                                                                stroke={movieColorsMap[id]} 
                                                                strokeWidth={4}
                                                                dot={{ r: 4, strokeWidth: 2 }}
                                                                activeDot={{ r: 6 }}
                                                            />
                                                        ))}
                                                    </LineChart>
                                                </ResponsiveContainer>
                                            </div>
                                        </TabsContent>
                                        
                                        <TabsContent value="occupancy" className="mt-4 border rounded-md p-4 bg-card">
                                            <div style={{ width: '100%', height: 600 }}>
                                                <ResponsiveContainer width="100%" height="100%">
                                                    <LineChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                                                        <XAxis dataKey="date" stroke="#6b7280" fontSize={12} tickLine={false} axisLine={false} />
                                                        <YAxis stroke="#6b7280" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(val) => `${val}%`} />
                                                        <RechartsTooltip content={<CustomTooltip />} />
                                                        <Legend />
                                                        {selectedMovieIds.map((id) => (
                                                            <Line 
                                                                key={id}
                                                                type="linear" 
                                                                dataKey={`${id}_occupancy`} 
                                                                name={compareData?.movies?.[id]?.title || id} 
                                                                stroke={movieColorsMap[id]} 
                                                                strokeWidth={4}
                                                                dot={{ r: 4, strokeWidth: 2 }}
                                                                activeDot={{ r: 6 }}
                                                            />
                                                        ))}
                                                    </LineChart>
                                                </ResponsiveContainer>
                                            </div>
                                        </TabsContent>
                                    </Tabs>
                                </CardContent>
                            </Card>

                            {/* Table Area - Day by Day Progression */}
                            <Card className="col-span-full">
                                <CardHeader>
                                    <CardTitle>Day-by-Day Progression</CardTitle>
                                    <CardDescription>
                                        Detailed breakdown of admissions and showtimes per day.
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="overflow-x-auto">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Date</TableHead>
                                                {selectedMoviesDetails.map((movie) => (
                                                    <TableHead key={movie.id} className="text-right">
                                                        <div className="flex flex-col items-end gap-1">
                                                            <div className="flex items-center justify-end gap-2">
                                                                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: movieColorsMap[movie.id] }} />
                                                                <span className="font-bold truncate max-w-[150px] text-foreground">{movie.title}</span>
                                                            </div>
                                                            <span className="text-xs text-muted-foreground">Adm / Shows</span>
                                                        </div>
                                                    </TableHead>
                                                ))}
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                                            {chartData.map((dayData: any, index: number) => (
                                                <TableRow key={index}>
                                                    <TableCell className="font-medium">{dayData.date}</TableCell>
                                                    {selectedMovieIds.map((id) => {
                                                        const admissions = dayData[`${id}_admissions`] || 0;
                                                        const showtimes = dayData[`${id}_showtimes`] || 0;
                                                        return (
                                                            <TableCell key={id} className="text-right">
                                                                <div className="flex flex-col items-end">
                                                                    <span className="font-medium">{admissions.toLocaleString()}</span>
                                                                    <span className="text-xs text-muted-foreground">{showtimes.toLocaleString()}</span>
                                                                </div>
                                                            </TableCell>
                                                        );
                                                    })}
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </CardContent>
                            </Card>
                        </>
                    )}
                </div>
            ) : (
                <div className="flex flex-col items-center justify-center py-24 text-muted-foreground bg-muted/10 border-2 border-dashed rounded-xl gap-4">
                    <GitCompare className="w-12 h-12 opacity-50" />
                    <p className="text-lg">Select up to 6 movies to begin comparison.</p>
                </div>
            )}
        </div>
    );
}

export default function ComparePage() {
    return (
        <Suspense fallback={<div className="p-8">Loading compare dashboard...</div>}>
            <CompareDashboard />
        </Suspense>
    );
}
