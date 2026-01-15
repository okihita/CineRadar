/**
 * SWR hook for fetching cinemas data (theatres + scraper runs)
 * Handles server state with caching and revalidation
 */
import useSWR from 'swr';
import type { Theatre, ScraperRun } from '../types';

interface CinemasAPIResponse {
    theatres: Theatre[];
    runs: ScraperRun[];
}

const fetcher = async (url: string): Promise<CinemasAPIResponse> => {
    // Fetch theatres and runs in parallel
    const [theatresRes, runsRes] = await Promise.all([
        fetch('/api/scraper'),
        fetch('/api/scraper/stats'),
    ]);

    if (!theatresRes.ok || !runsRes.ok) {
        throw new Error('Failed to fetch cinemas data');
    }

    const theatresData = await theatresRes.json();
    const runsData = await runsRes.json();

    return {
        theatres: theatresData.theatres || [],
        runs: runsData.recentRuns || [],
    };
};

export function useCinemasData() {
    const { data, error, isLoading, mutate } = useSWR<CinemasAPIResponse>(
        '/api/cinemas',
        fetcher,
        {
            revalidateOnFocus: false,
            revalidateOnReconnect: true,
            dedupingInterval: 60000, // 1 minute
        }
    );

    return {
        theatres: data?.theatres ?? [],
        runs: data?.runs ?? [],
        isLoading,
        isError: !!error,
        error,
        refresh: mutate,
    };
}

// Derived data hooks
export function useFilteredTheatres(
    theatres: Theatre[],
    searchTerm: string,
    selectedMerchant: string,
    selectedRegion: string,
    sortByName: 'asc' | 'desc' | null,
    sortByCity: 'asc' | 'desc' | null,
    getRegion: (city: string) => string
) {
    // Filter
    let filtered = theatres;

    if (selectedMerchant !== 'all') {
        filtered = filtered.filter((t) => t.merchant === selectedMerchant);
    }

    if (selectedRegion !== 'all') {
        filtered = filtered.filter((t) => getRegion(t.city) === selectedRegion);
    }

    if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        filtered = filtered.filter(
            (t) =>
                t.name.toLowerCase().includes(term) ||
                t.city.toLowerCase().includes(term) ||
                t.address?.toLowerCase().includes(term)
        );
    }

    // Sort
    if (sortByName) {
        filtered = [...filtered].sort((a, b) =>
            sortByName === 'asc'
                ? a.name.localeCompare(b.name)
                : b.name.localeCompare(a.name)
        );
    } else if (sortByCity) {
        filtered = [...filtered].sort((a, b) =>
            sortByCity === 'asc'
                ? a.city.localeCompare(b.city)
                : b.city.localeCompare(a.city)
        );
    }

    return filtered;
}
