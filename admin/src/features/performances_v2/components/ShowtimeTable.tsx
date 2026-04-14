'use client';
import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Clock, Filter, Layers, Loader2, ShieldCheck, Microscope } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SeatProgressBar } from './SeatProgressBar';
import { SeatBreakdownCard } from './SeatBreakdownCard';
import { TriPanelAudit } from './TriPanelAudit';
import { MasterLayout } from './SeatMapVisualizer';

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
    sold_seats: number;
    occupancy_pct: number;
    price?: number;
    initial_unavailable?: number;
    final_unavailable?: number;
    audience_count?: number;
    audience_pct?: number;
    scrape_phase?: string;
    scraped_at?: string;
    studio_id?: string;
    metadata_id?: string;
    date?: string;
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

    const [filterCity, setFilterCity] = useState<string>('all');
    const [filterMerchant, setFilterMerchant] = useState<string>('all');
    const [filterRoom, setFilterRoom] = useState<string>('all');
    const [filterHour] = useState<string>('all');

    const filterOptions = useMemo(() => {
        const cities = new Set<string>();
        const merchants = new Set<string>();
        const rooms = new Set<string>();
        const hours = new Set<string>();

        showtimes.forEach(st => {
            if (st.city) cities.add(st.city);
            if (st.merchant) merchants.add(st.merchant);
            if (st.room_category) rooms.add(st.room_category);
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

    const processedShowtimes = useMemo(() => {
        let result = [...showtimes];
        if (filterCity !== 'all') result = result.filter(st => st.city === filterCity);
        if (filterMerchant !== 'all') result = result.filter(st => st.merchant === filterMerchant);
        if (filterRoom !== 'all') result = result.filter(st => st.room_category === filterRoom);
        if (filterHour !== 'all') result = result.filter(st => st.showtime && st.showtime.startsWith(filterHour));

        result.sort((a, b) => {
            let comparison = 0;
            switch (sortField) {
                case 'showtime': comparison = (a.showtime || '').localeCompare(b.showtime || ''); break;
                case 'occupancy':
                    const occA = a.audience_pct !== undefined ? a.audience_pct : a.occupancy_pct;
                    const occB = b.audience_pct !== undefined ? b.audience_pct : b.occupancy_pct;
                    comparison = occA - occB;
                    break;
                case 'theatre': comparison = (a.theatre_name || '').localeCompare(b.theatre_name || ''); break;
                case 'city': comparison = (a.city || '').localeCompare(b.city || ''); break;
            }
            return sortDirection === 'asc' ? comparison : -comparison;
        });
        return result;
    }, [showtimes, filterCity, filterMerchant, filterRoom, filterHour, sortField, sortDirection]);

    const paginatedShowtimes = useMemo(() => {
        if (showAll || groupBy !== 'none') return processedShowtimes;
        const start = (currentPage - 1) * pageSize;
        return processedShowtimes.slice(start, start + pageSize);
    }, [processedShowtimes, showAll, groupBy, currentPage, pageSize]);

    const summaryStats = useMemo(() => {
        const totalShowtimes = processedShowtimes.length;
        const totalSeats = processedShowtimes.reduce((sum, st) => sum + st.total_seats, 0);
        const totalSold = processedShowtimes.reduce((sum, st) => sum + (st.audience_count ?? st.sold_seats), 0);
        const avgOccupancy = totalSeats > 0 ? (totalSold / totalSeats * 100) : 0;
        return { totalShowtimes, totalSeats, totalSold, avgOccupancy };
    }, [processedShowtimes]);

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
        <div className="space-y-6">
            <Card className="border-primary/10 shadow-sm">
                <CardHeader className="pb-3 px-4 pt-4 border-b bg-muted/5">
                    <CardTitle className="text-[10px] font-black uppercase tracking-[0.2em] flex items-center gap-2 text-muted-foreground/60">
                        <Filter className="w-3.5 h-3.5" />
                        Intelligence Filters
                    </CardTitle>
                </CardHeader>
                <CardContent className="px-4 py-4">
                    <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
                        <Select value={filterCity} onValueChange={(v) => { setFilterCity(v); setCurrentPage(1); }}>
                            <SelectTrigger className="h-9 text-xs font-bold uppercase tracking-tighter"><SelectValue placeholder="City" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Cities</SelectItem>
                                {filterOptions.cities.map(city => <SelectItem key={city} value={city}>{city}</SelectItem>)}
                            </SelectContent>
                        </Select>
                        <Select value={filterMerchant} onValueChange={(v) => { setFilterMerchant(v); setCurrentPage(1); }}>
                            <SelectTrigger className="h-9 text-xs font-bold uppercase tracking-tighter"><SelectValue placeholder="Merchant" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Merchants</SelectItem>
                                {filterOptions.merchants.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                            </SelectContent>
                        </Select>
                        <Select value={filterRoom} onValueChange={(v) => { setFilterRoom(v); setCurrentPage(1); }}>
                            <SelectTrigger className="h-9 text-xs font-bold uppercase tracking-tighter"><SelectValue placeholder="Room" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Rooms</SelectItem>
                                {filterOptions.rooms.map(room => <SelectItem key={room} value={room}>{room}</SelectItem>)}
                            </SelectContent>
                        </Select>
                        <Select value={groupBy} onValueChange={(v) => setGroupBy(v as GroupBy)}>
                            <SelectTrigger className="h-9 text-xs font-bold uppercase tracking-tighter"><Layers className="w-3 h-3 mr-1" /><SelectValue placeholder="Group by" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="none">No Grouping</SelectItem>
                                <SelectItem value="theatre">By Theatre</SelectItem>
                                <SelectItem value="city">By City</SelectItem>
                                <SelectItem value="merchant">By Merchant</SelectItem>
                            </SelectContent>
                        </Select>
                        <Select value={showAll ? 'all' : String(pageSize)} onValueChange={(v) => { if (v === 'all') setShowAll(true); else { setShowAll(false); setPageSize(Number(v)); } }}>
                            <SelectTrigger className="h-9 text-xs font-bold uppercase tracking-tighter"><SelectValue placeholder="Show" /></SelectTrigger>
                            <SelectContent>
                                {PAGE_SIZES.map(size => <SelectItem key={size} value={String(size)}>{size} rows</SelectItem>)}
                                <SelectItem value="all">Show All</SelectItem>
                            </SelectContent>
                        </Select>
                        <div className="flex items-center justify-end text-[10px] font-black uppercase tracking-widest text-muted-foreground/40 tabular-nums">
                            {processedShowtimes.length} Matches
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Card className="border-none shadow-none bg-transparent">
                <CardContent className="p-0">
                    {loading ? (
                        <div className="py-20 flex flex-col items-center justify-center gap-4 border rounded-xl bg-muted/5 border-dashed">
                            <Loader2 className="w-10 h-10 animate-spin text-primary/30" />
                            <p className="text-xs font-black uppercase tracking-widest text-muted-foreground/40">Analyzing National Showtimes...</p>
                        </div>
                    ) : processedShowtimes.length === 0 ? (
                        <div className="py-20 text-center border rounded-xl bg-muted/5 border-dashed">
                            <p className="text-sm font-bold uppercase tracking-widest text-muted-foreground/40">No showtimes matched filters.</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div className="overflow-x-auto rounded-xl border border-primary/5 shadow-sm bg-card">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="bg-muted/30 border-b text-left text-muted-foreground/60 uppercase text-[9px] font-black tracking-widest">
                                            <th className="py-4 px-4 w-24 cursor-pointer hover:text-primary transition-colors" onClick={() => toggleSort('showtime')}>
                                                <div className="flex items-center gap-1.5"><Clock className="w-3 h-3" />Time</div>
                                            </th>
                                            <th className="py-4 px-4 cursor-pointer hover:text-primary transition-colors" onClick={() => toggleSort('theatre')}>Theatre</th>
                                            <th className="py-4 px-4 cursor-pointer hover:text-primary transition-colors" onClick={() => toggleSort('city')}>Location</th>
                                            <th className="py-4 px-4">Room</th>
                                            <th className="py-4 px-4">Price</th>
                                            <th className="py-4 px-4 w-48 cursor-pointer hover:text-primary transition-colors" onClick={() => toggleSort('occupancy')}>Occupancy</th>
                                            <th className="py-4 px-4 text-right w-24">Audience</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {paginatedShowtimes.map((st) => <ShowtimeRow key={st.id} showtime={st} />)}
                                    </tbody>
                                    <tfoot>
                                        <tr className="bg-primary/5 border-t font-black uppercase text-[10px] tracking-widest text-primary/60">
                                            <td className="py-4 px-4" colSpan={5}>National Daily Aggregation ({summaryStats.totalShowtimes} units)</td>
                                            <td className="py-4 px-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="flex-1 h-1.5 bg-primary/10 rounded-full overflow-hidden">
                                                        <div className="h-full bg-primary rounded-full shadow-[0_0_8px_rgba(var(--primary),0.4)]" style={{ width: `${Math.min(summaryStats.avgOccupancy, 100)}%` }} />
                                                    </div>
                                                    <span className="font-mono tabular-nums">{summaryStats.avgOccupancy.toFixed(1)}%</span>
                                                </div>
                                            </td>
                                            <td className="py-4 px-4 text-right font-mono tabular-nums text-foreground">
                                                {summaryStats.totalSold.toLocaleString()}<span className="opacity-30">/{summaryStats.totalSeats.toLocaleString()}</span>
                                            </td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}

interface RawDataResponse {
    initialLayout: unknown;
    finalLayout: unknown;
    masterLayout: unknown;
    isInferred?: boolean;
    inferredStudioId?: string;
}

export function ShowtimeRow({ showtime: st, movieId: propMovieId, date: propDate }: { showtime: ShowtimeSnapshot; movieId?: string; date?: string }) {
    const merchantColor = MERCHANT_COLORS[st.merchant] || 'bg-gray-500'
    const [expanded, setExpanded] = useState(false);
    const [rawData, setRawData] = useState<RawDataResponse | null>(null);
    const [isLoadingLayout, setIsLoadingLayout] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    const toggleExpand = async () => {
        const nextExpanded = !expanded;
        setExpanded(nextExpanded);
        if (nextExpanded && !rawData) {
            setIsLoadingLayout(true);
            try {
                const pathParts = window.location.pathname.split('/');
                const movieId = propMovieId || pathParts[2];
                const date = propDate || pathParts[3];
                const res = await fetch(`/api/showtimes/${st.showtime_id}/raw?movieId=${movieId}&date=${date}`);
                if (res.ok) setRawData(await res.json());
                else setErrorMsg("Failed to load forensic data");
            } catch { setErrorMsg("Network Error"); }
            finally { setIsLoadingLayout(false); }
        }
    };

    const finalSold = st.audience_count ?? st.sold_seats;
    const finalPct = st.audience_pct ?? st.occupancy_pct;
    const initialBlocked = st.initial_unavailable ?? 0;

    return (
        <>
            <tr className={cn("border-b last:border-0 hover:bg-muted/20 transition-colors cursor-pointer group", expanded && "bg-primary/[0.02]")} onClick={toggleExpand}>
                <td className="py-4 px-4 font-mono font-bold text-foreground text-xs">{st.showtime}</td>
                <td className="py-4 px-4">
                    <div className="flex items-center gap-3">
                        <div className={cn("w-1 h-4 rounded-full", merchantColor)} />
                        <span className="font-bold tracking-tight uppercase text-xs group-hover:text-primary transition-colors">{st.theatre_name}</span>
                        {st.studio_id && <span className="text-[9px] font-black uppercase text-muted-foreground/40 bg-muted/50 px-1.5 py-0.5 rounded border border-border/50">Std {st.studio_id}</span>}
                    </div>
                </td>
                <td className="py-4 px-4 text-muted-foreground font-bold text-[10px] uppercase tracking-tighter">{st.city}</td>
                <td className="py-4 px-4"><Badge variant="outline" className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/60 border-muted-foreground/20">{st.room_category}</Badge></td>
                <td className="py-4 px-4 text-[10px] font-mono font-bold">{st.price ? `Rp ${st.price.toLocaleString('id-ID')}` : '-'}</td>
                <td className="py-4 px-4">
                    <div className="flex flex-col gap-1 w-32">
                        <SeatProgressBar totalSeats={st.total_seats} blockedSeats={initialBlocked} soldSeats={finalSold} size="sm" showLabels={false} />
                        <div className="flex justify-between text-[8px] font-black uppercase tracking-tighter text-muted-foreground/40">
                            <span>{finalPct.toFixed(1)}% Occupancy</span>
                            {st.audience_count !== undefined && <span className="text-primary/60 italic">V2 Audit</span>}
                        </div>
                    </div>
                </td>
                <td className="py-4 px-4 text-right">
                    <div className="flex items-center justify-end gap-3">
                        <div className="flex flex-col items-end">
                            <span className="text-xs font-bold font-mono text-foreground tabular-nums">{finalSold}<span className="opacity-20">/{st.total_seats}</span></span>
                        </div>
                        <Button variant="outline" className="h-7 w-7 p-0 rounded-lg border-primary/10 hover:bg-primary/5">
                            <Microscope className={cn("w-3.5 h-3.5 text-muted-foreground group-hover:text-primary transition-all", expanded && "text-primary scale-110")} />
                        </Button>
                    </div>
                </td>
            </tr>
            {expanded && (
                <tr className="bg-muted/[0.03]">
                    <td colSpan={7} className="p-6">
                        <div className="space-y-6">
                            <div className="flex items-center justify-between border-b border-border/50 pb-4">
                                <div className="flex items-center gap-4">
                                    <div className="p-2 bg-primary/10 rounded-xl"><Microscope className="w-5 h-5 text-primary" /></div>
                                    <div>
                                        <h3 className="text-xs font-black uppercase tracking-widest text-foreground">Forensic Seat Audit</h3>
                                        <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-tight">Showtime ID: {st.showtime_id} • Phase: {st.scrape_phase || 'N/A'}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <ShieldCheck className="w-4 h-4 text-green-500" />
                                    <span className="text-[10px] font-black uppercase tracking-widest text-green-600">State Verified</span>
                                </div>
                            </div>

                            <div className="flex flex-col xl:flex-row gap-6">
                                <div className="xl:w-80">
                                    <SeatBreakdownCard totalSeats={st.total_seats} blockedSeats={initialBlocked} soldSeats={finalSold} audienceCount={finalSold} trueOccupancyPct={finalPct} rawOccupancyPct={st.occupancy_pct ?? 0} size="sm" />
                                </div>
                                <div className="flex-1">
                                    {isLoadingLayout ? (
                                        <div className="h-[400px] flex flex-col items-center justify-center border rounded-2xl bg-muted/5 border-dashed">
                                            <Loader2 className="w-8 h-8 animate-spin text-primary/20 mb-4" />
                                            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/40">Decrypting Spatial Layout...</p>
                                        </div>
                                    ) : rawData ? (
                                        <TriPanelAudit initialLayout={rawData.initialLayout} finalLayout={rawData.finalLayout} masterLayout={rawData.masterLayout as MasterLayout} />
                                    ) : (
                                        <div className="h-[400px] flex items-center justify-center border rounded-2xl bg-red-500/5 border-red-500/10"><p className="text-xs font-bold text-red-500/60 uppercase tracking-widest">{errorMsg || "Forensic Data Unavailable"}</p></div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </td>
                </tr>
            )}
        </>
    );
}
