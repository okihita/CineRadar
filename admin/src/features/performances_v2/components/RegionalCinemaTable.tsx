'use client';

import React, { useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Building2, ChevronRight } from 'lucide-react';
import { ShowtimeSnapshot } from './ShowtimeTable';
import { cn } from '@/lib/utils';

interface CinemaAggregation {
    theatre_id: string;
    theatre_name: string;
    merchant: string;
    total_sold: number;
    total_seats: number;
    showtime_count: number;
    audited_count: number;
    true_occupancy_pct: number;
}

type SortField = 'theatre_name' | 'merchant' | 'showtime_count' | 'total_sold' | 'true_occupancy_pct';
type SortDirection = 'asc' | 'desc';

interface RegionalCinemaTableProps {
    showtimes: ShowtimeSnapshot[];
    onDrillDown: (theatreId: string) => void;
}

export function RegionalCinemaTable({ showtimes, onDrillDown }: RegionalCinemaTableProps) {
    const [sortField, setSortField] = useState<SortField>('true_occupancy_pct');
    const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

    const handleSort = (field: SortField) => {
        if (sortField === field) {
            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortDirection('desc');
        }
    };

    const cinemaData = useMemo(() => {
        const map = new Map<string, CinemaAggregation>();

        showtimes.forEach(st => {
            const id = st.theatre_id || st.theatre_name;
            if (!map.has(id)) {
                map.set(id, {
                    theatre_id: st.theatre_id,
                    theatre_name: st.theatre_name || 'Unknown Cinema',
                    merchant: st.merchant || 'Unknown',
                    total_sold: 0,
                    total_seats: 0,
                    showtime_count: 0,
                    audited_count: 0,
                    true_occupancy_pct: 0
                });
            }

            const agg = map.get(id)!;
            agg.total_sold += (st.audience_count ?? st.sold_seats ?? 0);
            agg.total_seats += (st.total_seats ?? 0);
            agg.showtime_count += 1;
            if (st.audience_count !== undefined) {
                agg.audited_count += 1;
            }
        });

        return Array.from(map.values()).map(agg => ({
            ...agg,
            true_occupancy_pct: agg.total_seats > 0 ? (agg.total_sold / agg.total_seats) * 100 : 0
        })).sort((a, b) => {
            let comp = 0;
            if (sortField === 'theatre_name') comp = a.theatre_name.localeCompare(b.theatre_name);
            else if (sortField === 'merchant') comp = a.merchant.localeCompare(b.merchant);
            else if (sortField === 'showtime_count') comp = a.showtime_count - b.showtime_count;
            else if (sortField === 'total_sold') comp = a.total_sold - b.total_sold;
            else if (sortField === 'true_occupancy_pct') comp = a.true_occupancy_pct - b.true_occupancy_pct;
            return sortDirection === 'asc' ? comp : -comp;
        });
    }, [showtimes, sortField, sortDirection]);

    return (
        <div className="overflow-x-auto">
            <table className="w-full text-sm">
                <thead>
                    <tr className="border-b bg-muted/30 uppercase text-[10px] font-black tracking-widest text-muted-foreground/70">
                        <th className="p-4 text-left cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => handleSort('theatre_name')}>Cinema / Mall</th>
                        <th className="p-4 text-left cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => handleSort('merchant')}>Chain</th>
                        <th className="p-4 text-right cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => handleSort('showtime_count')}>Shows</th>
                        <th className="p-4 text-center hidden md:table-cell">Audit Status</th>
                        <th className="p-4 text-right cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => handleSort('total_sold')}>Sold</th>
                        <th className="p-4 text-right cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => handleSort('true_occupancy_pct')}>True OCR %</th>
                        <th className="p-4 w-10"></th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                    {cinemaData.map((cinema) => {
                        const auditProgress = (cinema.audited_count / cinema.showtime_count) * 100;
                        return (
                            <tr 
                                key={cinema.theatre_id || cinema.theatre_name} 
                                className="hover:bg-primary/[0.02] transition-colors cursor-pointer group"
                                onClick={() => onDrillDown(cinema.theatre_id)}
                            >
                                <td className="p-4">
                                    <div className="flex items-center gap-2 font-black uppercase text-xs tracking-tight group-hover:text-primary transition-colors">
                                        <Building2 className="w-3.5 h-3.5 text-muted-foreground/40" />
                                        {cinema.theatre_name}
                                    </div>
                                </td>
                                <td className="p-4">
                                    <Badge variant="outline" className={cn(
                                        "text-[9px] font-black uppercase tracking-widest border-muted-foreground/20",
                                        cinema.merchant.toUpperCase().includes('CGV') && "text-red-600 border-red-500/20 bg-red-500/5",
                                        cinema.merchant.toUpperCase().includes('XXI') && "text-blue-600 border-blue-500/20 bg-blue-500/5",
                                        (cinema.merchant.toUpperCase().includes('CINEPOLIS') || cinema.merchant.toUpperCase().includes('CINÉPOLIS')) && "text-purple-600 border-purple-500/20 bg-purple-500/5"
                                    )}>
                                        {cinema.merchant}
                                    </Badge>
                                </td>
                                <td className="p-4 text-right font-mono font-bold text-xs opacity-60">{cinema.showtime_count}</td>
                                <td className="p-4 hidden md:table-cell">
                                    <div className="flex items-center justify-center gap-2">
                                        <div className="w-16 h-1 bg-muted rounded-full overflow-hidden">
                                            <div 
                                                className={cn(
                                                    "h-full transition-all duration-1000",
                                                    auditProgress === 100 ? "bg-green-500" : "bg-amber-500"
                                                )}
                                                style={{ width: `${auditProgress}%` }}
                                            />
                                        </div>
                                        <span className="text-[9px] font-black font-mono text-muted-foreground/60">{auditProgress.toFixed(0)}%</span>
                                    </div>
                                </td>
                                <td className="p-4 text-right font-black font-mono text-xs tabular-nums">
                                    {cinema.total_sold.toLocaleString()}
                                    <span className="text-muted-foreground/30 font-normal ml-1">/{cinema.total_seats.toLocaleString()}</span>
                                </td>
                                <td className="p-4 text-right">
                                    <span className={cn(
                                        "font-mono font-black text-sm",
                                        cinema.true_occupancy_pct >= 50 ? 'text-green-600' : 
                                        cinema.true_occupancy_pct >= 20 ? 'text-amber-600' : 'text-red-600'
                                    )}>
                                        {cinema.true_occupancy_pct.toFixed(1)}%
                                    </span>
                                </td>
                                <td className="p-4">
                                    <ChevronRight className="w-4 h-4 text-muted-foreground/20 group-hover:text-primary transition-all group-hover:translate-x-0.5" />
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}
