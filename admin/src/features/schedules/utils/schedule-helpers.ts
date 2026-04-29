/**
 * Schedule feature helpers for computing derived data from movie schedules.
 */

import { formatDistanceToNow, parseISO } from 'date-fns';
import { CitySchedule, countTheatreShowtimes } from '../types';
import { normalizeMerchant, CHAIN_NAMES, ChainName } from '@/lib/constants';

/** Aggregated room types for a movie: category → showtime count */
export function computeRoomTypes(cities: CitySchedule | null | undefined): Record<string, number> {
    const roomTypes: Record<string, number> = {};
    if (!cities) return roomTypes;
    for (const theatres of Object.values(cities)) {
        for (const theatre of theatres) {
            for (const room of theatre.rooms) {
                if (room.category) {
                    roomTypes[room.category] = (roomTypes[room.category] || 0) + room.all_showtimes.length;
                }
            }
        }
    }
    return roomTypes;
}

/** Per-chain showtime count across all movies */
export interface ChainStats {
    chain: ChainName;
    movieCount: number;
    showtimeCount: number;
    theatreCount: number;
}

export function computeChainDistribution(movies: { cities: CitySchedule; merchants: string[] }[]): ChainStats[] {
    const chainMap = new Map<ChainName, { movieCount: number; showtimeCount: number; theatreCount: Set<string> }>();

    // Initialize all known chains
    for (const chain of CHAIN_NAMES) {
        chainMap.set(chain, { movieCount: 0, showtimeCount: 0, theatreCount: new Set() });
    }

    for (const movie of movies) {
        // Track which chains appear in this movie's actual theatre data
        const chainsInMovie = new Set<ChainName>();

        if (movie.cities) {
            for (const theatres of Object.values(movie.cities)) {
                for (const theatre of theatres) {
                    const chain = normalizeMerchant(theatre.merchant);
                    if (chain) {
                        chainsInMovie.add(chain);
                        const entry = chainMap.get(chain);
                        if (entry) {
                            entry.showtimeCount += countTheatreShowtimes(theatre);
                            entry.theatreCount.add(theatre.theatre_id);
                        }
                    }
                }
            }
        }

        for (const chain of chainsInMovie) {
            const entry = chainMap.get(chain);
            if (entry) entry.movieCount++;
        }
    }

    return CHAIN_NAMES.map((chain) => {
        const entry = chainMap.get(chain);
        return {
            chain,
            movieCount: entry?.movieCount || 0,
            showtimeCount: entry?.showtimeCount || 0,
            theatreCount: entry?.theatreCount.size || 0,
        };
    }).filter((c) => c.showtimeCount > 0);
}

/** Per-chain breakdown within a single city's theatres */
export function computeCityChains(theatres: { merchant: string; rooms: { all_showtimes: { is_available: boolean }[] }[] }[]): { chain: ChainName; showtimes: number; available: number }[] {
    const map = new Map<ChainName, { showtimes: number; available: number }>();

    for (const t of theatres) {
        const chain = normalizeMerchant(t.merchant);
        if (!chain) continue;
        const entry = map.get(chain) || { showtimes: 0, available: 0 };
        for (const room of t.rooms) {
            for (const s of room.all_showtimes) {
                entry.showtimes++;
                if (s.is_available) entry.available++;
            }
        }
        map.set(chain, entry);
    }

    return CHAIN_NAMES
        .map((chain) => {
            const entry = map.get(chain);
            if (!entry) return null;
            return { chain, ...entry };
        })
        .filter((c): c is NonNullable<typeof c> => c !== null);
}

/** Format uploaded_at timestamp to relative time string */
export function formatFreshness(uploadedAt: string | null | undefined): string | null {
    if (!uploadedAt) return null;
    try {
        const date = parseISO(uploadedAt);
        return formatDistanceToNow(date, { addSuffix: true });
    } catch {
        return null;
    }
}

/** Find the most recent uploaded_at from a list of movies */
export function getLatestUpload(movies: { uploaded_at: string }[]): string | null {
    let latest: string | null = null;
    for (const m of movies) {
        if (m.uploaded_at && (!latest || m.uploaded_at > latest)) {
            latest = m.uploaded_at;
        }
    }
    return latest;
}

/** Collect all unique genres from movie list */
export function collectGenres(movies: { genres: string[] }[]): string[] {
    const set = new Set<string>();
    for (const m of movies) {
        for (const g of m.genres) {
            set.add(g);
        }
    }
    return Array.from(set).sort();
}
