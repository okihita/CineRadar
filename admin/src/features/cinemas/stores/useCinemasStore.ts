/**
 * Zustand store for Cinemas page UI state
 * Handles filters, selections, and UI-only concerns
 */
import { create } from 'zustand';
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

    // Selection state
    selectedTheatre: Theatre | null;

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
    setSelectedTheatre: (theatre: Theatre | null) => void;
    setMapCenter: (center: { lat: number; lng: number; zoom: number } | null) => void;
    setShowBackToTop: (show: boolean) => void;
    clearFilters: () => void;
}

export const useCinemasStore = create<CinemasUIState>((set) => ({
    // Initial state
    searchTerm: '',
    selectedMerchant: 'all',
    selectedRegion: 'all',
    currentPage: 1,
    sortByName: null,
    sortByCity: null,
    selectedTheatre: null,
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
        })),

    toggleCitySort: () =>
        set((state) => ({
            sortByCity: state.sortByCity === 'asc' ? 'desc' : state.sortByCity === 'desc' ? null : 'asc',
            sortByName: null,
        })),

    setSelectedTheatre: (theatre) => set({ selectedTheatre: theatre }),
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
        }),
}));
