'use client';

import React, { useMemo, useState } from 'react';
import { MapPin, ChevronRight } from 'lucide-react';
import { ShowtimeSnapshot } from './ShowtimeTable';
import { cn } from '@/lib/utils';

interface MarketAggregation {
    city: string;
    total_sold: number;
    total_seats: number;
    showtime_count: number;
    theatre_count: number;
    audited_count: number;
    true_occupancy_pct: number;
}

type SortField = 'city' | 'showtime_count' | 'theatre_count' | 'total_sold' | 'true_occupancy_pct';
type SortDirection = 'asc' | 'desc';

interface MarketMarketTableProps {
    showtimes: ShowtimeSnapshot[];
    onDrillDown: (city: string) => void;
}

export function MarketMarketTable({ showtimes, onDrillDown }: MarketMarketTableProps) {
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

    const marketData = useMemo(() => {
        const map = new Map<string, MarketAggregation & { _theatre_ids: Set<string> }>();

        showtimes.forEach(st => {
            const city = st.city || 'Unknown';
            if (!map.has(city)) {
                map.set(city, {
                    city,
                    total_sold: 0,
                    total_seats: 0,
                    showtime_count: 0,
                    theatre_count: 0,
                    audited_count: 0,
                    true_occupancy_pct: 0,
                    _theatre_ids: new Set()
                });
            }

            const agg = map.get(city)!;
            agg.total_sold += (st.audience_count ?? st.sold_seats ?? 0);
            agg.total_seats += (st.total_seats ?? 0);
            agg.showtime_count += 1;
            if (st.audience_count !== undefined) {
                agg.audited_count += 1;
            }
            agg._theatre_ids.add(st.theatre_id || st.theatre_name);
        });

        return Array.from(map.values()).map(agg => {
            const { _theatre_ids, ...rest } = agg;
            return {
                ...rest,
                theatre_count: _theatre_ids.size,
                true_occupancy_pct: rest.total_seats > 0 ? (rest.total_sold / rest.total_seats) * 100 : 0
            };
        }).sort((a, b) => {
            let comp = 0;
            if (sortField === 'city') comp = a.city.localeCompare(b.city);
            else if (sortField === 'showtime_count') comp = a.showtime_count - b.showtime_count;
            else if (sortField === 'theatre_count') comp = a.theatre_count - b.theatre_count;
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
                        <th className="p-4 text-left cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => handleSort('city')}>City</th>
                        <th className="p-4 text-right cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => handleSort('theatre_count')}>Cinemas</th>
                        <th className="p-4 text-right cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => handleSort('showtime_count')}>Shows</th>
                        <th className="p-4 text-center hidden md:table-cell">Audit Progress</th>
                        <th className="p-4 text-right cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => handleSort('total_sold')}>Sold</th>
                        <th className="p-4 text-right cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => handleSort('true_occupancy_pct')}>True OCR %</th>
                        <th className="p-4 w-10"></th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                    {marketData.map((market) => {
                        const auditProgress = (market.audited_count / market.showtime_count) * 100;
                        return (
                            <tr 
                                key={market.city} 
                                className="hover:bg-primary/[0.02] transition-colors cursor-pointer group"
                                onClick={() => onDrillDown(market.city)}
                            >
                                <td className="p-4">
                                    <div className="flex items-center gap-2 font-black uppercase text-xs tracking-tight group-hover:text-primary transition-colors">
                                        <MapPin className="w-3.5 h-3.5 text-muted-foreground/40" />
                                        {market.city}
                                    </div>
                                </td>
                                <td className="p-4 text-right font-mono font-bold text-xs opacity-60">{market.theatre_count}</td>
                                <td className="p-4 text-right font-mono font-bold text-xs opacity-60">{market.showtime_count}</td>
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
                                    {market.total_sold.toLocaleString()}
                                    <span className="text-muted-foreground/30 font-normal ml-1">/{market.total_seats.toLocaleString()}</span>
                                </td>
                                <td className="p-4 text-right">
                                    <span className={cn(
                                        "font-mono font-black text-sm",
                                        market.true_occupancy_pct >= 50 ? 'text-green-600' : 
                                        market.true_occupancy_pct >= 20 ? 'text-amber-600' : 'text-red-600'
                                    )}>
                                        {market.true_occupancy_pct.toFixed(1)}%
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
