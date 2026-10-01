'use client';

import React, { useState, useRef, memo, useMemo } from 'react';
import { ShowtimeSnapshot } from '../types/performance';
import { RawShowtimeData } from '../types/seat';
import { resolveTicketPrice, calculateForensicAggregation } from '../utils/performance-math';
import { formatOccupancy, formatRupiah, formatRupiahCompact } from '../utils/format';
import { getOccupancyColor, getOccupancyBgSoft, getOccupancyBorderSoft } from '../utils/colors';
import { getPerformanceTier, getFirestoreConsoleUrl } from '@/lib/constants';
import { SeatProgressBar } from './SeatProgressBar';
import { TriPanelAudit } from './TriPanelAudit';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Microscope, Copy, Check, Layers, Users, Ban, CheckCircle2, Percent, Coins, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ForensicShowtimeTableProps {
    showtimes: ShowtimeSnapshot[];
    movieId: string;
    date: string;
}

export function ForensicShowtimeTable({ showtimes, movieId, date }: ForensicShowtimeTableProps) {
    const sorted = useMemo(() => {
        return [...showtimes].sort((a, b) => (a.showtime || '').localeCompare(b.showtime || ''));
    }, [showtimes]);

    const summary = useMemo(() => {
        return calculateForensicAggregation(showtimes);
    }, [showtimes]);

    return (
        <div className="overflow-x-auto rounded-xl border border-primary/5 shadow-sm bg-card">
            <table className="w-full text-sm">
                <thead>
                    <tr className="bg-muted/30 border-b text-left text-muted-foreground/60 uppercase text-sm font-black tracking-widest">
                        <th className="py-4 px-4 w-24">Time</th>
                        <th className="py-4 px-4">Room</th>
                        <th className="py-4 px-4">Price</th>
                        <th className="py-4 px-4 w-44">Occupancy</th>
                        <th className="py-4 px-4 text-right w-28">Audience</th>
                        <th className="py-4 px-4 text-right w-28">Est. Gross</th>
                        <th className="py-4 px-4 text-right w-16">Audit</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                    {sorted.map(st => (
                        <CinemaShowtimeRow 
                            key={st.id} 
                            showtime={st} 
                            movieId={movieId} 
                            date={date} 
                        />
                    ))}
                </tbody>
                <tfoot>
                    <tr className="bg-muted/5 border-t font-black uppercase text-sm tracking-widest text-muted-foreground/60">
                        <td className="py-4 px-4" colSpan={3}>
                            Cinema Aggregation ({summary.showtime_count} units)
                        </td>
                        <td className="py-4 px-4">
                            <div className="flex items-center gap-3">
                                <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                                    <div 
                                        className={cn("h-full rounded-full transition-all", getPerformanceTier(summary.true_occupancy_pct).twBg)} 
                                        style={{ width: `${Math.min(summary.true_occupancy_pct, 100)}%` }} 
                                    />
                                </div>
                                <span className={cn("font-mono tabular-nums", getOccupancyColor(summary.true_occupancy_pct))}>
                                    {formatOccupancy(summary.true_occupancy_pct)}%
                                </span>
                            </div>
                        </td>
                        <td className="py-4 px-4 text-right font-mono tabular-nums text-foreground">
                            {summary.total_sold.toLocaleString()}<span className="opacity-30">/{summary.total_seats.toLocaleString()}</span>
                        </td>
                        <td className="py-4 px-4 text-right font-mono tabular-nums text-emerald-600 dark:text-emerald-400">
                            {formatRupiahCompact(summary.total_gross_revenue)}
                        </td>
                        <td className="py-4 px-4"></td>
                    </tr>
                </tfoot>
            </table>
        </div>
    );
}

const CinemaShowtimeRow = memo(({ 
    showtime: st, 
    movieId, 
    date 
}: { 
    showtime: ShowtimeSnapshot; 
    movieId: string; 
    date: string; 
}) => {
    const [expanded, setExpanded] = useState(false);
    const [rawData, setRawData] = useState<RawShowtimeData | null>(null);
    const [isLoadingLayout, setIsLoadingLayout] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);
    const abortController = useRef<AbortController | null>(null);

    const unitPrice = resolveTicketPrice(st);
    const finalSold = st.audience_count ?? st.sold_seats ?? 0;
    const finalPct = st.audience_pct ?? st.occupancy_pct ?? 0;
    const initialBlocked = st.initial_unavailable ?? 0;
    const availableSeats = Math.max(0, (st.total_seats ?? 0) - initialBlocked - finalSold);
    const grossRevenue = finalSold * unitPrice;

    const toggleExpand = async () => {
        const nextExpanded = !expanded;
        setExpanded(nextExpanded);
        if (nextExpanded && !rawData) {
            if (abortController.current) abortController.current.abort();
            abortController.current = new AbortController();
            setIsLoadingLayout(true);
            try {
                const mid = movieId || st.metadata_id || st.movie_id;
                const d = date || st.date;
                
                if (!mid || !d) {
                    console.error('Missing movieId or date for audit fetch', { mid, d });
                    setIsLoadingLayout(false);
                    return;
                }

                const res = await fetch(`/api/showtimes/${st.showtime_id}/raw?movieId=${mid}&date=${d}`, { 
                    signal: abortController.current.signal 
                });
                if (res.ok) {
                    const json = await res.json();
                    setRawData(json.data ?? json);
                } else {
                    setErrorMsg('Failed to load forensic data');
                }
            } catch (err: unknown) { 
                if (err instanceof Error && err.name !== 'AbortError') {
                    setErrorMsg('Network Error'); 
                }
            } finally { 
                setIsLoadingLayout(false); 
            }
        }
    };

    const copyId = (e: React.MouseEvent) => {
        e.stopPropagation();
        navigator.clipboard.writeText(st.showtime_id);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <>
            <tr 
                className={cn(
                    "border-b last:border-0 hover:bg-muted/20 transition-colors cursor-pointer group", 
                    expanded && "bg-primary/[0.02]"
                )} 
                onClick={toggleExpand}
            >
                <td className="py-4 px-4 font-mono font-bold text-foreground text-sm">{st.showtime}</td>
                <td className="py-4 px-4">
                    <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-sm font-black uppercase tracking-widest text-muted-foreground/60 border-muted-foreground/20">
                            {st.room_category}
                        </Badge>
                        {st.studio_id && (
                            <span className="text-sm font-black uppercase text-muted-foreground/40 bg-muted/50 px-1.5 py-0.5 rounded border border-border/50">
                                Std {st.studio_id}
                            </span>
                        )}
                    </div>
                </td>
                <td className="py-4 px-4 font-mono font-bold text-sm text-muted-foreground">
                    {formatRupiah(unitPrice)}
                </td>
                <td className="py-4 px-4">
                    <div className="flex flex-col gap-1 w-32">
                        <SeatProgressBar 
                            totalSeats={st.total_seats} 
                            blockedSeats={initialBlocked} 
                            soldSeats={finalSold} 
                            size="sm" 
                            showLabels={false} 
                        />
                        <div className="flex justify-between text-sm font-black uppercase tracking-tighter text-muted-foreground/40">
                            <span>{formatOccupancy(finalPct)}%</span>
                            {st.audience_count !== undefined && <span className="text-primary/60 italic">Forensic</span>}
                        </div>
                    </div>
                </td>
                <td className="py-4 px-4 text-right">
                    <span className="text-sm font-bold font-mono text-foreground tabular-nums">
                        {finalSold}<span className="opacity-20">/{(st.total_seats ?? 0)}</span>
                    </span>
                </td>
                <td className="py-4 px-4 text-right font-mono font-bold text-sm text-emerald-600 dark:text-emerald-400 tabular-nums">
                    {formatRupiahCompact(grossRevenue)}
                </td>
                <td className="py-4 px-4 text-right">
                    <Button variant="outline" className="h-7 w-7 p-0 rounded-lg border-primary/10 hover:bg-primary/5">
                        <Microscope className={cn("w-3.5 h-3.5 text-muted-foreground group-hover:text-primary transition-all", expanded && "text-primary scale-110")} />
                    </Button>
                </td>
            </tr>
            {expanded && (
                <tr className="bg-muted/[0.03]">
                    <td colSpan={7} className="p-6">
                        <div className="space-y-6">
                            <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-border/50 pb-6 gap-6">
                                <div className="flex items-center gap-4">
                                    <div className="p-2.5 bg-primary/10 rounded-2xl shadow-sm border border-primary/10">
                                        <Microscope className="w-5 h-5 text-primary" />
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-black uppercase tracking-widest text-foreground">Forensic Seat Audit</h3>
                                        <div className="flex items-center gap-2 mt-1">
                                            <div className="flex items-center gap-1.5">
                                                <p className="text-sm text-muted-foreground font-bold uppercase tracking-tight">Showtime ID: {st.showtime_id}</p>
                                                <button 
                                                    onClick={copyId}
                                                    className="p-1 hover:bg-muted rounded transition-colors"
                                                    title="Copy Showtime ID"
                                                >
                                                    {copied ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3 text-muted-foreground/40" />}
                                                </button>
                                            </div>
                                            <span className="text-sm text-muted-foreground/40">•</span>
                                            <p className="text-sm text-muted-foreground font-bold uppercase tracking-tight">Phase: {st.scrape_phase || 'N/A'}</p>
                                            <a 
                                                href={getFirestoreConsoleUrl('movie_performance_v2', movieId || st.metadata_id || st.movie_id || 'unknown', 'days', date || st.date || 'unknown', 'showtimes', st.showtime_id)}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="flex items-center gap-1.5 text-sm font-black uppercase text-primary hover:bg-primary/10 bg-primary/5 px-2 py-0.5 rounded-full border border-primary/10 transition-all shadow-sm"
                                            >
                                                <Layers className="w-2.5 h-2.5" />
                                                View In Firestore
                                            </a>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex flex-wrap items-center gap-3 md:gap-4">
                                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-500/5 border border-emerald-500/10 shadow-sm transition-all hover:bg-emerald-500/10 group">
                                        <Coins className="w-3 h-3 text-emerald-500" />
                                        <div className="flex flex-col">
                                            <span className="text-sm font-black text-emerald-600 leading-none">{formatRupiahCompact(grossRevenue)}</span>
                                            <span className="text-sm font-bold text-emerald-600/60 uppercase tracking-tighter mt-0.5">Est. Gross</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-green-500/5 border border-green-500/10 shadow-sm transition-all hover:bg-green-500/10 group">
                                        <Users className="w-3 h-3 text-green-500" />
                                        <div className="flex flex-col">
                                            <span className="text-sm font-black text-green-600 leading-none">{finalSold}</span>
                                            <span className="text-sm font-bold text-green-600/60 uppercase tracking-tighter mt-0.5">Tickets Sold</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-red-500/5 border border-red-500/10 shadow-sm transition-all hover:bg-green-500/10 group">
                                        <Ban className="w-3 h-3 text-red-500" />
                                        <div className="flex flex-col">
                                            <span className="text-sm font-black text-red-600 leading-none">{initialBlocked}</span>
                                            <span className="text-sm font-bold text-red-600/60 uppercase tracking-tighter mt-0.5">Static Block</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-zinc-500/5 border border-zinc-500/10 shadow-sm transition-all hover:bg-green-500/10 group">
                                        <CheckCircle2 className="w-3 h-3 text-zinc-500" />
                                        <div className="flex flex-col">
                                            <span className="text-sm font-black text-zinc-600 leading-none">{availableSeats}</span>
                                            <span className="text-sm font-bold text-zinc-600/60 uppercase tracking-tighter mt-0.5">Available</span>
                                        </div>
                                    </div>
                                    <div className={cn(
                                        "flex items-center gap-2 px-3 py-1.5 rounded-xl border shadow-sm transition-all group",
                                        getOccupancyBgSoft(finalPct),
                                        getOccupancyBorderSoft(finalPct)
                                    )}>
                                        <Percent className={cn("w-3 h-3", getOccupancyColor(finalPct))} />
                                        <div className="flex flex-col">
                                            <span className={cn("text-sm font-black leading-none", getOccupancyColor(finalPct))}>{formatOccupancy(finalPct)}%</span>
                                            <span className={cn("text-sm font-bold uppercase tracking-tighter mt-0.5 opacity-60", getOccupancyColor(finalPct))}>True Occ</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-muted/40 border shadow-sm">
                                        <span className="text-sm font-black uppercase tracking-widest text-green-600">State Verified</span>
                                    </div>
                                </div>
                            </div>

                            <div className="w-full">
                                {isLoadingLayout ? (
                                    <div className="h-[450px] flex flex-col items-center justify-center border rounded-2xl bg-muted/5 border-dashed">
                                        <Loader2 className="w-8 h-8 animate-spin text-primary/20 mb-4" />
                                        <p className="text-sm font-black uppercase tracking-widest text-muted-foreground/40">Decrypting Spatial Layout...</p>
                                    </div>
                                ) : rawData ? (
                                    <TriPanelAudit 
                                        initialLayout={rawData.initialLayout} 
                                        finalLayout={rawData.finalLayout} 
                                        masterLayout={rawData.masterLayout} 
                                        theatreId={st.theatre_id} 
                                        studioId={st.studio_id} 
                                    />
                                ) : (
                                    <div className="h-[450px] flex items-center justify-center border rounded-2xl bg-red-500/5 border-red-500/10">
                                        <p className="text-sm font-bold text-red-500/60 uppercase tracking-widest">{errorMsg || "Forensic Data Unavailable"}</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </td>
                </tr>
            )}
        </>
    );
});

CinemaShowtimeRow.displayName = 'CinemaShowtimeRow';
