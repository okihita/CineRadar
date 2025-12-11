'use client';

import { useState } from 'react';
import MovieSidebar from './MovieSidebar';
import CityShowtimes from './CityShowtimes';

interface TheaterSchedule {
    theatre_id: string;
    theatre_name: string;
    merchant: string;
    address: string;
    rooms: {
        category: string;
        price: string;
        showtimes: string[];
    }[];
}

interface Movie {
    id: string;
    title: string;
    genres: string[];
    poster: string;
    age_category: string;
    country: string;
    merchants: string[];
    cities: string[];
    schedules?: Record<string, TheaterSchedule[]>;
}

interface MovieBrowserProps {
    movies: Movie[];
}

export default function MovieBrowser({ movies }: MovieBrowserProps) {
    const [selectedMovie, setSelectedMovie] = useState<Movie | null>(movies[0] || null);

    return (
        <div className="flex h-[calc(100vh-80px)]">
            {/* Left Sidebar - Movie Playlist */}
            <MovieSidebar
                movies={movies}
                selectedMovie={selectedMovie}
                onSelectMovie={setSelectedMovie}
            />

            {/* Right Content - City Showtimes */}
            <CityShowtimes movie={selectedMovie} />
        </div>
    );
}
