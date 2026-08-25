/**
 * Zustand store for Cinemas page UI state
 * Handles filters, selections, and UI-only concerns
 */
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { Theatre } from '../types';

interface CinemasUIState {
    // Filter state
    searchTerm: string;
    selectedMerchant: string;
    selectedRegion: string;

    // Table state
    currentPage: number;
    sortByName: 'asc' | 'desc' | null;
    sortByCity: 'asc' | 'desc' | null;
    sortByCapacity: 'asc' | 'desc' | null;

    // Selection state
    selectedTheatre: Theatre | null;
    filteredTheatreIds: string[];

    // Map state
    mapCenter: { lat: number; lng: number; zoom: number } | null;

    // UI state
    showBackToTop: boolean;

    // Actions
    setSearchTerm: (term: string) => void;
    setSelectedMerchant: (merchant: string) => void;
    setSelectedRegion: (region: string) => void;
    setCurrentPage: (page: number) => void;
    toggleNameSort: () => void;
    toggleCitySort: () => void;
    toggleCapacitySort: () => void;
    setSelectedTheatre: (theatre: Theatre | null) => void;
    setFilteredTheatreIds: (ids: string[]) => void;
    setMapCenter: (center: { lat: number; lng: number; zoom: number } | null) => void;
    setShowBackToTop: (show: boolean) => void;
    clearFilters: () => void;
}

export const useCinemasStore = create<CinemasUIState>()(
    persist(
        (set) => ({
            // Initial state
            searchTerm: '',
            selectedMerchant: 'all',
            selectedRegion: 'all',
            currentPage: 1,
            sortByName: null,
            sortByCity: null,
            sortByCapacity: null,
            selectedTheatre: null,
            filteredTheatreIds: [],
            mapCenter: null,
            showBackToTop: false,

            // Actions
            setSearchTerm: (term) => set({ searchTerm: term, currentPage: 1 }),
            setSelectedMerchant: (merchant) => set({ selectedMerchant: merchant, currentPage: 1 }),
            setSelectedRegion: (region) => set({ selectedRegion: region, currentPage: 1 }),
            setCurrentPage: (page) => set({ currentPage: page }),

            toggleNameSort: () =>
                set((state) => ({
                    sortByName: state.sortByName === 'asc' ? 'desc' : state.sortByName === 'desc' ? null : 'asc',
                    sortByCity: null,
                    sortByCapacity: null,
                })),

            toggleCitySort: () =>
                set((state) => ({
                    sortByCity: state.sortByCity === 'asc' ? 'desc' : state.sortByCity === 'desc' ? null : 'asc',
                    sortByName: null,
                    sortByCapacity: null,
                })),

            toggleCapacitySort: () =>
                set((state) => ({
                    sortByCapacity: state.sortByCapacity === 'asc' ? 'desc' : state.sortByCapacity === 'desc' ? null : 'asc',
                    sortByName: null,
                    sortByCity: null,
                })),

            setSelectedTheatre: (theatre) => set({ selectedTheatre: theatre }),
            setFilteredTheatreIds: (ids) =>
                set((state) => {
                    // Only update if the IDs have actually changed to prevent infinite loops
                    const isSame =
                        state.filteredTheatreIds.length === ids.length &&
                        state.filteredTheatreIds.every((id, index) => id === ids[index]);
                    if (isSame) return state;
                    return { filteredTheatreIds: ids };
                }),
            setMapCenter: (center) => set({ mapCenter: center }),
            setShowBackToTop: (show) => set({ showBackToTop: show }),

            clearFilters: () =>
                set({
                    searchTerm: '',
                    selectedMerchant: 'all',
                    selectedRegion: 'all',
                    currentPage: 1,
                    sortByName: null,
                    sortByCity: null,
                    sortByCapacity: null,
                    filteredTheatreIds: [],
                }),
        }),
        {
            name: 'cinemas-navigation-storage',
            storage: createJSONStorage(() => localStorage),
            partialize: (state) => ({ 
                filteredTheatreIds: state.filteredTheatreIds,
                searchTerm: state.searchTerm,
                selectedMerchant: state.selectedMerchant,
                selectedRegion: state.selectedRegion,
                sortByName: state.sortByName,
                sortByCity: state.sortByCity,
                sortByCapacity: state.sortByCapacity,
            }),
        }
    )
);
