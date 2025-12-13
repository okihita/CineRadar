'use client';

/**
 * useFilters - Custom hook for theatre filtering and sorting logic
 * Following Single Responsibility Principle
 */

import { useMemo, useState, useCallback } from 'react';
import { Theatre } from '@/types';
import { getRegion } from '@/lib/regions';

interface UseFiltersProps {
    theatres: Theatre[];
}

interface UseFiltersReturn {
    // Filter state
    searchTerm: string;
    setSearchTerm: (term: string) => void;
    selectedMerchant: string;
    setSelectedMerchant: (merchant: string) => void;
    selectedRegion: string;
    setSelectedRegion: (region: string) => void;

    // Sort state
    sortByName: 'asc' | 'desc' | null;
    sortByCity: 'asc' | 'desc' | null;
    toggleNameSort: () => void;
    toggleCitySort: () => void;

    // Derived data
    filteredTheatres: Theatre[];
    sortedTheatres: Theatre[];
    mapTheatres: Theatre[]; // For map (excludes search term filter)

    // Actions
    clearAllFilters: () => void;
}

export function useFilters({ theatres }: UseFiltersProps): UseFiltersReturn {
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedMerchant, setSelectedMerchant] = useState('all');
    const [selectedRegion, setSelectedRegion] = useState('all');
    const [sortByName, setSortByName] = useState<'asc' | 'desc' | null>(null);
    const [sortByCity, setSortByCity] = useState<'asc' | 'desc' | null>(null);

    // Theatres filtered by merchant only (for region counts)
    const merchantFilteredTheatres = useMemo(() => {
        return theatres.filter(t =>
            selectedMerchant === 'all' || t.merchant === selectedMerchant
        );
    }, [theatres, selectedMerchant]);

    // Map theatres - filtered by chain & region but NOT search
    const mapTheatres = useMemo(() => {
        return merchantFilteredTheatres.filter(t =>
            selectedRegion === 'all' || getRegion(t.city) === selectedRegion
        );
    }, [merchantFilteredTheatres, selectedRegion]);

    // Fully filtered theatres (includes search)
    const filteredTheatres = useMemo(() => {
        const searchLower = searchTerm.toLowerCase();
        return mapTheatres.filter(t =>
            t.name.toLowerCase().includes(searchLower) ||
            t.city.toLowerCase().includes(searchLower)
        );
    }, [mapTheatres, searchTerm]);

    // Sorted theatres
    const sortedTheatres = useMemo(() => {
        if (sortByCity) {
            return [...filteredTheatres].sort((a, b) =>
                sortByCity === 'asc'
                    ? a.city.localeCompare(b.city)
                    : b.city.localeCompare(a.city)
            );
        }
        if (sortByName) {
            return [...filteredTheatres].sort((a, b) =>
                sortByName === 'asc'
                    ? a.name.localeCompare(b.name)
                    : b.name.localeCompare(a.name)
            );
        }
        return filteredTheatres;
    }, [filteredTheatres, sortByCity, sortByName]);

    const toggleCitySort = useCallback(() => {
        setSortByName(null);
        setSortByCity(prev => prev === 'asc' ? 'desc' : prev === 'desc' ? null : 'asc');
    }, []);

    const toggleNameSort = useCallback(() => {
        setSortByCity(null);
        setSortByName(prev => prev === 'asc' ? 'desc' : prev === 'desc' ? null : 'asc');
    }, []);

    const clearAllFilters = useCallback(() => {
        setSearchTerm('');
        setSelectedMerchant('all');
        setSelectedRegion('all');
        setSortByName(null);
        setSortByCity(null);
    }, []);

    return {
        searchTerm,
        setSearchTerm,
        selectedMerchant,
        setSelectedMerchant,
        selectedRegion,
        setSelectedRegion,
        sortByName,
        sortByCity,
        toggleNameSort,
        toggleCitySort,
        filteredTheatres,
        sortedTheatres,
        mapTheatres,
        clearAllFilters,
    };
}

export default useFilters;
