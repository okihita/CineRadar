import { useMemo } from 'react';
import { ShowtimeSnapshot } from '../components/ShowtimeTable';
import { getProvinceForCity } from '@/lib/geo-mapping';

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

export interface ProvincePerformance {
    province: string;
    totalShows: number;
    totalSeats: number;
    totalSold: number;
    occupancyPct: number;
    totalTheatres: number;
    totalBlocked: number;
    totalPotential: number;
    cities: CityPerformance[];
    topCity?: CityPerformance;
}

export function useCityAggregation(showtimes: ShowtimeSnapshot[]): {
    cityStats: CityPerformance[];
    provinceStats: ProvincePerformance[];
} {
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

        const cityResults = Array.from(cityMap.values()).map(stats => {
            stats.totalTheatres = stats._theatreSet.size;
            stats.totalPotential = stats.totalSeats - stats.totalBlocked;
            stats.occupancyPct = stats.totalPotential > 0 ? (stats.totalSold / stats.totalPotential) * 100 : 0;
            return stats;
        });

        // Step 2: Aggregate by Province
        const provinceMap = new Map<string, ProvincePerformance>();

        for (const cityStat of cityResults) {
            const provinceName = getProvinceForCity(cityStat.city);
            
            if (!provinceMap.has(provinceName)) {
                provinceMap.set(provinceName, {
                    province: provinceName,
                    totalShows: 0,
                    totalSeats: 0,
                    totalSold: 0,
                    occupancyPct: 0,
                    totalTheatres: 0,
                    totalBlocked: 0,
                    totalPotential: 0,
                    cities: [],
                });
            }

            const provStats = provinceMap.get(provinceName)!;
            provStats.totalShows += cityStat.totalShows;
            provStats.totalSeats += cityStat.totalSeats;
            provStats.totalSold += cityStat.totalSold;
            provStats.totalTheatres += cityStat.totalTheatres;
            provStats.totalBlocked += cityStat.totalBlocked;
            provStats.totalPotential += cityStat.totalPotential;
            provStats.cities.push(cityStat);
        }

        const provinceResults = Array.from(provinceMap.values()).map(prov => {
            prov.occupancyPct = prov.totalPotential > 0 ? (prov.totalSold / prov.totalPotential) * 100 : 0;
            // Sort cities within province by total shows to find the top contributor
            prov.cities.sort((a, b) => b.totalShows - a.totalShows);
            prov.topCity = prov.cities[0];
            return prov;
        });

        return {
            cityStats: cityResults,
            provinceStats: provinceResults,
        };
    }, [showtimes]);
}
