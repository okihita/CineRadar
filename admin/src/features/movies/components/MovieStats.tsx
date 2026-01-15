/**
 * Movie Stats Cards component
 */
'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Film, Clock, MapPin } from 'lucide-react';
import type { MoviesStats } from '../types';

interface MovieStatsProps {
    stats: MoviesStats;
}

export function MovieStats({ stats }: MovieStatsProps) {
    return (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <Card>
                <CardContent className="pt-4">
                    <div className="flex items-center gap-2">
                        <Film className="w-4 h-4 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">Movies</span>
                    </div>
                    <p className="text-2xl font-bold mt-1">{stats.totalMovies}</p>
                </CardContent>
            </Card>

            <Card>
                <CardContent className="pt-4">
                    <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">Showtimes</span>
                    </div>
                    <p className="text-2xl font-bold mt-1">
                        {stats.filteredShowtimes}
                        <span className="text-sm font-normal text-muted-foreground ml-1">
                            / {stats.totalShowtimes}
                        </span>
                    </p>
                </CardContent>
            </Card>

            <Card>
                <CardContent className="pt-4">
                    <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">Cities</span>
                    </div>
                    <p className="text-2xl font-bold mt-1">{stats.totalCities}</p>
                </CardContent>
            </Card>

            <Card>
                <CardContent className="pt-4">
                    <div className="flex items-center gap-2">
                        <span className="w-4 h-4 rounded bg-primary text-[10px] text-primary-foreground flex items-center justify-center font-bold">
                            T
                        </span>
                        <span className="text-xs text-muted-foreground">Theatres</span>
                    </div>
                    <p className="text-2xl font-bold mt-1">{stats.totalTheatres}</p>
                </CardContent>
            </Card>
        </div>
    );
}
