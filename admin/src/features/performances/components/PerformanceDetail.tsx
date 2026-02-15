/**
 * Performance Detail Component
 * 
 * Shows details for a specific movie, including:
 * - Movie metadata (title, poster)
 * - Date selector (from history)
 * - Daily stats
 * - Showtimes list with sorting, filtering, grouping, and pagination
 */
'use client';

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Target, Users, Armchair, MapPin, Clock, Loader2, Calendar, ChevronLeft, Filter, ArrowUpDown, Layers, ChevronDown, ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import Image from 'next/image';
import { useRouter } from 'next/navigation';

interface MovieSummary {
    id: string;
    movie_id: string;
    title: string;
    poster: string;
    last_updated: string;
    genres?: string;
    age_category?: string;
}

interface DailyPerformance {
    date: string;
    total_showtimes: number;
    avg_occupancy_pct: number;
    total_seats: number;
    total_sold: number;
    cities: string[];
}

interface ShowtimeSnapshot {
    id: string;
    showtime_id: string;
    movie_title: string;
    theatre_name: string;
    city: string;
    room_category: string;
    merchant: string;
    showtime: string;
    total_seats: number;
    sold_seats: number;
    occupancy_pct: number;
}

type SortField = 'showtime' | 'occupancy' | 'theatre' | 'city';
type SortDirection = 'asc' | 'desc';
type GroupBy = 'none' | 'theatre' | 'city' | 'merchant';

const PAGE_SIZES = [20, 50, 100, 200];

// Merchant colors for badges
const MERCHANT_COLORS: Record<string, string> = {
    'CGV': 'bg-red-500',
    'XXI': 'bg-blue-600',
    'Cinépolis': 'bg-purple-600',
    'CINEPOLIS': 'bg-purple-600',
};

interface PerformanceDetailProps {
    movieId: string;
}

export function PerformanceDetail({ movieId }: PerformanceDetailProps) {
    const router = useRouter();
    const [movie, setMovie] = useState<MovieSummary | null>(null);
    const [history, setHistory] = useState<DailyPerformance[]>([]);
    const [selectedDate, setSelectedDate] = useState<string | null>(null);
    const [showtimes, setShowtimes] = useState<ShowtimeSnapshot[]>([]);

    // Loading states
    const [loadingMovie, setLoadingMovie] = useState(true);
    const [loadingHistory, setLoadingHistory] = useState(true);
    const [loadingShowtimes, setLoadingShowtimes] = useState(false);

    // UI state for table
    const [sortField, setSortField] = useState<SortField>('showtime');
    const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
    const [groupBy, setGroupBy] = useState<GroupBy>('none');
    const [pageSize, setPageSize] = useState(50);
    const [currentPage, setCurrentPage] = useState(1);
    const [showAll, setShowAll] = useState(false);

    // Filter state
    const [filterCity, setFilterCity] = useState<string>('all');
    const [filterMerchant, setFilterMerchant] = useState<string>('all');
    const [filterRoom, setFilterRoom] = useState<string>('all');

    // 1. Fetch Movie Summary
    useEffect(() => {
        async function fetchMovie() {
            try {
                const res = await fetch(`/api/performance/${movieId}`);
                const data = await res.json();
                if (data.success) {
                    setMovie(data.summary);
                } else {
                    console.error('Failed to load movie:', data.error);
                }
            } catch (e) {
                console.error('Error fetching movie:', e);
            } finally {
                setLoadingMovie(false);
            }
        }
        fetchMovie();
    }, [movieId]);

    // 2. Fetch History
    useEffect(() => {
        async function fetchHistory() {
            try {
                const res = await fetch(`/api/performance/${movieId}/history`);
                const data = await res.json();
                if (data.success) {
                    setHistory(data.history);
                    // Select most recent date by default if available
                    if (data.history.length > 0) {
                        setSelectedDate(data.history[0].date);
                    }
                }
            } catch (e) {
                console.error('Error fetching history:', e);
            } finally {
                setLoadingHistory(false);
            }
        }
        fetchHistory();
    }, [movieId]);

    // 3. Fetch Showtimes when Date changes
    useEffect(() => {
        if (!selectedDate) {
            setShowtimes([]);
            return;
        }

        async function fetchShowtimes() {
            setLoadingShowtimes(true);
            try {
                const res = await fetch(`/api/performance/${movieId}/days/${selectedDate}`);
                const data = await res.json();
                if (data.success) {
                    setShowtimes(data.showtimes);
                    // Reset filters and pagination when date changes
                    setCurrentPage(1);
                    setFilterCity('all');
                    setFilterMerchant('all');
                    setFilterRoom('all');
                }
            } catch (e) {
                console.error('Error fetching showtimes:', e);
            } finally {
                setLoadingShowtimes(false);
            }
        }
        fetchShowtimes();
    }, [movieId, selectedDate]);

    // Derived state for current date stats
    const selectedStats = history.find(d => d.date === selectedDate);

    // Extract unique filter options from showtimes
    const filterOptions = useMemo(() => {
        const cities = new Set<string>();
        const merchants = new Set<string>();
        const rooms = new Set<string>();

        showtimes.forEach(st => {
            if (st.city) cities.add(st.city);
            if (st.merchant) merchants.add(st.merchant);
            if (st.room_category) rooms.add(st.room_category);
        });

        return {
            cities: Array.from(cities).sort(),
            merchants: Array.from(merchants).sort(),
            rooms: Array.from(rooms).sort(),
        };
    }, [showtimes]);

    // Filtered and sorted showtimes
    const processedShowtimes = useMemo(() => {
        let result = [...showtimes];

        // Apply filters
        if (filterCity !== 'all') {
            result = result.filter(st => st.city === filterCity);
        }
        if (filterMerchant !== 'all') {
            result = result.filter(st => st.merchant === filterMerchant);
        }
        if (filterRoom !== 'all') {
            result = result.filter(st => st.room_category === filterRoom);
        }

        // Apply sorting
        result.sort((a, b) => {
            let comparison = 0;
            switch (sortField) {
                case 'showtime':
                    comparison = a.showtime.localeCompare(b.showtime);
                    break;
                case 'occupancy':
                    comparison = a.occupancy_pct - b.occupancy_pct;
                    break;
                case 'theatre':
                    comparison = a.theatre_name.localeCompare(b.theatre_name);
                    break;
                case 'city':
                    comparison = a.city.localeCompare(b.city);
                    break;
            }
            return sortDirection === 'asc' ? comparison : -comparison;
        });

        return result;
    }, [showtimes, filterCity, filterMerchant, filterRoom, sortField, sortDirection]);

    // Grouped showtimes
    const groupedShowtimes = useMemo(() => {
        if (groupBy === 'none') {
            return null;
        }

        const groups = new Map<string, ShowtimeSnapshot[]>();
        processedShowtimes.forEach(st => {
            let key: string;
            switch (groupBy) {
                case 'theatre':
                    key = st.theatre_name;
                    break;
                case 'city':
                    key = st.city;
                    break;
                case 'merchant':
                    key = st.merchant;
                    break;
                default:
                    key = 'Other';
            }

            if (!groups.has(key)) {
                groups.set(key, []);
            }
            groups.get(key)!.push(st);
        });

        // Sort groups
        return Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b));
    }, [processedShowtimes, groupBy]);

    // Paginated showtimes (only when not grouped and not showing all)
    const paginatedShowtimes = useMemo(() => {
        if (showAll || groupBy !== 'none') {
            return processedShowtimes;
        }
        const start = (currentPage - 1) * pageSize;
        return processedShowtimes.slice(start, start + pageSize);
    }, [processedShowtimes, showAll, groupBy, currentPage, pageSize]);

    // Summary stats for filtered data
    const summaryStats = useMemo(() => {
        const totalShowtimes = processedShowtimes.length;
        const totalSeats = processedShowtimes.reduce((sum, st) => sum + st.total_seats, 0);
        const totalSold = processedShowtimes.reduce((sum, st) => sum + st.sold_seats, 0);
        const avgOccupancy = totalSeats > 0 ? (totalSold / totalSeats * 100) : 0;

        return { totalShowtimes, totalSeats, totalSold, avgOccupancy };
    }, [processedShowtimes]);

    const totalPages = Math.ceil(processedShowtimes.length / pageSize);

    // Reset page when filters change
    useEffect(() => {
        setCurrentPage(1);
    }, [filterCity, filterMerchant, filterRoom, sortField, sortDirection]);

    const toggleSort = (field: SortField) => {
        if (sortField === field) {
            setSortDirection(d => d === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortDirection('asc');
        }
    };

    if (loadingMovie) {
        return (
            <div className="flex items-center justify-center min-h-[50vh]">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    if (!movie) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4">
                <Target className="w-12 h-12 text-muted-foreground" />
                <h2 className="text-xl font-semibold">Movie not found</h2>
                <Button onClick={() => router.push('/performances')}>Back to Performances</Button>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background text-foreground p-6 space-y-6 animate-in fade-in duration-500">
            {/* Header / Nav */}
            <div className="flex items-start gap-4">
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => router.push('/performances')}
                    className="mt-1"
                >
                    <ChevronLeft className="w-6 h-6" />
                </Button>

                <div className="flex gap-4">
                    <div className="relative w-24 aspect-[2/3] rounded-md overflow-hidden bg-muted shadow-sm">
                        {movie.poster ? (
                            <Image
                                src={movie.poster}
                                alt={movie.title}
                                fill
                                className="object-cover"
                                sizes="100px"
                            />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                                <Target className="w-6 h-6" />
                            </div>
                        )}
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">{movie.title}</h1>
                        <p className="text-sm text-muted-foreground/80 mt-1 max-w-xl">
                            {movie.genres || 'Genre N/A'} • {movie.age_category || 'Rating N/A'}
                        </p>
                        <div className="flex gap-2 mt-3">
                            <Badge variant="secondary" className="text-xs font-normal">
                                Updated: {new Date(movie.last_updated).toLocaleDateString()}
                            </Badge>
                        </div>
                    </div>
                </div>
            </div>

            {/* Date Selector */}
            <Card>
                <CardHeader className="pb-3 px-4 pt-4">
                    <CardTitle className="text-sm flex items-center gap-2 text-muted-foreground">
                        <Calendar className="w-4 h-4" />
                        Select Date
                    </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                    {loadingHistory ? (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Loading history...
                        </div>
                    ) : history.length === 0 ? (
                        <span className="text-sm text-muted-foreground">No history available</span>
                    ) : (
                        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin scrollbar-thumb-muted-foreground/20">
                            {history.map((day) => (
                                <Badge
                                    key={day.date}
                                    variant={selectedDate === day.date ? "default" : "outline"}
                                    className={cn(
                                        "cursor-pointer hover:bg-primary/90 whitespace-nowrap px-3 py-1 text-sm font-medium transition-colors",
                                        selectedDate === day.date
                                            ? "ring-2 ring-offset-1 ring-primary"
                                            : "hover:text-primary-foreground hover:bg-primary"
                                    )}
                                    onClick={() => setSelectedDate(day.date)}
                                >
                                    {day.date}
                                </Badge>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Daily Stats & Showtimes */}
            {selectedStats ? (
                <>
                    {/* KPI Cards */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <Card>
                            <CardContent className="pt-4">
                                <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1 font-medium">
                                    <Target className="w-3 h-3" />
                                    OCCUPANCY
                                </div>
                                <p className="text-2xl font-bold tracking-tight">
                                    {selectedStats.avg_occupancy_pct.toFixed(1)}%
                                </p>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardContent className="pt-4">
                                <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1 font-medium">
                                    <Armchair className="w-3 h-3" />
                                    TOTAL SEATS
                                </div>
                                <p className="text-2xl font-bold tracking-tight">
                                    {selectedStats.total_seats.toLocaleString()}
                                </p>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardContent className="pt-4">
                                <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1 font-medium">
                                    <Users className="w-3 h-3" />
                                    SOLD
                                </div>
                                <p className="text-2xl font-bold tracking-tight">
                                    {selectedStats.total_sold.toLocaleString()}
                                </p>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardContent className="pt-4">
                                <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1 font-medium">
                                    <MapPin className="w-3 h-3" />
                                    CITIES
                                </div>
                                <p className="text-2xl font-bold tracking-tight">
                                    {selectedStats.cities?.length || 0}
                                </p>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Filters & Controls */}
                    <Card>
                        <CardHeader className="pb-3 px-4 pt-4">
                            <CardTitle className="text-sm flex items-center gap-2 text-muted-foreground">
                                <Filter className="w-4 h-4" />
                                Filters & Display Options
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="px-4 pb-4">
                            <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
                                {/* City Filter */}
                                <Select value={filterCity} onValueChange={setFilterCity}>
                                    <SelectTrigger className="h-8 text-xs">
                                        <SelectValue placeholder="City" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All Cities</SelectItem>
                                        {filterOptions.cities.map(city => (
                                            <SelectItem key={city} value={city}>{city}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>

                                {/* Merchant Filter */}
                                <Select value={filterMerchant} onValueChange={setFilterMerchant}>
                                    <SelectTrigger className="h-8 text-xs">
                                        <SelectValue placeholder="Merchant" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All Merchants</SelectItem>
                                        {filterOptions.merchants.map(merchant => (
                                            <SelectItem key={merchant} value={merchant}>{merchant}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>

                                {/* Room Filter */}
                                <Select value={filterRoom} onValueChange={setFilterRoom}>
                                    <SelectTrigger className="h-8 text-xs">
                                        <SelectValue placeholder="Room" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All Rooms</SelectItem>
                                        {filterOptions.rooms.map(room => (
                                            <SelectItem key={room} value={room}>{room}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>

                                {/* Group By */}
                                <Select value={groupBy} onValueChange={(v) => setGroupBy(v as GroupBy)}>
                                    <SelectTrigger className="h-8 text-xs">
                                        <Layers className="w-3 h-3 mr-1" />
                                        <SelectValue placeholder="Group by" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="none">No Grouping</SelectItem>
                                        <SelectItem value="theatre">By Theatre</SelectItem>
                                        <SelectItem value="city">By City</SelectItem>
                                        <SelectItem value="merchant">By Merchant</SelectItem>
                                    </SelectContent>
                                </Select>

                                {/* Page Size */}
                                <Select
                                    value={showAll ? 'all' : String(pageSize)}
                                    onValueChange={(v) => {
                                        if (v === 'all') {
                                            setShowAll(true);
                                        } else {
                                            setShowAll(false);
                                            setPageSize(Number(v));
                                        }
                                    }}
                                >
                                    <SelectTrigger className="h-8 text-xs">
                                        <SelectValue placeholder="Show" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {PAGE_SIZES.map(size => (
                                            <SelectItem key={size} value={String(size)}>{size} rows</SelectItem>
                                        ))}
                                        <SelectItem value="all">Show All</SelectItem>
                                    </SelectContent>
                                </Select>

                                {/* Results count */}
                                <div className="flex items-center justify-end text-xs text-muted-foreground">
                                    {processedShowtimes.length} results
                                    {(filterCity !== 'all' || filterMerchant !== 'all' || filterRoom !== 'all') && (
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-6 px-2 ml-2"
                                            onClick={() => {
                                                setFilterCity('all');
                                                setFilterMerchant('all');
                                                setFilterRoom('all');
                                            }}
                                        >
                                            Clear
                                        </Button>
                                    )}
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Showtimes Table */}
                    <Card>
                        <CardHeader className="pb-2 flex flex-row items-center justify-between">
                            <CardTitle className="text-base font-semibold">
                                Showtimes Breakdown
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            {loadingShowtimes ? (
                                <div className="py-12 flex justify-center">
                                    <Loader2 className="w-8 h-8 animate-spin text-muted-foreground/50" />
                                </div>
                            ) : processedShowtimes.length === 0 ? (
                                <div className="py-12 text-center text-muted-foreground text-sm">
                                    No showtimes found for this date.
                                </div>
                            ) : groupBy !== 'none' && groupedShowtimes ? (
                                // Grouped View
                                <div className="space-y-4">
                                    {groupedShowtimes.map(([groupName, items]) => (
                                        <GroupedSection
                                            key={groupName}
                                            title={groupName}
                                            items={items}
                                            toggleSort={toggleSort}
                                        />
                                    ))}
                                </div>
                            ) : (
                                // Regular Table View
                                <div className="space-y-4">
                                    <div className="overflow-x-auto rounded-md border">
                                        <table className="w-full text-sm">
                                            <thead>
                                                <tr className="bg-muted/50 border-b text-left text-muted-foreground">
                                                    <th
                                                        className="py-3 px-4 font-medium w-24 cursor-pointer hover:bg-muted"
                                                        onClick={() => toggleSort('showtime')}
                                                    >
                                                        <div className="flex items-center gap-1">
                                                            <Clock className="w-3 h-3" />
                                                            Time
                                                            {sortField === 'showtime' && (
                                                                <ArrowUpDown className="w-3 h-3" />
                                                            )}
                                                        </div>
                                                    </th>
                                                    <th
                                                        className="py-3 px-4 font-medium cursor-pointer hover:bg-muted"
                                                        onClick={() => toggleSort('theatre')}
                                                    >
                                                        <div className="flex items-center gap-1">
                                                            Theatre
                                                            {sortField === 'theatre' && (
                                                                <ArrowUpDown className="w-3 h-3" />
                                                            )}
                                                        </div>
                                                    </th>
                                                    <th
                                                        className="py-3 px-4 font-medium cursor-pointer hover:bg-muted"
                                                        onClick={() => toggleSort('city')}
                                                    >
                                                        <div className="flex items-center gap-1">
                                                            City
                                                            {sortField === 'city' && (
                                                                <ArrowUpDown className="w-3 h-3" />
                                                            )}
                                                        </div>
                                                    </th>
                                                    <th className="py-3 px-4 font-medium">Room</th>
                                                    <th
                                                        className="py-3 px-4 font-medium w-48 cursor-pointer hover:bg-muted"
                                                        onClick={() => toggleSort('occupancy')}
                                                    >
                                                        <div className="flex items-center gap-1">
                                                            Occupancy
                                                            {sortField === 'occupancy' && (
                                                                <ArrowUpDown className="w-3 h-3" />
                                                            )}
                                                        </div>
                                                    </th>
                                                    <th className="py-3 px-4 font-medium text-right w-24">Seats</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {paginatedShowtimes.map((st) => (
                                                    <ShowtimeRow key={st.id} showtime={st} />
                                                ))}
                                            </tbody>
                                            {/* Summary Row */}
                                            <tfoot>
                                                <tr className="bg-muted/30 border-t-2 font-medium">
                                                    <td className="py-3 px-4" colSpan={4}>
                                                        Total ({summaryStats.totalShowtimes} showtimes)
                                                    </td>
                                                    <td className="py-3 px-4">
                                                        <div className="flex items-center gap-3">
                                                            <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                                                                <div
                                                                    className={cn(
                                                                        "h-full rounded-full",
                                                                        summaryStats.avgOccupancy > 80 ? "bg-red-500" :
                                                                            summaryStats.avgOccupancy > 50 ? "bg-amber-500" : "bg-primary"
                                                                    )}
                                                                    style={{ width: `${Math.min(summaryStats.avgOccupancy, 100)}%` }}
                                                                />
                                                            </div>
                                                            <span className="text-xs w-10 text-right font-mono">
                                                                {summaryStats.avgOccupancy.toFixed(1)}%
                                                            </span>
                                                        </div>
                                                    </td>
                                                    <td className="py-3 px-4 text-right font-mono">
                                                        <span className="text-foreground">{summaryStats.totalSold.toLocaleString()}</span>
                                                        <span className="opacity-50">/{summaryStats.totalSeats.toLocaleString()}</span>
                                                    </td>
                                                </tr>
                                            </tfoot>
                                        </table>
                                    </div>

                                    {/* Pagination */}
                                    {!showAll && totalPages > 1 && (
                                        <div className="flex items-center justify-between">
                                            <p className="text-xs text-muted-foreground">
                                                Page {currentPage} of {totalPages}
                                            </p>
                                            <div className="flex gap-2">
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    disabled={currentPage === 1}
                                                    onClick={() => setCurrentPage(p => p - 1)}
                                                >
                                                    Previous
                                                </Button>
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    disabled={currentPage === totalPages}
                                                    onClick={() => setCurrentPage(p => p + 1)}
                                                >
                                                    Next
                                                </Button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </>
            ) : (
                !loadingHistory && (
                    <div className="py-12 text-center text-muted-foreground">
                        <Calendar className="w-12 h-12 mx-auto mb-3 opacity-20" />
                        <p>Select a date to view performance details for this movie.</p>
                    </div>
                )
            )}
        </div>
    );
}

// Showtime Row Component
function ShowtimeRow({ showtime: st }: { showtime: ShowtimeSnapshot }) {
    const merchantColor = MERCHANT_COLORS[st.merchant] || 'bg-gray-500';

    return (
        <tr className="border-b last:border-0 hover:bg-muted/20 transition-colors">
            <td className="py-3 px-4 font-mono font-medium text-foreground">{st.showtime}</td>
            <td className="py-3 px-4">
                <div className="flex items-center gap-2">
                    <div className={cn("w-1.5 h-4 rounded-full", merchantColor)} />
                    <span className="font-medium">{st.theatre_name}</span>
                </div>
            </td>
            <td className="py-3 px-4 text-muted-foreground">{st.city}</td>
            <td className="py-3 px-4">
                <Badge variant="outline" className="text-xs font-normal text-muted-foreground">
                    {st.room_category}
                </Badge>
            </td>
            <td className="py-3 px-4">
                <div className="flex items-center gap-3">
                    <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                        <div
                            className={cn(
                                "h-full rounded-full transition-all duration-500",
                                st.occupancy_pct > 80 ? "bg-red-500" :
                                    st.occupancy_pct > 50 ? "bg-amber-500" : "bg-primary"
                            )}
                            style={{ width: `${st.occupancy_pct}%` }}
                        />
                    </div>
                    <span className="text-xs w-10 text-right font-mono text-muted-foreground">
                        {st.occupancy_pct}%
                    </span>
                </div>
            </td>
            <td className="py-3 px-4 text-right font-mono text-muted-foreground">
                <span className="text-foreground font-medium">{st.sold_seats}</span>
                <span className="opacity-50">/{st.total_seats}</span>
            </td>
        </tr>
    );
}

// Grouped Section Component
function GroupedSection({
    title,
    items,
    toggleSort,
}: {
    title: string;
    items: ShowtimeSnapshot[];
    toggleSort: (field: SortField) => void;
}) {
    const [expanded, setExpanded] = useState(true);

    // Calculate group summary
    const totalSeats = items.reduce((sum, st) => sum + st.total_seats, 0);
    const totalSold = items.reduce((sum, st) => sum + st.sold_seats, 0);
    const avgOccupancy = totalSeats > 0 ? (totalSold / totalSeats * 100) : 0;

    return (
        <div className="border rounded-md overflow-hidden">
            <button
                className="w-full flex items-center justify-between p-3 bg-muted/50 hover:bg-muted/70 transition-colors"
                onClick={() => setExpanded(!expanded)}
            >
                <div className="flex items-center gap-2">
                    {expanded ? (
                        <ChevronDown className="w-4 h-4" />
                    ) : (
                        <ChevronRight className="w-4 h-4" />
                    )}
                    <span className="font-medium">{title}</span>
                    <Badge variant="secondary" className="text-xs">
                        {items.length} showtimes
                    </Badge>
                </div>
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span>Avg: {avgOccupancy.toFixed(1)}%</span>
                    <span>{totalSold}/{totalSeats} seats</span>
                </div>
            </button>

            {expanded && (
                <table className="w-full text-sm">
                    <thead>
                        <tr className="bg-muted/30 border-b text-left text-muted-foreground text-xs">
                            <th
                                className="py-2 px-4 font-medium cursor-pointer hover:bg-muted"
                                onClick={() => toggleSort('showtime')}
                            >
                                Time
                            </th>
                            <th
                                className="py-2 px-4 font-medium cursor-pointer hover:bg-muted"
                                onClick={() => toggleSort('theatre')}
                            >
                                Theatre
                            </th>
                            <th className="py-2 px-4 font-medium">Room</th>
                            <th
                                className="py-2 px-4 font-medium cursor-pointer hover:bg-muted"
                                onClick={() => toggleSort('occupancy')}
                            >
                                Occupancy
                            </th>
                            <th className="py-2 px-4 font-medium text-right">Seats</th>
                        </tr>
                    </thead>
                    <tbody>
                        {items.map((st) => (
                            <ShowtimeRow key={st.id} showtime={st} />
                        ))}
                    </tbody>
                </table>
            )}
        </div>
    );
}
