'use client';

/**
 * SWR hook for fetching cinemas data (theatres + scraper runs)
 * Handles server state with caching and revalidation
 */
import { useMemo, useEffect } from 'react';
import useSWR from 'swr';
import type { Theatre, ScraperRun } from '../types';
import { REFRESH_INTERVALS } from '@/lib/constants';

interface CinemasAPIResponse {
    theatres: Theatre[];
    runs: ScraperRun[];
}

const fetcher = async (): Promise<CinemasAPIResponse> => {
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
            dedupingInterval: REFRESH_INTERVALS.MODERATE,
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

/**
 * High-performance filtered and sorted theatre list.
 * Automatically synchronizes filtered IDs to the store for snappy navigation.
 */
export function useFilteredTheatres(
    theatres: Theatre[] = [],
    searchTerm: string,
    selectedMerchant: string,
    selectedRegion: string,
    sortByName: 'asc' | 'desc' | null,
    sortByCity: 'asc' | 'desc' | null,
    sortByCapacity: 'asc' | 'desc' | null,
    getRegion: (city: string) => string,
    setFilteredIds: (ids: string[]) => void
) {
    // Ensure theatres is an array
    const safeTheatres = useMemo(() => Array.isArray(theatres) ? theatres : [], [theatres]);

    // 1. Filtering & Sorting Logic
    const filtered = useMemo(() => {
        let result = safeTheatres;

        if (selectedMerchant !== 'all') {
            result = result.filter((t) => t.merchant === selectedMerchant);
        }

        if (selectedRegion !== 'all') {
            result = result.filter((t) => getRegion(t.city) === selectedRegion);
        }

        if (searchTerm.trim()) {
            const term = searchTerm.toLowerCase();
            result = result.filter(
                (t) =>
                    t.name.toLowerCase().includes(term) ||
                    t.city.toLowerCase().includes(term) ||
                    t.address?.toLowerCase().includes(term)
            );
        }

        // Sort
        if (sortByName) {
            result = [...result].sort((a, b) =>
                sortByName === 'asc'
                    ? a.name.localeCompare(b.name)
                    : b.name.localeCompare(a.name)
            );
        } else if (sortByCity) {
            result = [...result].sort((a, b) =>
                sortByCity === 'asc'
                    ? a.city.localeCompare(b.city)
                    : b.city.localeCompare(a.city)
            );
        } else if (sortByCapacity) {
            result = [...result].sort((a, b) =>
                sortByCapacity === 'asc'
                    ? (a.total_capacity || 0) - (b.total_capacity || 0)
                    : (b.total_capacity || 0) - (a.total_capacity || 0)
            );
        }

        return result;
    }, [safeTheatres, searchTerm, selectedMerchant, selectedRegion, sortByName, sortByCity, sortByCapacity, getRegion]);

    // 2. Side Effect: Sync IDs to Store
    useEffect(() => {
        setFilteredIds(filtered.map(t => t.theatre_id));
    }, [filtered, setFilteredIds]);

    return filtered;
}
