'use client';

import React, { useMemo, useState } from 'react';
import { Building2, ChevronRight } from 'lucide-react';
import { MerchantBadge } from '@/components/MerchantBadge';
import { ShowtimeSnapshot, SortDirection } from '../types/performance';
import { calculateForensicAggregation } from '../utils/performance-math';
import { getOccupancyColor } from '../utils/colors';
import { formatOccupancy } from '../utils/format';
import { ForensicAuditProgress } from './ForensicAuditProgress';
import { cn } from '@/lib/utils';

type SortField = 'theatre_name' | 'merchant' | 'showtime_count' | 'total_sold' | 'true_occupancy_pct';

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
        const theatreGroups = new Map<string, ShowtimeSnapshot[]>();

        showtimes.forEach(st => {
            const id = st.theatre_id || st.theatre_name;
            if (!theatreGroups.has(id)) theatreGroups.set(id, []);
            theatreGroups.get(id)!.push(st);
        });

        return Array.from(theatreGroups.entries()).map(([, theatreShows]) => {
            const forensic = calculateForensicAggregation(theatreShows);
            const firstShow = theatreShows[0];

            return {
                theatre_id: firstShow.theatre_id,
                theatre_name: firstShow.theatre_name || 'Unknown Cinema',
                merchant: firstShow.merchant || 'Unknown',
                ...forensic
            };
        }).sort((a, b) => {
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
                                    <MerchantBadge merchant={cinema.merchant} />
                                </td>
                                <td className="p-4 text-right font-mono font-bold text-xs opacity-60">{cinema.showtime_count}</td>
                                <td className="p-4 hidden md:table-cell">
                                    <ForensicAuditProgress 
                                        auditedCount={cinema.audited_count} 
                                        totalCount={cinema.showtime_count} 
                                    />
                                </td>
                                <td className="p-4 text-right font-black font-mono text-xs tabular-nums">
                                    {cinema.total_sold.toLocaleString()}
                                    <span className="text-muted-foreground/30 font-normal ml-1">/{cinema.total_seats.toLocaleString()}</span>
                                </td>
                                <td className="py-4 px-4 text-right">
                                    <span className={cn(
                                        "text-xs font-black font-mono tabular-nums",
                                        getOccupancyColor(cinema.true_occupancy_pct)
                                    )}>
                                        {formatOccupancy(cinema.true_occupancy_pct)}%
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
