/**
 * Movie Intelligence Page
 * Showtimes and schedules across all theatres
 *
 * Refactored: 496 lines → ~100 lines
 * - Feature-based folder structure (/features/movies/)
 * - Zustand for UI state (useMoviesStore) - replaces 13 useState hooks
 * - SWR for server state (useMoviesData)
 * - Extracted components: MovieStats, MovieFilters, ShowtimeTable
 */
'use client';

import { useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Film } from 'lucide-react';

// Feature imports
import {
    useMoviesStore,
    useMoviesData,
    useFilteredShowtimes,
    MovieStats,
    MovieFilters,
    ShowtimeTable,
} from '@/features/movies';

export default function MoviesPage() {
    // Server state (SWR)
    const { showtimes, date, isLoading, isError, error } = useMoviesData();

    // UI state (Zustand)
    const store = useMoviesStore();

    // Derived data
    const cities = useMemo(
        () => [...new Set(showtimes.map((s) => s.city))].sort(),
        [showtimes]
    );

    const chains = useMemo(
        () => [...new Set(showtimes.map((s) => s.chain))].filter(Boolean).sort(),
        [showtimes]
    );

    const roomTypes = useMemo(
        () => [...new Set(showtimes.map((s) => s.room_type))].filter(Boolean).sort(),
        [showtimes]
    );

    // Filtered showtimes
    const filteredShowtimes = useFilteredShowtimes(
        showtimes,
        store.searchTerm,
        store.filterCity,
        store.filterChain,
        store.filterRoom,
        store.showAvailableOnly,
        store.sortField,
        store.sortDirection
    );

    // Stats
    const stats = useMemo(
        () => ({
            totalMovies: new Set(showtimes.map((s) => s.movie_id)).size,
            totalShowtimes: showtimes.length,
            filteredShowtimes: filteredShowtimes.length,
            totalCities: cities.length,
            totalTheatres: new Set(showtimes.map((s) => s.theatre_id)).size,
        }),
        [showtimes, filteredShowtimes, cities]
    );

    // Loading state
    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-center">
                    <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                    <p className="text-muted-foreground text-sm">Loading movie data...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background text-foreground p-6">
            {/* Header */}
            <div className="mb-6">
                <div className="flex items-center gap-3 mb-2">
                    <Film className="w-6 h-6 text-primary" />
                    <h1 className="text-2xl font-bold">Movie Intelligence</h1>
                </div>
                <p className="text-muted-foreground text-sm">
                    Showtimes and schedules across all theatres
                    {date && <span className="ml-2">• Data from {date}</span>}
                </p>
            </div>

            {/* KPI Cards */}
            <MovieStats stats={stats} />

            {/* Error display */}
            {isError && (
                <Card className="mb-6 border-destructive">
                    <CardContent className="pt-4">
                        <p className="text-destructive">{error}</p>
                    </CardContent>
                </Card>
            )}

            {/* Filters */}
            <MovieFilters
                searchTerm={store.searchTerm}
                filterCity={store.filterCity}
                filterChain={store.filterChain}
                filterRoom={store.filterRoom}
                showAvailableOnly={store.showAvailableOnly}
                cities={cities}
                chains={chains}
                roomTypes={roomTypes}
                onSearchChange={store.setSearchTerm}
                onCityChange={store.setFilterCity}
                onChainChange={store.setFilterChain}
                onRoomChange={store.setFilterRoom}
                onAvailableOnlyChange={store.setShowAvailableOnly}
                onClearFilters={store.clearFilters}
            />

            {/* Showtime Table */}
            <ShowtimeTable
                showtimes={filteredShowtimes}
                currentPage={store.currentPage}
                sortField={store.sortField}
                sortDirection={store.sortDirection}
                onPageChange={store.setCurrentPage}
                onToggleSort={store.toggleSort}
                onClearFilters={store.clearFilters}
            />
        </div>
    );
}
