import { useMemo } from 'react';
import { ShowtimeSnapshot } from '../components/ShowtimeTable';

export interface CityPerformance {
    city: string;
    totalShows: number;
    totalSeats: number;
    totalSold: number;
    occupancyPct: number;
    totalTheatres: number;
    totalBlocked: number;
    totalPotential: number;
    _theatreSet: Set<string>; // Internal use for tracking unique theatres
}

export function useCityAggregation(showtimes: ShowtimeSnapshot[]): CityPerformance[] {
    return useMemo(() => {
        const cityMap = new Map<string, CityPerformance>();

        for (const st of showtimes) {
            const city = st.city || 'Unknown';
            if (!cityMap.has(city)) {
                cityMap.set(city, {
                    city,
                    totalShows: 0,
                    totalSeats: 0,
                    totalSold: 0,
                    occupancyPct: 0,
                    totalTheatres: 0,
                    totalBlocked: 0,
                    totalPotential: 0,
                    _theatreSet: new Set<string>(),
                });
            }

            const stats = cityMap.get(city)!;
            stats.totalShows += 1;
            stats.totalSeats += st.total_seats;
            stats.totalBlocked += st.initial_unavailable ?? 0;
            
            // Track unique theatres
            if (st.theatre_name) {
                stats._theatreSet.add(st.theatre_name);
            }

            // Use audience_count if available (Phase 2), otherwise fallback to legacy sold_seats
            stats.totalSold += st.audience_count ?? st.sold_seats ?? 0;
        }

        const results = Array.from(cityMap.values()).map(stats => {
            stats.totalTheatres = stats._theatreSet.size;
            stats.totalPotential = stats.totalSeats - stats.totalBlocked;
            stats.occupancyPct = stats.totalPotential > 0 ? (stats.totalSold / stats.totalPotential) * 100 : 0;
            return stats;
        });

        return results;
    }, [showtimes]);
}
