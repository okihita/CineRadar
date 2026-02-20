export interface Showtime {
    time: string;
    status: number;
    is_available: boolean;
    showtime_id: string;
}

export interface Room {
    category: string;
    price: string;
    showtimes: string[];          // Available time strings
    all_showtimes: Showtime[];    // All times with status
    past_showtimes: string[];     // Past/unavailable time strings
}

export interface TheatreSchedule {
    theatre_id: string;
    theatre_name: string;
    merchant: string;
    address: string;
    rooms: Room[];
}

export interface CitySchedule {
    [cityName: string]: TheatreSchedule[];
}

export interface MovieSchedule {
    movie_id: string;
    title: string;
    poster: string;
    genres: string[];
    age_category: string;
    merchants: string[];
    is_presale: boolean;
    date: string;
    uploaded_at: string;
    cities: CitySchedule;
}

export interface ScheduleResponse {
    success: boolean;
    date: string;
    count: number;
    movies: MovieSchedule[];
    error?: string;
}

// Helper: count all showtimes across all rooms in a theatre
export function countTheatreShowtimes(theatre: TheatreSchedule): number {
    return (theatre.rooms || []).reduce(
        (sum, room) => sum + (room.all_showtimes?.length || 0),
        0
    );
}

// Helper: count all showtimes across all theatres in all cities
export function countMovieShowtimes(cities: CitySchedule): number {
    let total = 0;
    for (const theatres of Object.values(cities)) {
        for (const theatre of theatres) {
            total += countTheatreShowtimes(theatre);
        }
    }
    return total;
}

// Helper: count only available showtimes across all theatres in all cities
export function countAvailableMovieShowtimes(cities: CitySchedule): number {
    let total = 0;
    for (const theatres of Object.values(cities)) {
        for (const theatre of theatres) {
            total += (theatre.rooms || []).reduce((sum, room) => {
                const availableCount = (room.all_showtimes || []).filter(s => s.is_available).length;
                return sum + availableCount;
            }, 0);
        }
    }
    return total;
}
