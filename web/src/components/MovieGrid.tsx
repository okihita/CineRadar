'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';

interface Movie {
    id: string;
    title: string;
    genres: string[];
    poster: string;
    age_category: string;
    country: string;
    merchants: string[];
    cities: string[];
}

interface MovieGridProps {
    movies: Movie[];
}

const AGE_COLORS: Record<string, string> = {
    'SU': 'bg-green-500',
    'P': 'bg-blue-500',
    'R': 'bg-yellow-500',
    'D': 'bg-red-500',
};

const MERCHANT_COLORS: Record<string, string> = {
    'XXI': 'bg-red-600',
    'CGV': 'bg-amber-500',
    'Cinépolis': 'bg-blue-600',
};

export default function MovieGrid({ movies }: MovieGridProps) {
    const [filteredMovies, setFilteredMovies] = useState(movies);
    const [selectedCity, setSelectedCity] = useState('');
    const [expandedMovie, setExpandedMovie] = useState<string | null>(null);

    useEffect(() => {
        const handleCityFilter = (e: CustomEvent) => {
            const city = e.detail;
            setSelectedCity(city);

            if (city) {
                setFilteredMovies(movies.filter(m => m.cities.includes(city)));
            } else {
                setFilteredMovies(movies);
            }
        };

        window.addEventListener('cityFilter', handleCityFilter as EventListener);
        return () => window.removeEventListener('cityFilter', handleCityFilter as EventListener);
    }, [movies]);

    return (
        <div>
            <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-white">
                    {selectedCity ? `Movies in ${selectedCity}` : 'All Movies'}
                </h2>
                <span className="text-gray-400">{filteredMovies.length} movies</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                {filteredMovies.map((movie) => (
                    <div
                        key={movie.id}
                        className="group relative bg-white/5 rounded-xl overflow-hidden border border-white/10 hover:border-purple-500/50 transition-all duration-300 hover:scale-105 hover:shadow-xl hover:shadow-purple-500/10 cursor-pointer"
                        onClick={() => setExpandedMovie(expandedMovie === movie.id ? null : movie.id)}
                    >
                        {/* Poster */}
                        <div className="aspect-[2/3] relative bg-gradient-to-br from-purple-900/50 to-slate-900">
                            {movie.poster ? (
                                <Image
                                    src={movie.poster}
                                    alt={movie.title}
                                    fill
                                    className="object-cover"
                                    sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 16vw"
                                />
                            ) : (
                                <div className="absolute inset-0 flex items-center justify-center text-4xl">
                                    🎬
                                </div>
                            )}

                            {/* Age Category Badge */}
                            <div className={`absolute top-2 left-2 px-2 py-1 rounded-md text-xs font-bold text-white ${AGE_COLORS[movie.age_category] || 'bg-gray-500'}`}>
                                {movie.age_category}
                            </div>

                            {/* City Count Badge */}
                            <div className="absolute top-2 right-2 px-2 py-1 rounded-md text-xs font-medium bg-black/70 text-white backdrop-blur-sm">
                                {movie.cities.length} cities
                            </div>

                            {/* Merchants */}
                            <div className="absolute bottom-2 left-2 flex gap-1">
                                {movie.merchants.map((merchant) => (
                                    <span
                                        key={merchant}
                                        className={`px-2 py-0.5 rounded text-[10px] font-medium text-white ${MERCHANT_COLORS[merchant] || 'bg-gray-600'}`}
                                    >
                                        {merchant}
                                    </span>
                                ))}
                            </div>
                        </div>

                        {/* Info */}
                        <div className="p-3">
                            <h3 className="text-sm font-semibold text-white line-clamp-2 leading-tight">
                                {movie.title}
                            </h3>
                            <div className="mt-2 flex flex-wrap gap-1">
                                {movie.genres.slice(0, 2).map((genre) => (
                                    <span
                                        key={genre}
                                        className="px-2 py-0.5 bg-white/10 rounded-full text-xs text-gray-300"
                                    >
                                        {genre}
                                    </span>
                                ))}
                            </div>
                            {movie.country && (
                                <p className="mt-2 text-xs text-gray-500">{movie.country}</p>
                            )}
                        </div>

                        {/* Expanded View (Cities) */}
                        {expandedMovie === movie.id && (
                            <div className="absolute inset-0 bg-black/95 p-4 overflow-auto z-10 animate-fadeIn">
                                <button
                                    onClick={(e) => { e.stopPropagation(); setExpandedMovie(null); }}
                                    className="absolute top-2 right-2 p-1 text-gray-400 hover:text-white"
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                                <h4 className="text-white font-bold mb-3 pr-6">{movie.title}</h4>
                                <p className="text-xs text-gray-400 mb-2">Available in {movie.cities.length} cities:</p>
                                <div className="flex flex-wrap gap-1">
                                    {movie.cities.sort().map((city) => (
                                        <span
                                            key={city}
                                            className="px-2 py-1 bg-purple-500/20 border border-purple-500/30 rounded-md text-xs text-purple-300"
                                        >
                                            {city}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {filteredMovies.length === 0 && (
                <div className="text-center py-16">
                    <p className="text-gray-400 text-lg">No movies found for this city</p>
                </div>
            )}
        </div>
    );
}
