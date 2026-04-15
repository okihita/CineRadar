'use client';

import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowUpDown, Building2, MapPin, ChevronDown, ChevronRight } from 'lucide-react';
import { ShowtimeRow } from './ShowtimeTable';
import { ShowtimeSnapshot } from '../types/performance';

interface CinemaAggregation {
    theatre_name: string;
    city: string;
    merchant: string;
    total_sold: number;
    total_seats: number;
    showtime_count: number;
    studios_count: number;
    occupancy_pct: number;
    showtimes: ShowtimeSnapshot[];
}

type SortField = 'city' | 'theatre_name' | 'merchant' | 'showtime_count' | 'studios_count' | 'total_sold' | 'occupancy_pct';
type SortDirection = 'asc' | 'desc';

interface CinemaPerformanceTableProps {
    showtimes: ShowtimeSnapshot[];
}

const SortIcon = ({ 
    field, 
    sortField, 
    sortDirection 
}: { 
    field: SortField, 
    sortField: SortField, 
    sortDirection: SortDirection 
}) => {
    if (sortField !== field) return <ArrowUpDown className="ml-1 w-3 h-3 text-muted-foreground/50 opacity-0 group-hover:opacity-100 transition-opacity" />;
    return (
        <span className="ml-1 text-primary">
            {sortDirection === 'asc' ? '↑' : '↓'}
        </span>
    );
};

export function CinemaPerformanceTable({ showtimes }: CinemaPerformanceTableProps) {
    const [sortField, setSortField] = useState<SortField>('occupancy_pct');
    const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
    const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

    const toggleRow = (key: string) => {
        const next = new Set(expandedRows);
        if (next.has(key)) {
            next.delete(key);
        } else {
            next.add(key);
        }
        setExpandedRows(next);
    };

    const handleSort = (field: SortField) => {
        if (sortField === field) {
            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortDirection('desc'); // Default to descending for new field
        }
    };

    const aggregatedData = useMemo(() => {
        const map = new Map<string, CinemaAggregation & { _studio_ids: Set<string> }>();

        showtimes.forEach(st => {
            const key = `${st.city}-${st.theatre_name}`;
            
            if (!map.has(key)) {
                map.set(key, {
                    theatre_name: st.theatre_name || 'Unknown',
                    city: st.city || 'Unknown',
                    merchant: st.merchant || 'Unknown',
                    total_sold: 0,
                    total_seats: 0,
                    showtime_count: 0,
                    studios_count: 0,
                    occupancy_pct: 0,
                    showtimes: [],
                    _studio_ids: new Set()
                });
            }

            const agg = map.get(key)!;
            const sold = st.audience_count !== undefined ? st.audience_count : (st.sold_seats || 0);
            
            agg.total_sold += sold;
            agg.total_seats += (st.total_seats || 0);
            agg.showtime_count += 1;
            agg.showtimes.push(st);
            
            // Collect unique studio IDs to count actual physical rooms used
            if (st.studio_id) {
                agg._studio_ids.add(st.studio_id);
            }
        });

        const result = Array.from(map.values()).map(agg => {
            // Sort showtimes within each cinema chronologically
            agg.showtimes.sort((a, b) => (a.showtime || '').localeCompare(b.showtime || ''));
            // Remove the temporary Set before returning
            const { _studio_ids, ...rest } = agg;
            
            // If we have studio IDs (new data), use the exact count.
            // If missing (legacy data), estimate 1 studio per 5 showtimes.
            const calculatedStudios = _studio_ids.size > 0 
                ? _studio_ids.size 
                : Math.max(1, Math.ceil(rest.showtime_count / 5));

            return {
                ...rest,
                studios_count: calculatedStudios,
                occupancy_pct: rest.total_seats > 0 ? (rest.total_sold / rest.total_seats) * 100 : 0
            };
        });

        return result.sort((a, b) => {
            let comparison = 0;
            switch (sortField) {
                case 'city':
                    comparison = a.city.localeCompare(b.city);
                    break;
                case 'theatre_name':
                    comparison = a.theatre_name.localeCompare(b.theatre_name);
                    break;
                case 'merchant':
                    comparison = a.merchant.localeCompare(b.merchant);
                    break;
                case 'showtime_count':
                    comparison = a.showtime_count - b.showtime_count;
                    break;
                case 'studios_count':
                    comparison = a.studios_count - b.studios_count;
                    break;
                case 'total_sold':
                    comparison = a.total_sold - b.total_sold;
                    break;
                case 'occupancy_pct':
                    comparison = a.occupancy_pct - b.occupancy_pct;
                    break;
            }
            return sortDirection === 'asc' ? comparison : -comparison;
        });

    }, [showtimes, sortField, sortDirection]);

    if (showtimes.length === 0) {
        return null;
    }

    return (
        <Card className="shadow-none border-muted/50">
            <CardHeader className="pb-3 border-b bg-muted/20">
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle className="text-lg flex items-center gap-2">
                            <Building2 className="w-5 h-5 text-primary" />
                            Performance by Location
                        </CardTitle>
                        <CardDescription>
                            Aggregated occupancy and ticket sales by Cinema/Mall. Click a row to see individual showtimes.
                        </CardDescription>
                    </div>
                    <Badge variant="outline" className="font-mono bg-background">
                        {aggregatedData.length} Locations
                    </Badge>
                </div>
            </CardHeader>
            <CardContent className="p-0">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b bg-muted/30">
                                <th className="p-3 w-8"></th>
                                <th 
                                    className="p-3 text-left font-medium text-muted-foreground cursor-pointer group hover:bg-muted/50 transition-colors"
                                    onClick={() => handleSort('city')}
                                >
                                    <div className="flex items-center">City <SortIcon field="city" sortField={sortField} sortDirection={sortDirection} /></div>
                                </th>
                                <th 
                                    className="p-3 text-left font-medium text-muted-foreground cursor-pointer group hover:bg-muted/50 transition-colors"
                                    onClick={() => handleSort('theatre_name')}
                                >
                                    <div className="flex items-center">Cinema <SortIcon field="theatre_name" sortField={sortField} sortDirection={sortDirection} /></div>
                                </th>
                                <th 
                                    className="p-3 text-left font-medium text-muted-foreground cursor-pointer group hover:bg-muted/50 transition-colors hidden md:table-cell"
                                    onClick={() => handleSort('merchant')}
                                >
                                    <div className="flex items-center">Chain <SortIcon field="merchant" sortField={sortField} sortDirection={sortDirection} /></div>
                                </th>
                                <th 
                                    className="p-3 text-right font-medium text-muted-foreground cursor-pointer group hover:bg-muted/50 transition-colors hidden sm:table-cell"
                                    onClick={() => handleSort('studios_count')}
                                >
                                    <div className="flex items-center justify-end">Studios <SortIcon field="studios_count" sortField={sortField} sortDirection={sortDirection} /></div>
                                </th>
                                <th 
                                    className="p-3 text-right font-medium text-muted-foreground cursor-pointer group hover:bg-muted/50 transition-colors hidden sm:table-cell"
                                    onClick={() => handleSort('showtime_count')}
                                >
                                    <div className="flex items-center justify-end">Shows <SortIcon field="showtime_count" sortField={sortField} sortDirection={sortDirection} /></div>
                                </th>
                                <th 
                                    className="p-3 text-right font-medium text-muted-foreground cursor-pointer group hover:bg-muted/50 transition-colors"
                                    onClick={() => handleSort('total_sold')}
                                >
                                    <div className="flex items-center justify-end">Tickets Sold <SortIcon field="total_sold" sortField={sortField} sortDirection={sortDirection} /></div>
                                </th>
                                <th 
                                    className="p-3 text-right font-medium text-muted-foreground hidden sm:table-cell"
                                >
                                    <div className="flex items-center justify-end">Capacity</div>
                                </th>
                                <th 
                                    className="p-3 text-right font-medium text-muted-foreground cursor-pointer group hover:bg-muted/50 transition-colors"
                                    onClick={() => handleSort('occupancy_pct')}
                                >
                                    <div className="flex items-center justify-end">OCR % <SortIcon field="occupancy_pct" sortField={sortField} sortDirection={sortDirection} /></div>
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {aggregatedData.map((loc) => {
                                const key = `${loc.city}-${loc.theatre_name}`;
                                const isExpanded = expandedRows.has(key);

                                return (
                                    <React.Fragment key={key}>
                                        <tr 
                                            className="border-b last:border-0 hover:bg-muted/30 transition-colors cursor-pointer group"
                                            onClick={() => toggleRow(key)}
                                        >
                                            <td className="p-3 text-muted-foreground">
                                                {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />}
                                            </td>
                                            <td className="p-3">
                                                <div className="flex items-center gap-1.5 font-medium">
                                                    <MapPin className="w-3 h-3 text-muted-foreground" />
                                                    {loc.city}
                                                </div>
                                            </td>
                                            <td className="p-3 font-medium">
                                                {loc.theatre_name}
                                            </td>
                                            <td className="p-3 hidden md:table-cell">
                                                <Badge variant="outline" className={`text-xs font-normal
                                                    ${loc.merchant.toUpperCase().includes('CGV') ? 'border-red-200 text-red-700 bg-red-50 dark:bg-red-950/20' : ''}
                                                    ${loc.merchant.toUpperCase().includes('XXI') ? 'border-blue-200 text-blue-700 bg-blue-50 dark:bg-blue-950/20' : ''}
                                                    ${loc.merchant.toUpperCase().includes('CINEPOLIS') ? 'border-purple-200 text-purple-700 bg-purple-50 dark:bg-purple-950/20' : ''}
                                                `}>
                                                    {loc.merchant}
                                                </Badge>
                                            </td>
                                            <td className="p-3 text-right text-muted-foreground hidden sm:table-cell font-mono">
                                                {loc.studios_count}
                                            </td>
                                            <td className="p-3 text-right text-muted-foreground hidden sm:table-cell font-mono">
                                                {loc.showtime_count}
                                            </td>
                                            <td className="p-3 text-right font-medium font-mono">
                                                {loc.total_sold.toLocaleString()}
                                            </td>
                                            <td className="p-3 text-right text-muted-foreground hidden sm:table-cell font-mono">
                                                {loc.total_seats.toLocaleString()}
                                            </td>
                                            <td className="p-3 text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    <span className={`font-mono font-bold
                                                        ${loc.occupancy_pct >= 50 ? 'text-green-600 dark:text-green-400' : ''}
                                                        ${loc.occupancy_pct >= 20 && loc.occupancy_pct < 50 ? 'text-amber-600 dark:text-amber-400' : ''}
                                                        ${loc.occupancy_pct < 20 ? 'text-red-600 dark:text-red-400' : ''}
                                                    `}>
                                                        {loc.occupancy_pct.toFixed(1)}%
                                                    </span>
                                                </div>
                                            </td>
                                        </tr>
                                        {/* Expanded Child Rows */}
                                        {isExpanded && (
                                            <tr className="bg-muted/5 border-b">
                                                <td colSpan={9} className="p-0">
                                                    <div className="border-l-2 border-primary ml-4 pl-4 py-4 pr-4">
                                                        <table className="w-full text-sm">
                                                            <tbody className="divide-y">
                                                                {loc.showtimes.map(st => (
                                                                    <ShowtimeRow 
                                                                        key={st.showtime_id} 
                                                                        showtime={st} 
                                                                        movieId={st.metadata_id}
                                                                        date={st.date}
                                                                    />
                                                                ))}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </React.Fragment>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </CardContent>
        </Card>
    );
}
