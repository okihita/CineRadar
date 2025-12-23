'use client';

import { useState, useEffect } from 'react';
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

// Fetch movie schedule from Firestore
async function fetchMovieSchedule(movieId: string, date: string): Promise<Record<string, TheaterSchedule[]> | null> {
    try {
        const projectId = 'cineradar-481014';
        const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/schedules/${date}/movies/${movieId}`;
        
        const response = await fetch(url);
        if (!response.ok) return null;
        
        const doc = await response.json();
        const fields = doc.fields || {};
        
        // Parse the cities map from Firestore format
        const citiesMap = fields.cities?.mapValue?.fields || {};
        const schedules: Record<string, TheaterSchedule[]> = {};
        
        for (const [city, cityData] of Object.entries(citiesMap)) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const theatersArray = (cityData as any)?.arrayValue?.values || [];
            schedules[city] = theatersArray.map((t: { mapValue?: { fields?: Record<string, unknown> } }) => {
                const tf = t.mapValue?.fields || {};
                return {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    theatre_id: (tf.theatre_id as any)?.stringValue || '',
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    theatre_name: (tf.theatre_name as any)?.stringValue || '',
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    merchant: (tf.merchant as any)?.stringValue || '',
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    address: (tf.address as any)?.stringValue || '',
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    rooms: ((tf.rooms as any)?.arrayValue?.values || []).map((r: { mapValue?: { fields?: Record<string, unknown> } }) => {
                        const rf = r.mapValue?.fields || {};
                        return {
                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                            category: (rf.category as any)?.stringValue || '',
                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                            price: (rf.price as any)?.stringValue || '',
                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                            showtimes: ((rf.showtimes as any)?.arrayValue?.values || []).map((s: { stringValue?: string }) => s.stringValue || ''),
                        };
                    }),
                };
            });
        }
        
        return schedules;
    } catch (error) {
        console.error('Error fetching schedule:', error);
        return null;
    }
}

export default function MovieBrowser({ movies }: MovieBrowserProps) {
    const [selectedMovie, setSelectedMovie] = useState<Movie | null>(null);
    const [movieWithSchedules, setMovieWithSchedules] = useState<Movie | null>(null);
    const [loadingSchedule, setLoadingSchedule] = useState(false);
    const [viewMode, setViewMode] = useState<ViewMode>('browser');

    // Fetch schedules when movie is selected
    useEffect(() => {
        if (!selectedMovie) {
            setMovieWithSchedules(null);
            return;
        }

        // Get today's date in YYYY-MM-DD format
        const today = new Date().toLocaleDateString('en-CA'); // Returns YYYY-MM-DD
        
        setLoadingSchedule(true);
        fetchMovieSchedule(selectedMovie.id, today)
            .then(schedules => {
                if (schedules) {
                    setMovieWithSchedules({ ...selectedMovie, schedules });
                } else {
                    setMovieWithSchedules(selectedMovie);
                }
            })
            .finally(() => setLoadingSchedule(false));
    }, [selectedMovie]);

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
                    {loadingSchedule ? (
                        <div className="flex-1 flex items-center justify-center">
                            <div className="text-center">
                                <div className="animate-spin text-4xl mb-4">🎬</div>
                                <p className="text-gray-400">Loading showtimes...</p>
                            </div>
                        </div>
                    ) : (
                        <CityShowtimes movie={movieWithSchedules} allMovies={movies} />
                    )}
                </div>
            ) : (
                <Dashboard movies={movies} />
            )}
        </div>
    );
}

