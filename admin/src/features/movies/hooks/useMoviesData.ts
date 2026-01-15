/**
 * SWR hook for fetching movies/showtimes data
 */
import useSWR from 'swr';
import type { Showtime, SortField, SortDirection } from '../types';

interface MoviesAPIResponse {
    showtimes: Showtime[];
    date: string;
    error?: string;
}

const fetcher = async (url: string): Promise<MoviesAPIResponse> => {
    const res = await fetch(url);
    if (!res.ok) {
        throw new Error('Failed to fetch movie data');
    }
    return res.json();
};

export function useMoviesData() {
    const { data, error, isLoading, mutate } = useSWR<MoviesAPIResponse>(
        '/api/movies',
        fetcher,
        {
            revalidateOnFocus: false,
            dedupingInterval: 60000,
        }
    );

    return {
        showtimes: data?.showtimes ?? [],
        date: data?.date ?? '',
        isLoading,
        isError: !!error || !!data?.error,
        error: error?.message || data?.error,
        refresh: mutate,
    };
}

// Derived data hook: filter and sort showtimes
export function useFilteredShowtimes(
    showtimes: Showtime[],
    searchTerm: string,
    filterCity: string,
    filterChain: string,
    filterRoom: string,
    showAvailableOnly: boolean,
    sortField: SortField,
    sortDirection: SortDirection
): Showtime[] {
    let result = showtimes;

    // Available only
    if (showAvailableOnly) {
        result = result.filter((s) => s.is_available);
    }

    // Search
    if (searchTerm) {
        const term = searchTerm.toLowerCase();
        result = result.filter(
            (s) =>
                s.movie_title.toLowerCase().includes(term) ||
                s.theatre_name.toLowerCase().includes(term) ||
                s.city.toLowerCase().includes(term)
        );
    }

    // Filters
    if (filterCity !== 'all') {
        result = result.filter((s) => s.city === filterCity);
    }
    if (filterChain !== 'all') {
        result = result.filter((s) => s.chain === filterChain);
    }
    if (filterRoom !== 'all') {
        result = result.filter((s) => s.room_type === filterRoom);
    }

    // Sort
    if (sortField && sortDirection) {
        result = [...result].sort((a, b) => {
            let aVal = a[sortField];
            let bVal = b[sortField];

            // Special handling for showtime (HH:MM format)
            if (sortField === 'showtime') {
                aVal = aVal.replace(':', '');
                bVal = bVal.replace(':', '');
            }

            const comparison = aVal.localeCompare(bVal);
            return sortDirection === 'asc' ? comparison : -comparison;
        });
    }

    return result;
}
