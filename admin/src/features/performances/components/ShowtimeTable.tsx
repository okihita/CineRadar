'use client';
import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Clock, Filter, ArrowUpDown, Layers, ChevronDown, ChevronRight, ChevronFirst, ChevronLast, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SeatProgressBar } from './SeatProgressBar';
import { SeatBreakdownCard } from './SeatBreakdownCard';
import { SeatMapVisualizer } from './SeatMapVisualizer';
import { TrueAudienceBadge } from './TrueAudienceBadge';

export interface ShowtimeSnapshot {
    id: string;
    showtime_id: string;
    movie_title: string;
    theatre_name: string;
    city: string;
    room_category: string;
    merchant: string;
    showtime: string;
    total_seats: number;
    sold_seats: number; // Legacy/fallback count
    occupancy_pct: number; // Legacy/fallback count

    // True Audience Metrics (Delta Calculation from Phase 2)
    initial_unavailable?: number;
    final_unavailable?: number;
    audience_count?: number;
    audience_pct?: number;

    // Scrape details
    scrape_phase?: string;
    scraped_at?: string;

    // Studio and pricing info
    studio_id?: string;
    price?: number;
}

type SortField = 'showtime' | 'occupancy' | 'theatre' | 'city';
type SortDirection = 'asc' | 'desc';
type GroupBy = 'none' | 'theatre' | 'city' | 'merchant';

const PAGE_SIZES = [20, 50, 100, 200];

const MERCHANT_COLORS: Record<string, string> = {
    'CGV': 'bg-red-500',
    'XXI': 'bg-blue-600',
    'Cinépolis': 'bg-purple-600',
    'CINEPOLIS': 'bg-purple-600',
};

interface ShowtimeTableProps {
    showtimes: ShowtimeSnapshot[];
    loading?: boolean;
}

export function ShowtimeTable({ showtimes, loading = false }: ShowtimeTableProps) {
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
    const [filterHour, setFilterHour] = useState<string>('all');

    // Extract unique filter options from showtimes
    const filterOptions = useMemo(() => {
        const cities = new Set<string>();
        const merchants = new Set<string>();
        const rooms = new Set<string>();
        const hours = new Set<string>();

        showtimes.forEach(st => {
            if (st.city) cities.add(st.city);
            if (st.merchant) merchants.add(st.merchant);
            if (st.room_category) rooms.add(st.room_category);
            // Extract hour from showtime (e.g., "10:00" -> "10")
            if (st.showtime) {
                const hour = st.showtime.split(':')[0];
                if (hour) hours.add(hour.padStart(2, '0'));
            }
        });

        return {
            cities: Array.from(cities).sort(),
            merchants: Array.from(merchants).sort(),
            rooms: Array.from(rooms).sort(),
            hours: Array.from(hours).sort((a, b) => parseInt(a) - parseInt(b)),
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
        if (filterHour !== 'all') {
            result = result.filter(st => st.showtime.startsWith(filterHour));
        }

        // Apply sorting
        result.sort((a, b) => {
            let comparison = 0;
            switch (sortField) {
                case 'showtime':
                    comparison = a.showtime.localeCompare(b.showtime);
                    break;
                case 'occupancy':
                    const occA = a.audience_pct !== undefined ? a.audience_pct : a.occupancy_pct;
                    const occB = b.audience_pct !== undefined ? b.audience_pct : b.occupancy_pct;
                    comparison = occA - occB;
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
    }, [showtimes, filterCity, filterMerchant, filterRoom, filterHour, sortField, sortDirection]);

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

        // Use true audience_count if available, otherwise fallback to raw sold_seats
        const totalSold = processedShowtimes.reduce((sum, st) => sum + (st.audience_count ?? st.sold_seats), 0);
        const avgOccupancy = totalSeats > 0 ? (totalSold / totalSeats * 100) : 0;

        return { totalShowtimes, totalSeats, totalSold, avgOccupancy };
    }, [processedShowtimes]);

    const totalPages = Math.ceil(processedShowtimes.length / pageSize);

    const handleFilterChange = (setter: React.Dispatch<React.SetStateAction<string>>, value: string) => {
        setter(value);
        setCurrentPage(1);
    };

    const toggleSort = (field: SortField) => {
        if (sortField === field) {
            setSortDirection(d => d === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortDirection('asc');
        }
        setCurrentPage(1);
    };

    return (
        <>
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
                        <Select value={filterCity} onValueChange={(v) => handleFilterChange(setFilterCity, v)}>
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
                        <Select value={filterMerchant} onValueChange={(v) => handleFilterChange(setFilterMerchant, v)}>
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
                        <Select value={filterRoom} onValueChange={(v) => handleFilterChange(setFilterRoom, v)}>
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
                            {(filterCity !== 'all' || filterMerchant !== 'all' || filterRoom !== 'all' || filterHour !== 'all') && (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 px-2 ml-2"
                                    onClick={() => {
                                        setFilterCity('all');
                                        setFilterMerchant('all');
                                        setFilterRoom('all');
                                        setFilterHour('all');
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
                <CardHeader className="pb-2">
                    <div className="flex flex-row items-center justify-between mb-3">
                        <CardTitle className="text-base font-semibold">
                            Showtimes Breakdown
                        </CardTitle>
                        {/* Top Pagination */}
                        {!showAll && totalPages > 1 && (
                            <div className="flex items-center gap-2">
                                <span className="text-xs text-muted-foreground">
                                    Page {currentPage} of {totalPages}
                                </span>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-7 w-7 p-0"
                                    disabled={currentPage === 1}
                                    onClick={() => setCurrentPage(1)}
                                >
                                    <ChevronFirst className="w-3 h-3" />
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-7 px-2"
                                    disabled={currentPage === 1}
                                    onClick={() => setCurrentPage(p => p - 1)}
                                >
                                    Prev
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-7 px-2"
                                    disabled={currentPage === totalPages}
                                    onClick={() => setCurrentPage(p => p + 1)}
                                >
                                    Next
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-7 w-7 p-0"
                                    disabled={currentPage === totalPages}
                                    onClick={() => setCurrentPage(totalPages)}
                                >
                                    <ChevronLast className="w-3 h-3" />
                                </Button>
                            </div>
                        )}
                    </div>
                    {/* Hour Filter Chips */}
                    {filterOptions.hours.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                            <Button
                                variant={filterHour === 'all' ? 'secondary' : 'ghost'}
                                size="sm"
                                className={cn(
                                    'h-7 px-2.5 text-xs rounded-full',
                                    filterHour === 'all' && 'bg-primary/10 text-primary hover:bg-primary/20'
                                )}
                                onClick={() => handleFilterChange(setFilterHour, 'all')}
                            >
                                All
                            </Button>
                            {filterOptions.hours.map(hour => (
                                <Button
                                    key={hour}
                                    variant={filterHour === hour ? 'secondary' : 'ghost'}
                                    size="sm"
                                    className={cn(
                                        'h-7 px-2.5 text-xs rounded-full',
                                        filterHour === hour && 'bg-primary/10 text-primary hover:bg-primary/20'
                                    )}
                                    onClick={() => handleFilterChange(setFilterHour, hour)}
                                >
                                    {hour}:00
                                </Button>
                            ))}
                        </div>
                    )}
                </CardHeader>
                <CardContent>
                    {loading ? (
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
    );
}

interface RawDataResponse {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    initialLayout: any; // Used to cast to LayoutGrid
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    finalLayout: any; // Used to cast to LayoutGrid
    [key: string]: unknown;
}

// Showtime Row Component
function ShowtimeRow({ showtime: st }: { showtime: ShowtimeSnapshot }) {
    const merchantColor = MERCHANT_COLORS[st.merchant] || 'bg-gray-500'
    const [expanded, setExpanded] = useState(false);
    const [rawData, setRawData] = useState<RawDataResponse | null>(null);
    const [isLoadingLayout, setIsLoadingLayout] = useState(false);

    // Fetch raw data when expanded
    const toggleExpand = async () => {
        const nextExpanded = !expanded;
        setExpanded(nextExpanded);
        
        if (nextExpanded && !rawData && isScraped) {
            setIsLoadingLayout(true);
            try {
                // Determine the parent component's movie context. For now, we assume the movie_id is in the showtime object, but in our domain model, the URL needs it. 
                // We'll extract movie_id from the window location since we are in the /performances/[movieId]/[date] page
                const pathParts = window.location.pathname.split('/');
                const movieId = pathParts[2];
                const date = pathParts[3];
                
                if (movieId && date) {
                    const res = await fetch(`/api/showtimes/${st.showtime_id}/raw?movieId=${movieId}&date=${date}`);
                    if (res.ok) {
                        const data = await res.json();
                        setRawData(data);
                    }
                }
            } catch (e) {
                console.error("Failed to load layout", e);
            } finally {
                setIsLoadingLayout(false);
            }
        }
    };

    // Choose which metric to show: True Delta or Legacy Raw
    const isTrueDelta = st.audience_count !== undefined;
    const isScraped = st.sold_seats !== undefined && st.sold_seats > 0;
    const finalSold = isTrueDelta ? st.audience_count! : (st.sold_seats ?? 0);
    const finalPct = isTrueDelta ? st.audience_pct! : (st.occupancy_pct ?? 0);
    const initialBlocked = isTrueDelta ? (st.initial_unavailable ?? 0) : 0;

    return (
        <>
            <tr
                className={cn(
                    "border-b last:border-0 hover:bg-muted/20 transition-colors cursor-pointer",
                    expanded && "bg-muted/10"
                )}
                onClick={toggleExpand}
            >
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
                    {/* Use SeatProgressBar component for stacked visualization */}
                    <SeatProgressBar
                        totalSeats={st.total_seats}
                        blockedSeats={initialBlocked}
                        soldSeats={finalSold}
                        showLabels={false}
                        size="sm"
                    />
                </td>
                <td className="py-3 px-4 text-right font-mono text-muted-foreground">
                    <div className="flex items-center gap-2 justify-end">
                        {!isScraped && !isTrueDelta ? (
                            <span className="text-xs text-muted-foreground italic">Not scraped yet</span>
                        ) : (
                            <>
                                <span className="text-foreground font-medium">{finalSold}</span>
                                <span className="opacity-50">/{st.total_seats}</span>
                                {isTrueDelta && <TrueAudienceBadge audienceCount={finalSold} totalSeats={st.total_seats} />}
                            </>
                        )}
                        <ChevronRight className={cn(
                            "w-4 h-4 text-muted-foreground transition-transform",
                            expanded && "rotate-90"
                        )} />
                    </div>
                </td>
            </tr>
            {/* Expanded Detail Row */}
            {expanded && (
                <tr className="border-b bg-muted/5">
                    <td colSpan={6} className="p-4">
                        {(st.scrape_phase || st.scraped_at) && (
                            <div className="flex items-center gap-2 mb-4 text-xs text-muted-foreground">
                                <Clock className="w-3 h-3" />
                                <span>Last updated:</span>
                                {st.scrape_phase && (
                                    <Badge variant="secondary" className="text-[10px] h-5 px-1.5 font-medium">
                                        {st.scrape_phase}
                                    </Badge>
                                )}
                                {st.scraped_at && (
                                    <span>
                                        {new Date(st.scraped_at).toLocaleTimeString(undefined, { 
                                            hour: '2-digit', 
                                            minute: '2-digit' 
                                        })}
                                    </span>
                                )}
                                <span className="ml-4 font-mono text-[10px] opacity-50">ID: {st.showtime_id}</span>
                            </div>
                        )}
                        {/* Studio and Price Info */}
                        <div className="flex items-center gap-4 mb-4">
                            {st.studio_id && (
                                <div className="flex items-center gap-2">
                                    <Layers className="w-4 h-4 text-muted-foreground" />
                                    <span className="text-sm font-medium">Studio {st.studio_id}</span>
                                </div>
                            )}
                            {st.price !== undefined && st.price !== null && (
                                <div className="flex items-center gap-2">
                                    <span className="text-sm text-muted-foreground">Ticket:</span>
                                    <span className="text-sm font-semibold text-foreground">
                                        Rp{st.price.toLocaleString('id-ID')}
                                    </span>
                                </div>
                            )}
                        </div>
                        <div className="flex flex-col lg:flex-row gap-4">
                            <div className="w-full lg:w-1/3">
                                <SeatBreakdownCard
                                    totalSeats={st.total_seats}
                                    blockedSeats={initialBlocked}
                                    soldSeats={finalSold}
                                    audienceCount={finalSold}
                                    trueOccupancyPct={finalPct}
                                    rawOccupancyPct={st.occupancy_pct ?? 0}
                                    size="sm"
                                />
                            </div>
                            <div className="w-full lg:w-2/3 min-h-[300px]">
                                {isLoadingLayout ? (
                                    <Card className="w-full h-full flex flex-col items-center justify-center min-h-[300px] bg-muted/20">
                                        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground mb-2" />
                                        <p className="text-sm text-muted-foreground">Loading cinema layout...</p>
                                    </Card>
                                ) : rawData && (rawData.initialLayout || rawData.finalLayout) ? (
                                    <SeatMapVisualizer 
                                        initialLayout={rawData.initialLayout} 
                                        finalLayout={rawData.finalLayout} 
                                    />
                                ) : (
                                    <Card className="w-full h-full flex items-center justify-center min-h-[300px] bg-muted/20">
                                        <p className="text-muted-foreground text-sm italic">Seat layout visualization not available for this showtime.</p>
                                    </Card>
                                )}
                            </div>
                        </div>
                    </td>
                </tr>
            )}
        </>
    );
}

// Grouped Section Component
function GroupedSection({
    title,
    items,
}: {
    title: string;
    items: ShowtimeSnapshot[];
}) {
    const [expanded, setExpanded] = useState(true);

    // Calculate group summary using precise delta data if available
    const totalSeats = items.reduce((sum, st) => sum + st.total_seats, 0);
    const totalSold = items.reduce((sum, st) => sum + (st.audience_count ?? st.sold_seats), 0);
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
                    <div className="flex items-center gap-2">
                        <span className="hidden sm:inline">Occupancy:</span>
                        <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                            <div
                                className={cn(
                                    "h-full rounded-full",
                                    avgOccupancy > 80 ? "bg-red-500" :
                                        avgOccupancy > 50 ? "bg-amber-500" : "bg-primary"
                                )}
                                style={{ width: `${Math.min(avgOccupancy, 100)}%` }}
                            />
                        </div>
                        <span className="font-mono">{avgOccupancy.toFixed(1)}%</span>
                    </div>
                    <div className="hidden md:block">
                        <span className="text-foreground font-medium">{totalSold}</span>
                        <span>/{totalSeats}</span>
                    </div>
                </div>
            </button>

            {expanded && (
                <div className="overflow-x-auto border-t bg-card">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b text-left text-muted-foreground bg-muted/20">
                                <th className="py-2 px-4 font-medium w-24">Time</th>
                                <th className="py-2 px-4 font-medium">Theatre</th>
                                <th className="py-2 px-4 font-medium">City</th>
                                <th className="py-2 px-4 font-medium">Room</th>
                                <th className="py-2 px-4 font-medium w-48">Occupancy</th>
                                <th className="py-2 px-4 font-medium text-right w-24">Seats</th>
                            </tr>
                        </thead>
                        <tbody>
                            {items.map((st) => (
                                <ShowtimeRow key={st.id} showtime={st} />
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
