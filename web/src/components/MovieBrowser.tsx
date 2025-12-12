'use client';

import { useState } from 'react';
import MovieSidebar from './MovieSidebar';
import CityShowtimes from './CityShowtimes';
import Dashboard from './Dashboard';

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
    is_presale?: boolean;
    schedules?: Record<string, TheaterSchedule[]>;
}

interface MovieBrowserProps {
    movies: Movie[];
}

type ViewMode = 'browser' | 'dashboard';

export default function MovieBrowser({ movies }: MovieBrowserProps) {
    const [selectedMovie, setSelectedMovie] = useState<Movie | null>(null);
    const [viewMode, setViewMode] = useState<ViewMode>('browser');

    return (
        <div className="flex flex-col h-[calc(100vh-5rem)]">
            {/* View Mode Toggle */}
            <div className="flex items-center justify-center gap-2 py-3 bg-black/20 border-b border-white/10">
                <button
                    onClick={() => setViewMode('browser')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${viewMode === 'browser'
                        ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg shadow-purple-500/25'
                        : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white'
                        }`}
                >
                    🎬 Browse Movies
                </button>
                <button
                    onClick={() => setViewMode('dashboard')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${viewMode === 'dashboard'
                        ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg shadow-purple-500/25'
                        : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white'
                        }`}
                >
                    📊 Market Insights
                </button>
            </div>

            {/* Content */}
            {viewMode === 'browser' ? (
                <div className="flex flex-1 overflow-hidden">
                    <MovieSidebar
                        movies={movies}
                        selectedMovie={selectedMovie}
                        onSelectMovie={setSelectedMovie}
                    />
                    <CityShowtimes movie={selectedMovie} allMovies={movies} />
                </div>
            ) : (
                <Dashboard movies={movies} />
            )}
        </div>
    );
}
