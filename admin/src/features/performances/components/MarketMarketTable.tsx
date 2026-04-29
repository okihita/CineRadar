'use client';

import React, { useMemo, useState } from 'react';
import { MapPin, ChevronRight } from 'lucide-react';
import { ShowtimeSnapshot, SortDirection } from '../types/performance';
import { calculateForensicAggregation } from '../utils/performance-math';
import { getOccupancyColor } from '../utils/colors';
import { formatOccupancy } from '../utils/format';
import { ForensicAuditProgress } from './ForensicAuditProgress';
import { cn } from '@/lib/utils';

type SortField = 'city' | 'showtime_count' | 'theatre_count' | 'total_sold' | 'true_occupancy_pct';

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
        const cityGroups = new Map<string, ShowtimeSnapshot[]>();

        showtimes.forEach(st => {
            const city = st.city || 'Unknown';
            if (!cityGroups.has(city)) cityGroups.set(city, []);
            cityGroups.get(city)!.push(st);
        });

        return Array.from(cityGroups.entries()).map(([city, cityShows]) => {
            const forensic = calculateForensicAggregation(cityShows);
            const uniqueTheatres = new Set(cityShows.map(st => st.theatre_id || st.theatre_name)).size;

            return {
                city,
                ...forensic,
                theatre_count: uniqueTheatres
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
                                    <ForensicAuditProgress 
                                        auditedCount={market.audited_count} 
                                        totalCount={market.showtime_count} 
                                    />
                                </td>
                                <td className="p-4 text-right font-black font-mono text-xs tabular-nums">
                                    {market.total_sold.toLocaleString()}
                                    <span className="text-muted-foreground/30 font-normal ml-1">/{market.total_seats.toLocaleString()}</span>
                                </td>
                                <td className="py-4 px-4 text-right">
                                    <span className={cn(
                                        "text-xs font-black font-mono tabular-nums",
                                        getOccupancyColor(market.true_occupancy_pct)
                                    )}>
                                        {formatOccupancy(market.true_occupancy_pct)}%
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
