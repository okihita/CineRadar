/**
 * Movies feature types
 */

export interface Showtime {
    movie_id: string;
    movie_title: string;
    city: string;
    theatre_id: string;
    theatre_name: string;
    chain: string;
    room_type: string;
    price: string;
    showtime: string;
    showtime_id: string;
    is_available: boolean;
    date: string;
}

export type SortField = 'movie_title' | 'city' | 'chain' | 'room_type' | 'showtime' | 'theatre_name';
export type SortDirection = 'asc' | 'desc' | null;

export interface MoviesStats {
    totalMovies: number;
    totalShowtimes: number;
    filteredShowtimes: number;
    totalCities: number;
    totalTheatres: number;
}
