'use client';
import { useState, useMemo, memo, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Clock, Filter, Layers, Loader2, ShieldCheck, Microscope, Users, Ban, CheckCircle2, Percent, Copy, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SeatProgressBar } from './SeatProgressBar';
import { TriPanelAudit } from './TriPanelAudit';
import { ShowtimeSnapshot } from '../types/performance';

type SortField = 'showtime' | 'occupancy' | 'theatre' | 'city' | 'anomaly';
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
    movieId?: string;
    date?: string;
}

export function ShowtimeTable({ showtimes, loading = false, movieId, date }: ShowtimeTableProps) {
    const [sortField, setSortField] = useState<SortField>('anomaly');
    const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
    const [groupBy, setGroupBy] = useState<GroupBy>('none');
    const [pageSize, setPageSize] = useState(50);
    const [currentPage, setCurrentPage] = useState(1);
    const [showAll, setShowAll] = useState(false);

    const [filterCity, setFilterCity] = useState<string>('all');
    const [filterMerchant, setFilterMerchant] = useState<string>('all');
    const [filterRoom, setFilterRoom] = useState<string>('all');

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

        result.sort((a, b) => {
            let comparison = 0;
            switch (sortField) {
                case 'showtime': comparison = (a.showtime || '').localeCompare(b.showtime || ''); break;
                case 'occupancy':
                    const occA = a.audience_pct ?? a.occupancy_pct ?? 0;
                    const occB = b.audience_pct ?? b.occupancy_pct ?? 0;
                    comparison = occA - occB;
                    break;
                case 'theatre': comparison = (a.theatre_name || '').localeCompare(b.theatre_name || ''); break;
                case 'city': comparison = (a.city || '').localeCompare(b.city || ''); break;
                case 'anomaly':
                    const deltaA = (a.sold_seats || 0) - (a.audience_count ?? a.sold_seats ?? 0);
                    const deltaB = (b.sold_seats || 0) - (b.audience_count ?? b.sold_seats ?? 0);
                    comparison = deltaA - deltaB;
                    break;
            }
            return sortDirection === 'asc' ? comparison : -comparison;
        });

        // HARD LIMIT: Global feed should never exceed 200 units to prevent DOM bloat
        return result.slice(0, 200);
    }, [showtimes, filterCity, filterMerchant, filterRoom, sortField, sortDirection]);

    const paginatedShowtimes = useMemo(() => {
        if (showAll || groupBy !== 'none') return processedShowtimes;
        const start = (currentPage - 1) * pageSize;
        return processedShowtimes.slice(start, start + pageSize);
    }, [processedShowtimes, showAll, groupBy, currentPage, pageSize]);

    const summaryStats = useMemo(() => {
        const totalShowtimes = processedShowtimes.length;
        const totalSeats = processedShowtimes.reduce((sum, st) => sum + (st.total_seats ?? 0), 0);
        const totalSold = processedShowtimes.reduce((sum, st) => sum + (st.audience_count ?? st.sold_seats ?? 0), 0);
        const avgOccupancy = totalSeats > 0 ? (totalSold / totalSeats * 100) : 0;
        return { totalShowtimes, totalSeats, totalSold, avgOccupancy };
    }, [processedShowtimes]);

    const toggleSort = (field: SortField) => {
        if (sortField === field) {
            setSortDirection(d => d === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortDirection('desc');
        }
        setCurrentPage(1);
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2">
                    <Microscope className="w-4 h-4 text-primary" />
                    <h2 className="text-sm font-black uppercase tracking-widest text-foreground">Global Forensic Audit Feed</h2>
                </div>
                {showtimes.length > 200 && (
                    <Badge variant="outline" className="text-[9px] font-black uppercase tracking-widest text-amber-600 border-amber-500/20 bg-amber-500/5">
                        Performance Limit: Showing Top 200 Anomalies
                    </Badge>
                )}
            </div>

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
                                            <th className="py-4 px-4 w-28 cursor-pointer hover:text-primary transition-colors" onClick={() => toggleSort('anomaly')}><div className="flex items-center gap-1.5"><ShieldCheck className="w-3 h-3 text-primary" />Anomaly</div></th>
                                            <th className="py-4 px-4 w-48 cursor-pointer hover:text-primary transition-colors" onClick={() => toggleSort('occupancy')}>True Occupancy</th>
                                            <th className="py-4 px-4 text-right w-24">True Sold</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {paginatedShowtimes.map((st) => (
                                            <ShowtimeRow 
                                                key={st.id} 
                                                showtime={st} 
                                                movieId={movieId || st.metadata_id || st.movie_id} 
                                                date={date || st.date} 
                                            />
                                        ))}
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
                                                {summaryStats.totalSold.toLocaleString()}<span className="opacity-30">/{(summaryStats.totalSeats || 0).toLocaleString()}</span>
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

export const ShowtimeRow = memo(({ showtime: st, movieId: propMovieId, date: propDate }: { showtime: ShowtimeSnapshot; movieId?: string; date?: string }) => {
    const merchantColor = MERCHANT_COLORS[st.merchant] || 'bg-gray-500'
    const [expanded, setExpanded] = useState(false);
    const [rawData, setRawData] = useState<RawDataResponse | null>(null);
    const [isLoadingLayout, setIsLoadingLayout] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);
    const abortController = useRef<AbortController | null>(null);

    const toggleExpand = async () => {
        const nextExpanded = !expanded;
        setExpanded(nextExpanded);
        if (nextExpanded && !rawData) {
            if (abortController.current) abortController.current.abort();
            abortController.current = new AbortController();
            setIsLoadingLayout(true);
            try {
                const mid = propMovieId || st.metadata_id || st.movie_id;
                const d = propDate || st.date;
                
                if (!mid || !d) {
                    console.error("Missing movieId or date for audit fetch", { mid, d });
                    setIsLoadingLayout(false);
                    return;
                }

                const res = await fetch(`/api/showtimes/${st.showtime_id}/raw?movieId=${mid}&date=${d}`, { signal: abortController.current.signal });
                if (res.ok) setRawData(await res.json());
                else setErrorMsg("Failed to load forensic data");
            } catch (err: unknown) { 
                if (err instanceof Error && err.name !== 'AbortError') {
                    setErrorMsg("Network Error"); 
                }
            }
            finally { setIsLoadingLayout(false); }
        }
    };

    const copyId = (e: React.MouseEvent) => {
        e.stopPropagation();
        navigator.clipboard.writeText(st.showtime_id);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const finalSold = st.audience_count ?? st.sold_seats ?? 0;
    const finalPct = st.audience_pct ?? st.occupancy_pct ?? 0;
    const initialBlocked = st.initial_unavailable ?? 0;
    const availableSeats = Math.max(0, (st.total_seats ?? 0) - initialBlocked - finalSold);

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
                <td className="py-4 px-4 font-mono">
                    {st.audience_count !== undefined ? (
                        <div className="flex flex-col">
                            <span className={cn(
                                "text-[10px] font-black uppercase tracking-widest",
                                (st.sold_seats - st.audience_count) > 0 ? "text-amber-600" : "text-green-600"
                            )}>
                                {(st.sold_seats - st.audience_count) > 0 ? `+${st.sold_seats - st.audience_count}` : "0"} Delta
                            </span>
                            <span className="text-[8px] font-bold text-muted-foreground/40 uppercase tracking-tighter">Verified Audit</span>
                        </div>
                    ) : (
                        <span className="text-[9px] font-black uppercase text-muted-foreground/20 italic tracking-widest">Pending</span>
                    )}
                </td>
                <td className="py-4 px-4">
                    <div className="flex flex-col gap-1 w-32">
                        <SeatProgressBar totalSeats={st.total_seats} blockedSeats={initialBlocked} soldSeats={finalSold} size="sm" showLabels={false} />
                        <div className="flex justify-between text-[8px] font-black uppercase tracking-tighter text-muted-foreground/40">
                            <span>{finalPct.toFixed(1)}% Occupancy</span>
                            {st.audience_count !== undefined && <span className="text-primary/60 italic">Forensic Audit</span>}
                        </div>
                    </div>
                </td>
                <td className="py-4 px-4 text-right">
                    <div className="flex items-center justify-end gap-3">
                        <div className="flex flex-col items-end">
                            <span className="text-xs font-bold font-mono text-foreground tabular-nums">{finalSold}<span className="opacity-20">/{(st.total_seats ?? 0)}</span></span>
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
                            <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-border/50 pb-6 gap-6">
                                <div className="flex items-center gap-4">
                                    <div className="p-2.5 bg-primary/10 rounded-2xl shadow-sm border border-primary/10"><Microscope className="w-5 h-5 text-primary" /></div>
                                    <div>
                                        <h3 className="text-xs font-black uppercase tracking-widest text-foreground">Forensic Seat Audit</h3>
                                        <div className="flex items-center gap-2 mt-1">
                                            <div className="flex items-center gap-1.5">
                                                <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-tight">Showtime ID: {st.showtime_id}</p>
                                                <button 
                                                    onClick={copyId}
                                                    className="p-1 hover:bg-muted rounded transition-colors"
                                                    title="Copy Showtime ID"
                                                >
                                                    {copied ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3 text-muted-foreground/40" />}
                                                </button>
                                            </div>
                                            <span className="text-[10px] text-muted-foreground/40">•</span>
                                            <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-tight">Phase: {st.scrape_phase || 'N/A'}</p>
                                            <a 
                                                href={`https://console.firebase.google.com/project/cineradar-481014/firestore/databases/-default-/data/~2Fmovie_performance_v2~2F${propMovieId || st.metadata_id || st.movie_id || 'unknown'}~2Fdays~2F${propDate || st.date || 'unknown'}~2Fshowtimes~2F${st.showtime_id}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="flex items-center gap-1.5 text-[9px] font-black uppercase text-primary hover:bg-primary/10 bg-primary/5 px-2 py-0.5 rounded-full border border-primary/10 transition-all shadow-sm"
                                            >
                                                <Layers className="w-2.5 h-2.5" />
                                                View In Firestore
                                            </a>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex flex-wrap items-center gap-3 md:gap-4">
                                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-green-500/5 border border-green-500/10 shadow-sm transition-all hover:bg-green-500/10 group">
                                        <Users className="w-3 h-3 text-green-500" />
                                        <div className="flex flex-col">
                                            <span className="text-xs font-black text-green-600 leading-none">{finalSold}</span>
                                            <span className="text-[8px] font-bold text-green-600/60 uppercase tracking-tighter mt-0.5">Tickets Sold</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-red-500/5 border border-red-500/10 shadow-sm transition-all hover:bg-green-500/10 group">
                                        <Ban className="w-3 h-3 text-red-500" />
                                        <div className="flex flex-col">
                                            <span className="text-xs font-black text-red-600 leading-none">{initialBlocked}</span>
                                            <span className="text-[8px] font-bold text-red-600/60 uppercase tracking-tighter mt-0.5">Static Block</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-zinc-500/5 border border-zinc-500/10 shadow-sm transition-all hover:bg-green-500/10 group">
                                        <CheckCircle2 className="w-3 h-3 text-zinc-500" />
                                        <div className="flex flex-col">
                                            <span className="text-xs font-black text-zinc-600 leading-none">{availableSeats}</span>
                                            <span className="text-[8px] font-bold text-zinc-600/60 uppercase tracking-tighter mt-0.5">Available</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-primary/5 border border-primary/10 shadow-sm transition-all hover:bg-primary/10 group">
                                        <Percent className="w-3 h-3 text-primary" />
                                        <div className="flex flex-col">
                                            <span className="text-xs font-black text-primary leading-none">{finalPct.toFixed(1)}%</span>
                                            <span className="text-[8px] font-bold text-primary/60 uppercase tracking-tighter mt-0.5">True Occ</span>
                                        </div>
                                    </div>
                                    <div className="h-8 w-px bg-border/50 mx-1 hidden md:block" />
                                    <div className="flex items-center gap-2.5 pl-1">
                                        <ShieldCheck className="w-4 h-4 text-green-500 drop-shadow-sm" />
                                        <span className="text-[10px] font-black uppercase tracking-widest text-green-600">State Verified</span>
                                    </div>
                                </div>
                            </div>

                            <div className="w-full">
                                {isLoadingLayout ? (
                                    <div className="h-[450px] flex flex-col items-center justify-center border rounded-2xl bg-muted/5 border-dashed">
                                        <Loader2 className="w-8 h-8 animate-spin text-primary/20 mb-4" />
                                        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/40">Decrypting Spatial Layout...</p>
                                    </div>
                                ) : rawData ? (
                                    <TriPanelAudit initialLayout={rawData.initialLayout} finalLayout={rawData.finalLayout} masterLayout={rawData.masterLayout} theatreId={st.theatre_id} />
                                ) : (
                                    <div className="h-[450px] flex items-center justify-center border rounded-2xl bg-red-500/5 border-red-500/10"><p className="text-xs font-bold text-red-500/60 uppercase tracking-widest">{errorMsg || "Forensic Data Unavailable"}</p></div>
                                )}
                            </div>
                        </div>
                    </td>
                </tr>
            )}
        </>
    );
});

ShowtimeRow.displayName = 'ShowtimeRow';
