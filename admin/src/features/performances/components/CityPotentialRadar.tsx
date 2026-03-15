'use client';
import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Trophy, ArrowUpDown, Building2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CityPerformance } from '../hooks/useCityAggregation';

interface CityPotentialRadarProps {
    cityStats: CityPerformance[];
}

type SortField = 'city' | 'shows' | 'theatres' | 'potential' | 'occupancy' | 'sold';
type SortDirection = 'asc' | 'desc';

export function CityPotentialRadar({ cityStats }: CityPotentialRadarProps) {
    const [sortField, setSortField] = useState<SortField>('shows');
    const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

    const topCities = useMemo(() => {
        // First, filter to Top 15 by potential (shows) if we just want the core markets
        // Or we can sort ALL cities based on the user's selection, but slice to 15.
        // Let's sort the whole dataset based on selection, then slice to Top 15.
        
        const sorted = [...cityStats].sort((a, b) => {
            let comparison = 0;
            switch (sortField) {
                case 'city':
                    comparison = a.city.localeCompare(b.city);
                    break;
                case 'shows':
                    comparison = a.totalShows - b.totalShows;
                    break;
                case 'theatres':
                    comparison = a.totalTheatres - b.totalTheatres;
                    break;
                case 'potential':
                    comparison = a.totalPotential - b.totalPotential;
                    break;
                case 'occupancy':
                    comparison = a.occupancyPct - b.occupancyPct;
                    break;
                case 'sold':
                    comparison = a.totalSold - b.totalSold;
                    break;
            }
            return sortDirection === 'asc' ? comparison : -comparison;
        });

        // Limit to top 15 to keep the UI clean as requested
        return sorted.slice(0, 15);
    }, [cityStats, sortField, sortDirection]);

    const handleSort = (field: SortField) => {
        if (sortField === field) {
            setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortDirection('desc'); // Default to descending for numbers
        }
    };

    const SortIcon = ({ field }: { field: SortField }) => {
        if (sortField !== field) return <ArrowUpDown className="w-3 h-3 ml-1 opacity-20 inline-block" />;
        return <ArrowUpDown className="w-3 h-3 ml-1 text-primary inline-block" />;
    };

    if (cityStats.length === 0) return null;

    return (
        <Card className="h-full">
            <CardHeader className="pb-3 border-b bg-muted/20">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Trophy className="w-4 h-4 text-amber-500" />
                    Top 15 Core Markets
                </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b bg-muted/10 text-left text-muted-foreground text-xs uppercase tracking-wider">
                                <th 
                                    className="py-2.5 px-4 font-medium cursor-pointer hover:bg-muted/50"
                                    onClick={() => handleSort('city')}
                                >
                                    City <SortIcon field="city" />
                                </th>
                                <th 
                                    className="py-2.5 px-4 font-medium text-right cursor-pointer hover:bg-muted/50"
                                    onClick={() => handleSort('theatres')}
                                >
                                    <div className="flex items-center justify-end gap-1">
                                        <Building2 className="w-3 h-3" />
                                        <span>Theatres</span>
                                        <SortIcon field="theatres" />
                                    </div>
                                </th>
                                <th 
                                    className="py-2.5 px-4 font-medium text-right cursor-pointer hover:bg-muted/50"
                                    onClick={() => handleSort('shows')}
                                >
                                    Shows <SortIcon field="shows" />
                                </th>
                                <th 
                                    className="py-2.5 px-4 font-medium text-right cursor-pointer hover:bg-muted/50"
                                    onClick={() => handleSort('potential')}
                                >
                                    Potential <SortIcon field="potential" />
                                </th>
                                <th 
                                    className="py-2.5 px-4 font-medium w-32 cursor-pointer hover:bg-muted/50"
                                    onClick={() => handleSort('occupancy')}
                                >
                                    Occupancy <SortIcon field="occupancy" />
                                </th>
                                <th 
                                    className="py-2.5 px-4 font-medium text-right cursor-pointer hover:bg-muted/50"
                                    onClick={() => handleSort('sold')}
                                >
                                    Sold <SortIcon field="sold" />
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {topCities.map((city, idx) => (
                                <tr 
                                    key={city.city} 
                                    className="border-b last:border-0 hover:bg-muted/30 transition-colors"
                                >
                                    <td className="py-2.5 px-4">
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs text-muted-foreground font-mono w-4">{idx + 1}.</span>
                                            <span className="font-medium">{city.city}</span>
                                        </div>
                                    </td>
                                    <td className="py-2.5 px-4 text-right font-mono text-muted-foreground">
                                        {city.totalTheatres}
                                    </td>
                                    <td className="py-2.5 px-4 text-right font-mono text-muted-foreground">
                                        {city.totalShows}
                                    </td>
                                    <td className="py-2.5 px-4 text-right font-mono text-muted-foreground">
                                        {city.totalPotential.toLocaleString()}
                                    </td>
                                    <td className="py-2.5 px-4">
                                        <div className="flex items-center gap-2">
                                            <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                                                <div 
                                                    className={cn(
                                                        "h-full rounded-full",
                                                        city.occupancyPct > 60 ? "bg-green-500" :
                                                        city.occupancyPct < 30 ? "bg-red-500" : "bg-amber-500"
                                                    )}
                                                    style={{ width: `${Math.min(city.occupancyPct, 100)}%` }}
                                                />
                                            </div>
                                            <span className="text-xs font-mono w-10 text-right">
                                                {city.occupancyPct.toFixed(1)}%
                                            </span>
                                        </div>
                                    </td>
                                    <td className="py-2.5 px-4 text-right font-mono font-medium text-foreground">
                                        {city.totalSold.toLocaleString()}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </CardContent>
        </Card>
    );
}
