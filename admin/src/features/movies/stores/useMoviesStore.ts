/**
 * Zustand store for Movies page UI state
 * Replaces 13 useState hooks with single store
 */
import { create } from 'zustand';
import type { SortField, SortDirection } from '../types';

interface MoviesUIState {
    // Filters
    searchTerm: string;
    filterCity: string;
    filterChain: string;
    filterRoom: string;
    showAvailableOnly: boolean;

    // Sorting
    sortField: SortField;
    sortDirection: SortDirection;

    // Pagination
    currentPage: number;

    // Actions
    setSearchTerm: (term: string) => void;
    setFilterCity: (city: string) => void;
    setFilterChain: (chain: string) => void;
    setFilterRoom: (room: string) => void;
    setShowAvailableOnly: (show: boolean) => void;
    toggleSort: (field: SortField) => void;
    setCurrentPage: (page: number) => void;
    clearFilters: () => void;
}

export const useMoviesStore = create<MoviesUIState>((set) => ({
    // Initial state
    searchTerm: '',
    filterCity: 'all',
    filterChain: 'all',
    filterRoom: 'all',
    showAvailableOnly: true,
    sortField: 'showtime',
    sortDirection: 'asc',
    currentPage: 1,

    // Actions
    setSearchTerm: (term) => set({ searchTerm: term, currentPage: 1 }),
    setFilterCity: (city) => set({ filterCity: city, currentPage: 1 }),
    setFilterChain: (chain) => set({ filterChain: chain, currentPage: 1 }),
    setFilterRoom: (room) => set({ filterRoom: room, currentPage: 1 }),
    setShowAvailableOnly: (show) => set({ showAvailableOnly: show, currentPage: 1 }),

    toggleSort: (field) =>
        set((state) => {
            if (state.sortField === field) {
                const newDirection =
                    state.sortDirection === 'asc' ? 'desc' : state.sortDirection === 'desc' ? null : 'asc';
                return { sortDirection: newDirection, currentPage: 1 };
            }
            return { sortField: field, sortDirection: 'asc', currentPage: 1 };
        }),

    setCurrentPage: (page) => set({ currentPage: page }),

    clearFilters: () =>
        set({
            searchTerm: '',
            filterCity: 'all',
            filterChain: 'all',
            filterRoom: 'all',
            showAvailableOnly: true,
            currentPage: 1,
        }),
}));
