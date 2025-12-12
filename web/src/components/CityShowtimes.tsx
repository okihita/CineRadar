'use client';

import { useState, useMemo, useRef } from 'react';

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

interface CityShowtimesProps {
    movie: Movie | null;
}

// Time-of-day helper
function getTimeOfDay(time: string): 'morning' | 'afternoon' | 'evening' | 'night' {
    const hour = parseInt(time.split(':')[0], 10);
    if (hour < 12) return 'morning';
    if (hour < 17) return 'afternoon';
    if (hour < 21) return 'evening';
    return 'night';
}

function getTimeStyle(time: string): string {
    const period = getTimeOfDay(time);
    switch (period) {
        case 'morning':
            return 'bg-gradient-to-r from-amber-500 to-yellow-400 text-black';
        case 'afternoon':
            return 'bg-gradient-to-r from-sky-500 to-blue-500 text-white';
        case 'evening':
            return 'bg-gradient-to-r from-purple-600 to-pink-600 text-white';
        case 'night':
            return 'bg-gradient-to-r from-indigo-800 to-purple-900 text-white';
    }
}

function getTimeIcon(time: string): string {
    const period = getTimeOfDay(time);
    switch (period) {
        case 'morning': return '🌅';
        case 'afternoon': return '☀️';
        case 'evening': return '🌆';
        case 'night': return '🌙';
    }
}

export default function CityShowtimes({ movie }: CityShowtimesProps) {
    const [expandedCity, setExpandedCity] = useState<string | null>(null);
    const [disabledChains, setDisabledChains] = useState<Set<string>>(new Set());
    const [selectedCity, setSelectedCity] = useState<string>('');
    const cityRefs = useRef<Record<string, HTMLDivElement | null>>({});

    // Get unique chains from current movie
    const availableChains = useMemo(() => {
        if (!movie?.schedules) return [];
        const chains = new Set<string>();
        Object.values(movie.schedules).forEach(theaters => {
            theaters.forEach(t => chains.add(t.merchant));
        });
        return Array.from(chains).sort();
    }, [movie]);

    // Handle city quick-jump
    const handleCityJump = (city: string) => {
        setSelectedCity(city);
        setExpandedCity(city);
        setTimeout(() => {
            cityRefs.current[city]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 100);
    };

    // Toggle chain filter
    const toggleChain = (chain: string) => {
        setDisabledChains(prev => {
            const next = new Set(prev);
            if (next.has(chain)) {
                next.delete(chain);
            } else {
                next.add(chain);
            }
            return next;
        });
    };

    // Check if chain is enabled
    const isChainEnabled = (chain: string) => !disabledChains.has(chain);

    if (!movie) {
        return (
            <div className="flex-1 flex items-center justify-center text-gray-500">
                <div className="text-center">
                    <span className="text-6xl block mb-4">🎬</span>
                    <p className="text-xl">Select a movie to view showtimes</p>
                    <p className="text-sm mt-2">Choose from the playlist on the left</p>
                </div>
            </div>
        );
    }

    const hasSchedules = movie.schedules && Object.keys(movie.schedules).length > 0;
    const cities = hasSchedules ? Object.keys(movie.schedules!).sort() : [];

    // Filter theaters by selected chains
    const filterTheaters = (theaters: TheaterSchedule[]) => {
        return theaters.filter(t => isChainEnabled(t.merchant));
    };

    return (
        <div className="flex-1 overflow-y-auto p-6">
            {/* Movie Header */}
            <div className="flex items-start gap-6 mb-6">
                <div className="relative w-32 h-48 rounded-xl overflow-hidden shadow-2xl flex-shrink-0">
                    <img src={movie.poster} alt={movie.title} className="w-full h-full object-cover" />
                </div>
                <div className="flex-1">
                    <h1 className="text-3xl font-bold text-white mb-2">{movie.title}</h1>
                    <div className="flex flex-wrap gap-2 mb-3">
                        {movie.is_presale && (
                            <span className="px-3 py-1 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-full text-sm font-semibold animate-pulse">
                                🎟️ PRE-SALE
                            </span>
                        )}
                        {movie.genres.map((genre) => (
                            <span key={genre} className="px-3 py-1 bg-purple-500/20 text-purple-300 rounded-full text-sm">
                                {genre}
                            </span>
                        ))}
                        <span className={`px-3 py-1 rounded-full text-sm ${movie.age_category === 'SU' ? 'bg-green-500/20 text-green-400' :
                            movie.age_category === 'R' ? 'bg-yellow-500/20 text-yellow-400' :
                                movie.age_category === 'D' ? 'bg-red-500/20 text-red-400' :
                                    'bg-gray-500/20 text-gray-400'
                            }`}>
                            {movie.age_category}
                        </span>
                    </div>
                    <p className="text-gray-400 text-sm mb-2">
                        {movie.country} • {movie.merchants.join(', ')}
                    </p>
                    <div className="flex gap-4 text-sm">
                        <span className="text-gray-300">
                            <span className="text-white font-semibold">{movie.cities.length}</span> cities
                        </span>
                        {hasSchedules && (
                            <span className="text-gray-300">
                                <span className="text-white font-semibold">
                                    {Object.values(movie.schedules!).reduce((acc, theaters) => acc + theaters.length, 0)}
                                </span> theatres total
                            </span>
                        )}
                    </div>
                </div>
            </div>

            {/* Filter Bar */}
            {hasSchedules && (
                <div className="mb-6 p-4 bg-white/5 rounded-xl border border-white/10">
                    <div className="flex flex-wrap items-center gap-4">
                        {/* City Quick Jump */}
                        <div className="flex items-center gap-2">
                            <span className="text-sm text-gray-400">🏙️ Jump to:</span>
                            <select
                                value={selectedCity}
                                onChange={(e) => handleCityJump(e.target.value)}
                                className="bg-white/10 border border-white/20 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                            >
                                <option value="" className="bg-gray-900">Select city...</option>
                                {cities.map(city => (
                                    <option key={city} value={city} className="bg-gray-900">{city}</option>
                                ))}
                            </select>
                        </div>

                        {/* Divider */}
                        <div className="h-6 w-px bg-white/20" />

                        {/* Chain Filters */}
                        <div className="flex items-center gap-2">
                            <span className="text-sm text-gray-400">🎬 Chains:</span>
                            {availableChains.map(chain => (
                                <button
                                    key={chain}
                                    onClick={() => toggleChain(chain)}
                                    className={`px-3 py-1 text-xs rounded-full transition-all ${isChainEnabled(chain)
                                        ? chain === 'XXI' ? 'bg-blue-500/30 text-blue-300 border border-blue-500/50'
                                            : chain === 'CGV' ? 'bg-red-500/30 text-red-300 border border-red-500/50'
                                                : chain === 'Cinépolis' ? 'bg-yellow-500/30 text-yellow-300 border border-yellow-500/50'
                                                    : 'bg-gray-500/30 text-gray-300 border border-gray-500/50'
                                        : 'bg-white/5 text-gray-500 border border-white/10 line-through'
                                        }`}
                                >
                                    {chain}
                                </button>
                            ))}
                        </div>

                        {/* Divider */}
                        <div className="h-6 w-px bg-white/20" />

                        {/* Time Legend */}
                        <div className="flex items-center gap-2 text-xs text-gray-400">
                            <span>🌅 Morning</span>
                            <span>☀️ Afternoon</span>
                            <span>🌆 Evening</span>
                            <span>🌙 Night</span>
                        </div>
                    </div>
                </div>
            )}

            {/* Cities & Showtimes */}
            {hasSchedules ? (
                <div className="space-y-4">
                    <h2 className="text-xl font-semibold text-white mb-4">Showtimes by City</h2>
                    {cities.map((city) => {
                        const theaters = filterTheaters(movie.schedules![city]);
                        if (theaters.length === 0) return null;

                        return (
                            <div
                                key={city}
                                ref={el => { cityRefs.current[city] = el; }}
                                className="bg-white/5 rounded-xl overflow-hidden border border-white/10"
                            >
                                <button
                                    onClick={() => setExpandedCity(expandedCity === city ? null : city)}
                                    className="w-full flex items-center justify-between p-4 hover:bg-white/5 transition-colors"
                                >
                                    <div className="flex items-center gap-3">
                                        <span className="text-2xl">🏙️</span>
                                        <div className="text-left">
                                            <h3 className="text-lg font-semibold text-white">{city}</h3>
                                            <p className="text-sm text-gray-400">{theaters.length} theatre{theaters.length > 1 ? 's' : ''}</p>
                                        </div>
                                    </div>
                                    <span className={`text-gray-400 transition-transform ${expandedCity === city ? 'rotate-180' : ''}`}>
                                        ▼
                                    </span>
                                </button>

                                {expandedCity === city && (
                                    <div className="border-t border-white/10 divide-y divide-white/5">
                                        {theaters.map((theater) => (
                                            <div key={theater.theatre_id || theater.theatre_name} className="p-4">
                                                <div className="flex items-start justify-between mb-3">
                                                    <div>
                                                        <h4 className="font-medium text-white">{theater.theatre_name}</h4>
                                                        <p className="text-xs text-gray-500 mt-0.5">{theater.address}</p>
                                                    </div>
                                                    <span className={`text-xs px-2 py-1 rounded ${theater.merchant === 'XXI' ? 'bg-blue-500/20 text-blue-400' :
                                                        theater.merchant === 'CGV' ? 'bg-red-500/20 text-red-400' :
                                                            theater.merchant === 'Cinépolis' ? 'bg-yellow-500/20 text-yellow-400' :
                                                                'bg-gray-500/20 text-gray-400'
                                                        }`}>
                                                        {theater.merchant}
                                                    </span>
                                                </div>

                                                {/* Room Categories */}
                                                <div className="space-y-3">
                                                    {theater.rooms.map((room, idx) => (
                                                        <div key={idx} className="bg-black/20 rounded-lg p-3">
                                                            <div className="flex items-center justify-between mb-2">
                                                                <span className="text-sm font-medium text-gray-300">{room.category}</span>
                                                                <span className="text-sm text-emerald-400">{room.price}</span>
                                                            </div>
                                                            <div className="flex flex-wrap gap-2">
                                                                {room.showtimes.map((time, timeIdx) => (
                                                                    <span
                                                                        key={timeIdx}
                                                                        className={`px-3 py-1.5 text-sm rounded-lg font-medium cursor-pointer transition-all hover:scale-105 hover:shadow-lg ${getTimeStyle(time)}`}
                                                                        title={`${getTimeIcon(time)} ${getTimeOfDay(time)}`}
                                                                    >
                                                                        {time}
                                                                    </span>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            ) : (
                <div className="bg-white/5 rounded-xl p-8 text-center border border-white/10">
                    <span className="text-4xl block mb-4">📍</span>
                    <h3 className="text-lg font-medium text-white mb-2">Available in {movie.cities.length} cities</h3>
                    <div className="flex flex-wrap justify-center gap-2 mt-4">
                        {movie.cities.slice(0, 20).map((city) => (
                            <span key={city} className="px-3 py-1 bg-white/10 text-gray-300 rounded-full text-sm">
                                {city}
                            </span>
                        ))}
                        {movie.cities.length > 20 && (
                            <span className="px-3 py-1 bg-white/10 text-gray-400 rounded-full text-sm">
                                +{movie.cities.length - 20} more
                            </span>
                        )}
                    </div>
                    <p className="text-gray-500 text-sm mt-4">
                        Run scraper with --schedules flag to get detailed showtimes
                    </p>
                </div>
            )}
        </div>
    );
}
