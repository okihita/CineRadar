'use client';

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ArrowUp, ArrowDown, X, Film, Clock, MapPin } from 'lucide-react';

interface Showtime {
    movie_id: string;
    movie_title: string;
    city: string;
    theatre_id: string;
    theatre_name: string;
    chain: string;
    room_type: string;
    price: string;
    showtime: string;
    showtime_id: string;
    is_available: boolean;
    date: string;
}

type SortField = 'movie_title' | 'city' | 'chain' | 'room_type' | 'showtime' | 'theatre_name';
type SortDirection = 'asc' | 'desc' | null;

const ITEMS_PER_PAGE = 20;

export default function MoviesPage() {
    const [showtimes, setShowtimes] = useState<Showtime[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [date, setDate] = useState<string>('');

    // Filters
    const [searchTerm, setSearchTerm] = useState('');
    const [filterCity, setFilterCity] = useState<string>('all');
    const [filterChain, setFilterChain] = useState<string>('all');
    const [filterRoom, setFilterRoom] = useState<string>('all');
    const [showAvailableOnly, setShowAvailableOnly] = useState(true);

    // Sorting
    const [sortField, setSortField] = useState<SortField>('showtime');
    const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

    // Pagination
    const [currentPage, setCurrentPage] = useState(1);

    // Fetch data
    useEffect(() => {
        async function fetchData() {
            try {
                const res = await fetch('/api/movies');
                const data = await res.json();
                if (data.error) {
                    setError(data.error);
                } else {
                    setShowtimes(data.showtimes);
                    setDate(data.date);
                }
            } catch (err) {
                setError('Failed to fetch movie data');
            } finally {
                setLoading(false);
            }
        }
        fetchData();
    }, []);

    // Derived data
    const cities = useMemo(() =>
        [...new Set(showtimes.map(s => s.city))].sort(),
        [showtimes]
    );

    const chains = useMemo(() =>
        [...new Set(showtimes.map(s => s.chain))].filter(Boolean).sort(),
        [showtimes]
    );

    const roomTypes = useMemo(() =>
        [...new Set(showtimes.map(s => s.room_type))].filter(Boolean).sort(),
        [showtimes]
    );

    // Filter and sort
    const filteredShowtimes = useMemo(() => {
        let result = showtimes;

        // Available only
        if (showAvailableOnly) {
            result = result.filter(s => s.is_available);
        }

        // Search
        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            result = result.filter(s =>
                s.movie_title.toLowerCase().includes(term) ||
                s.theatre_name.toLowerCase().includes(term) ||
                s.city.toLowerCase().includes(term)
            );
        }

        // Filters
        if (filterCity !== 'all') {
            result = result.filter(s => s.city === filterCity);
        }
        if (filterChain !== 'all') {
            result = result.filter(s => s.chain === filterChain);
        }
        if (filterRoom !== 'all') {
            result = result.filter(s => s.room_type === filterRoom);
        }

        // Sort
        if (sortField && sortDirection) {
            result = [...result].sort((a, b) => {
                let aVal = a[sortField];
                let bVal = b[sortField];

                // Special handling for showtime (HH:MM format)
                if (sortField === 'showtime') {
                    aVal = aVal.replace(':', '');
                    bVal = bVal.replace(':', '');
                }

                const comparison = aVal.localeCompare(bVal);
                return sortDirection === 'asc' ? comparison : -comparison;
            });
        }

        return result;
    }, [showtimes, searchTerm, filterCity, filterChain, filterRoom, showAvailableOnly, sortField, sortDirection]);

    // Pagination
    const totalPages = Math.ceil(filteredShowtimes.length / ITEMS_PER_PAGE);
    const paginatedShowtimes = filteredShowtimes.slice(
        (currentPage - 1) * ITEMS_PER_PAGE,
        currentPage * ITEMS_PER_PAGE
    );

    // Reset page when filters change
    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, filterCity, filterChain, filterRoom, showAvailableOnly, sortField, sortDirection]);

    // Toggle sort
    const toggleSort = (field: SortField) => {
        if (sortField === field) {
            setSortDirection(d => d === 'asc' ? 'desc' : d === 'desc' ? null : 'asc');
        } else {
            setSortField(field);
            setSortDirection('asc');
        }
    };

    const SortIcon = ({ field }: { field: SortField }) => {
        if (sortField !== field) return null;
        return sortDirection === 'asc' ? <ArrowUp className="w-3 h-3" /> :
            sortDirection === 'desc' ? <ArrowDown className="w-3 h-3" /> : null;
    };

    const clearFilters = () => {
        setSearchTerm('');
        setFilterCity('all');
        setFilterChain('all');
        setFilterRoom('all');
        setShowAvailableOnly(true);
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-center">
                    <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-muted-foreground text-sm">Loading movie data...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background text-foreground p-6">
            {/* Header */}
            <div className="mb-6">
                <div className="flex items-center gap-3 mb-2">
                    <Film className="w-6 h-6 text-primary" />
                    <h1 className="text-2xl font-bold">Movie Intelligence</h1>
                </div>
                <p className="text-muted-foreground text-sm">
                    Showtimes and schedules across all theatres
                    {date && <span className="ml-2">• Data from {date}</span>}
                </p>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <Card>
                    <CardContent className="pt-4">
                        <div className="flex items-center gap-2">
                            <Film className="w-4 h-4 text-muted-foreground" />
                            <span className="text-xs text-muted-foreground">Movies</span>
                        </div>
                        <p className="text-2xl font-bold mt-1">
                            {new Set(showtimes.map(s => s.movie_id)).size}
                        </p>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-4">
                        <div className="flex items-center gap-2">
                            <Clock className="w-4 h-4 text-muted-foreground" />
                            <span className="text-xs text-muted-foreground">Showtimes</span>
                        </div>
                        <p className="text-2xl font-bold mt-1">
                            {filteredShowtimes.length}
                            <span className="text-sm font-normal text-muted-foreground ml-1">
                                / {showtimes.length}
                            </span>
                        </p>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-4">
                        <div className="flex items-center gap-2">
                            <MapPin className="w-4 h-4 text-muted-foreground" />
                            <span className="text-xs text-muted-foreground">Cities</span>
                        </div>
                        <p className="text-2xl font-bold mt-1">{cities.length}</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-4">
                        <div className="flex items-center gap-2">
                            <span className="w-4 h-4 rounded bg-primary text-[10px] text-primary-foreground flex items-center justify-center font-bold">T</span>
                            <span className="text-xs text-muted-foreground">Theatres</span>
                        </div>
                        <p className="text-2xl font-bold mt-1">
                            {new Set(showtimes.map(s => s.theatre_id)).size}
                        </p>
                    </CardContent>
                </Card>
            </div>

            {error && (
                <Card className="mb-6 border-destructive">
                    <CardContent className="pt-4">
                        <p className="text-destructive">{error}</p>
                    </CardContent>
                </Card>
            )}

            {/* Filters */}
            <Card className="mb-6">
                <CardContent className="pt-4">
                    <div className="flex flex-wrap items-center gap-4">
                        {/* Search */}
                        <div className="relative flex-1 min-w-[200px] max-w-xs">
                            <Input
                                placeholder="Search movie, theatre..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="h-9 text-sm pr-8"
                            />
                            {searchTerm && (
                                <button
                                    onClick={() => setSearchTerm('')}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            )}
                        </div>

                        {/* City Filter */}
                        <select
                            value={filterCity}
                            onChange={(e) => setFilterCity(e.target.value)}
                            className="h-9 px-3 rounded-md border text-sm bg-background"
                        >
                            <option value="all">All Cities ({cities.length})</option>
                            {cities.map(c => (
                                <option key={c} value={c}>{c}</option>
                            ))}
                        </select>

                        {/* Chain Filter */}
                        <select
                            value={filterChain}
                            onChange={(e) => setFilterChain(e.target.value)}
                            className="h-9 px-3 rounded-md border text-sm bg-background"
                        >
                            <option value="all">All Chains</option>
                            {chains.map(c => (
                                <option key={c} value={c}>{c}</option>
                            ))}
                        </select>

                        {/* Room Type Filter */}
                        <select
                            value={filterRoom}
                            onChange={(e) => setFilterRoom(e.target.value)}
                            className="h-9 px-3 rounded-md border text-sm bg-background"
                        >
                            <option value="all">All Room Types</option>
                            {roomTypes.map(r => (
                                <option key={r} value={r}>{r}</option>
                            ))}
                        </select>

                        {/* Available Only Toggle */}
                        <label className="flex items-center gap-2 text-sm cursor-pointer">
                            <input
                                type="checkbox"
                                checked={showAvailableOnly}
                                onChange={(e) => setShowAvailableOnly(e.target.checked)}
                                className="rounded"
                            />
                            Available only
                        </label>

                        {/* Clear All */}
                        {(searchTerm || filterCity !== 'all' || filterChain !== 'all' || filterRoom !== 'all') && (
                            <Button variant="ghost" size="sm" onClick={clearFilters} className="h-9">
                                Clear All
                            </Button>
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* Showtime Table */}
            <Card>
                <CardHeader className="py-3 px-4">
                    <CardTitle className="text-sm">
                        Showtimes
                        <span className="font-normal text-muted-foreground ml-2">
                            {filteredShowtimes.length} results
                        </span>
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
                        <Table>
                            <TableHeader className="sticky top-0 bg-background z-10">
                                <TableRow className="text-xs">
                                    <TableHead
                                        className="cursor-pointer hover:bg-muted/50 select-none"
                                        onClick={() => toggleSort('showtime')}
                                    >
                                        <span className="inline-flex items-center gap-1">
                                            Showtime <SortIcon field="showtime" />
                                        </span>
                                    </TableHead>
                                    <TableHead
                                        className="cursor-pointer hover:bg-muted/50 select-none"
                                        onClick={() => toggleSort('movie_title')}
                                    >
                                        <span className="inline-flex items-center gap-1">
                                            Movie <SortIcon field="movie_title" />
                                        </span>
                                    </TableHead>
                                    <TableHead
                                        className="cursor-pointer hover:bg-muted/50 select-none"
                                        onClick={() => toggleSort('city')}
                                    >
                                        <span className="inline-flex items-center gap-1">
                                            City <SortIcon field="city" />
                                        </span>
                                    </TableHead>
                                    <TableHead
                                        className="cursor-pointer hover:bg-muted/50 select-none"
                                        onClick={() => toggleSort('theatre_name')}
                                    >
                                        <span className="inline-flex items-center gap-1">
                                            Theatre <SortIcon field="theatre_name" />
                                        </span>
                                    </TableHead>
                                    <TableHead
                                        className="cursor-pointer hover:bg-muted/50 select-none"
                                        onClick={() => toggleSort('chain')}
                                    >
                                        <span className="inline-flex items-center gap-1">
                                            Chain <SortIcon field="chain" />
                                        </span>
                                    </TableHead>
                                    <TableHead
                                        className="cursor-pointer hover:bg-muted/50 select-none"
                                        onClick={() => toggleSort('room_type')}
                                    >
                                        <span className="inline-flex items-center gap-1">
                                            Room <SortIcon field="room_type" />
                                        </span>
                                    </TableHead>
                                    <TableHead>Price</TableHead>
                                    <TableHead>Status</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {paginatedShowtimes.length > 0 ? paginatedShowtimes.map((st, idx) => (
                                    <TableRow
                                        key={`${st.showtime_id}-${idx}`}
                                        className={idx % 2 === 0 ? 'bg-transparent' : 'bg-muted/20'}
                                    >
                                        <TableCell className="font-mono font-medium text-primary">
                                            {st.showtime}
                                        </TableCell>
                                        <TableCell className="max-w-[200px]">
                                            <p className="font-medium truncate" title={st.movie_title}>
                                                {st.movie_title}
                                            </p>
                                        </TableCell>
                                        <TableCell>{st.city}</TableCell>
                                        <TableCell className="max-w-[150px]">
                                            <p className="truncate" title={st.theatre_name}>
                                                {st.theatre_name}
                                            </p>
                                        </TableCell>
                                        <TableCell>
                                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${st.chain === 'XXI' ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400' :
                                                    st.chain === 'CGV' ? 'bg-red-500/20 text-red-600 dark:text-red-400' :
                                                        'bg-blue-500/20 text-blue-600 dark:text-blue-400'
                                                }`}>
                                                {st.chain}
                                            </span>
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="outline" className="text-xs">
                                                {st.room_type}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-muted-foreground text-xs">
                                            {st.price}
                                        </TableCell>
                                        <TableCell>
                                            {st.is_available ? (
                                                <Badge variant="default" className="text-xs bg-green-600">
                                                    Available
                                                </Badge>
                                            ) : (
                                                <Badge variant="secondary" className="text-xs">
                                                    Past
                                                </Badge>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                )) : (
                                    <TableRow>
                                        <TableCell colSpan={8} className="text-center py-12">
                                            <div className="text-muted-foreground">
                                                <p className="text-sm font-medium mb-2">No showtimes found</p>
                                                <p className="text-xs mb-4">Try adjusting your filters</p>
                                                <Button variant="outline" size="sm" onClick={clearFilters}>
                                                    Clear filters
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>

                    {/* Pagination */}
                    {totalPages > 1 && (
                        <div className="flex items-center justify-between px-4 py-2 border-t text-xs">
                            <Button
                                variant="ghost"
                                size="sm"
                                disabled={currentPage === 1}
                                onClick={() => setCurrentPage(p => p - 1)}
                            >
                                ← Previous
                            </Button>
                            <span className="text-muted-foreground">
                                Page {currentPage} of {totalPages}
                            </span>
                            <Button
                                variant="ghost"
                                size="sm"
                                disabled={currentPage === totalPages}
                                onClick={() => setCurrentPage(p => p + 1)}
                            >
                                Next →
                            </Button>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
