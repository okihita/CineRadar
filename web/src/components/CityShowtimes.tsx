'use client';

import { useState, useMemo, useRef } from 'react';
import MovieInsights from './MovieInsights';

interface TheaterSchedule {
    theatre_id: string;
    theatre_name: string;
    merchant: string;
    address: string;
    rooms: {
        category: string;
        price: string;
        showtimes: string[];
        past_showtimes?: string[];
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
    allMovies?: Movie[];
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
            return 'from-amber-500 to-yellow-400 text-black shadow-amber-500/50';
        case 'afternoon':
            return 'from-sky-500 to-blue-500 text-white shadow-blue-500/50';
        case 'evening':
            return 'from-purple-600 to-pink-600 text-white shadow-purple-500/50';
        case 'night':
            return 'from-indigo-800 to-purple-900 text-white shadow-indigo-500/50';
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

// Sparkline component for showtime density
function ShowtimeSparkline({ showtimes }: { showtimes: string[] }) {
    // Count showtimes per hour (10-23)
    const hourCounts = Array(14).fill(0); // Hours 10-23
    showtimes.forEach(time => {
        const hour = parseInt(time.split(':')[0], 10);
        if (hour >= 10 && hour <= 23) {
            hourCounts[hour - 10]++;
        }
    });
    const max = Math.max(...hourCounts, 1);

    return (
        <div className="flex items-end gap-0.5 h-6">
            {hourCounts.map((count, i) => (
                <div
                    key={i}
                    className={`w-1.5 rounded-t transition-all ${count > 0 ? 'bg-gradient-to-t from-purple-500 to-pink-500' : 'bg-white/10'}`}
                    style={{ height: `${(count / max) * 100}%`, minHeight: count > 0 ? '4px' : '2px' }}
                    title={`${i + 10}:00 - ${count} showtimes`}
                />
            ))}
        </div>
    );
}

// Price range extractor
function extractPriceRange(schedules: Record<string, TheaterSchedule[]>): { min: number; max: number } | null {
    const prices: number[] = [];
    Object.values(schedules).forEach(theaters => {
        theaters.forEach(t => {
            t.rooms.forEach(r => {
                // Extract numbers from price string like "Rp50.000 - Rp75.000"
                const matches = r.price.match(/\d+[.,]?\d*/g);
                if (matches) {
                    matches.forEach(m => {
                        const num = parseInt(m.replace(/[.,]/g, ''), 10);
                        if (num > 0) prices.push(num);
                    });
                }
            });
        });
    });
    if (prices.length === 0) return null;
    return { min: Math.min(...prices), max: Math.max(...prices) };
}

// Format price
function formatPrice(price: number): string {
    if (price >= 1000) {
        return `Rp${(price / 1000).toFixed(0)}k`;
    }
    return `Rp${price}`;
}

// Get all showtimes from schedules
function getAllShowtimes(schedules: Record<string, TheaterSchedule[]>): string[] {
    const times: string[] = [];
    Object.values(schedules).forEach(theaters => {
        theaters.forEach(t => {
            t.rooms.forEach(r => {
                times.push(...r.showtimes);
            });
        });
    });
    return times;
}

export default function CityShowtimes({ movie, allMovies = [] }: CityShowtimesProps) {
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

    // Calculate stats
    const stats = useMemo(() => {
        if (!movie?.schedules) return null;
        const priceRange = extractPriceRange(movie.schedules);
        const allShowtimes = getAllShowtimes(movie.schedules);
        const totalTheatres = Object.values(movie.schedules).reduce((acc, t) => acc + t.length, 0);
        return { priceRange, allShowtimes, totalTheatres };
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
            <div className="flex-1 flex items-center justify-center text-gray-500 relative overflow-hidden">
                {/* Film grain overlay */}
                <div className="absolute inset-0 opacity-[0.03] pointer-events-none"
                    style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 256 256\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noise\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'4\' /%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noise)\' /%3E%3C/svg%3E")' }}
                />
                <div className="text-center z-10">
                    <span className="text-6xl block mb-4">🎬</span>
                    <p className="text-xl">Select a movie to view showtimes</p>
                    <p className="text-sm mt-2 text-gray-600">Choose from the playlist on the left</p>
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
        <div className="flex-1 overflow-y-auto relative">
            {/* Hero Background with Blur */}
            <div className="absolute inset-0 overflow-hidden">
                <div
                    className="absolute inset-0 bg-cover bg-center scale-110 blur-2xl opacity-30"
                    style={{ backgroundImage: `url(${movie.poster})` }}
                />
                <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-gray-900/90 to-gray-900" />
            </div>

            {/* Film grain overlay */}
            <div className="absolute inset-0 opacity-[0.02] pointer-events-none z-10"
                style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 256 256\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noise\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.8\' numOctaves=\'4\' /%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noise)\' /%3E%3C/svg%3E")' }}
            />

            {/* Content */}
            <div className="relative z-20 p-6">
                {/* Movie Header - Cinematic Style */}
                <div className="flex items-start gap-6 mb-6">
                    {/* Poster with glow effect */}
                    <div className="relative flex-shrink-0">
                        <div className="absolute inset-0 bg-gradient-to-r from-purple-500 to-pink-500 rounded-xl blur-xl opacity-50 scale-105" />
                        <div className="relative w-36 h-52 rounded-xl overflow-hidden shadow-2xl border-2 border-white/20">
                            <img src={movie.poster} alt={movie.title} className="w-full h-full object-cover" />
                        </div>
                    </div>

                    <div className="flex-1 min-w-0">
                        {/* Title with neon effect */}
                        <h1 className="text-3xl font-bold text-white mb-2 drop-shadow-[0_0_10px_rgba(168,85,247,0.5)]">
                            {movie.title}
                        </h1>

                        <div className="flex flex-wrap gap-2 mb-3">
                            {movie.is_presale && (
                                <span className="px-3 py-1 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-full text-sm font-semibold animate-pulse shadow-lg shadow-orange-500/50">
                                    🎟️ PRE-SALE
                                </span>
                            )}
                            {movie.genres.map((genre) => (
                                <span key={genre} className="px-3 py-1 bg-purple-500/20 text-purple-300 rounded-full text-sm backdrop-blur-sm border border-purple-500/30">
                                    {genre}
                                </span>
                            ))}
                            <span className={`px-3 py-1 rounded-full text-sm font-semibold ${movie.age_category === 'SU' ? 'bg-green-500/20 text-green-400 border border-green-500/30' :
                                movie.age_category === 'R' ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30' :
                                    movie.age_category === 'D' ? 'bg-red-500/20 text-red-400 border border-red-500/30' :
                                        'bg-gray-500/20 text-gray-400 border border-gray-500/30'
                                }`}>
                                {movie.age_category}
                            </span>
                        </div>

                        <p className="text-gray-400 text-sm mb-3">
                            {movie.country} • {movie.merchants.join(' • ')}
                        </p>

                        {/* Quick Stats Bar - Data Rich */}
                        {hasSchedules && stats && (
                            <div className="flex flex-wrap gap-4 items-center p-3 bg-white/5 rounded-lg border border-white/10 backdrop-blur-sm">
                                <div className="flex items-center gap-2">
                                    <span className="text-2xl">🏙️</span>
                                    <div>
                                        <div className="text-lg font-bold text-white">{movie.cities.length}</div>
                                        <div className="text-xs text-gray-500">cities</div>
                                    </div>
                                </div>
                                <div className="w-px h-8 bg-white/20" />
                                <div className="flex items-center gap-2">
                                    <span className="text-2xl">🎭</span>
                                    <div>
                                        <div className="text-lg font-bold text-white">{stats.totalTheatres}</div>
                                        <div className="text-xs text-gray-500">theatres</div>
                                    </div>
                                </div>
                                <div className="w-px h-8 bg-white/20" />
                                <div className="flex items-center gap-2">
                                    <span className="text-2xl">🎬</span>
                                    <div>
                                        <div className="text-lg font-bold text-white">{stats.allShowtimes.length}</div>
                                        <div className="text-xs text-gray-500">showtimes</div>
                                    </div>
                                </div>
                                {stats.priceRange && (
                                    <>
                                        <div className="w-px h-8 bg-white/20" />
                                        <div className="flex items-center gap-2">
                                            <span className="text-2xl">💰</span>
                                            <div>
                                                <div className="text-lg font-bold text-emerald-400">
                                                    {formatPrice(stats.priceRange.min)} - {formatPrice(stats.priceRange.max)}
                                                </div>
                                                <div className="text-xs text-gray-500">price range</div>
                                            </div>
                                        </div>
                                    </>
                                )}
                                <div className="w-px h-8 bg-white/20" />
                                {/* Sparkline */}
                                <div className="flex items-center gap-2">
                                    <div>
                                        <div className="text-xs text-gray-500 mb-1">Showtime density (10am-11pm)</div>
                                        <ShowtimeSparkline showtimes={stats.allShowtimes} />
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Filter Bar */}
                {hasSchedules && (
                    <div className="mb-6 p-4 bg-white/5 rounded-xl border border-white/10 backdrop-blur-sm">
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
                                            ? chain === 'XXI' ? 'bg-blue-500/30 text-blue-300 border border-blue-500/50 shadow-lg shadow-blue-500/20'
                                                : chain === 'CGV' ? 'bg-red-500/30 text-red-300 border border-red-500/50 shadow-lg shadow-red-500/20'
                                                    : chain === 'Cinépolis' ? 'bg-yellow-500/30 text-yellow-300 border border-yellow-500/50 shadow-lg shadow-yellow-500/20'
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

                {/* AI Insights Section */}
                {allMovies.length > 0 && (
                    <MovieInsights movie={movie} allMovies={allMovies} />
                )}

                {/* Cities & Showtimes */}
                {hasSchedules ? (
                    <div className="space-y-4 mt-6">
                        <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                            <span className="text-2xl">🎪</span> Showtimes by City
                        </h2>
                        {cities.map((city) => {
                            const theaters = filterTheaters(movie.schedules![city]);
                            if (theaters.length === 0) return null;

                            // Find best value and most showtimes
                            let bestValueTheatre = '';
                            let mostShowtimesTheatre = '';
                            let lowestPrice = Infinity;
                            let maxShowtimes = 0;

                            theaters.forEach(t => {
                                let theatreShowtimes = 0;
                                t.rooms.forEach(r => {
                                    theatreShowtimes += r.showtimes.length;
                                    const matches = r.price.match(/\d+[.,]?\d*/);
                                    if (matches) {
                                        const price = parseInt(matches[0].replace(/[.,]/g, ''), 10);
                                        if (price < lowestPrice) {
                                            lowestPrice = price;
                                            bestValueTheatre = t.theatre_name;
                                        }
                                    }
                                });
                                if (theatreShowtimes > maxShowtimes) {
                                    maxShowtimes = theatreShowtimes;
                                    mostShowtimesTheatre = t.theatre_name;
                                }
                            });

                            return (
                                <div
                                    key={city}
                                    ref={el => { cityRefs.current[city] = el; }}
                                    className="bg-white/5 rounded-xl overflow-hidden border border-white/10 backdrop-blur-sm hover:border-purple-500/30 transition-all"
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
                                                        <div className="flex-1">
                                                            <div className="flex items-center gap-2 flex-wrap">
                                                                <h4 className="font-medium text-white">{theater.theatre_name}</h4>
                                                                {theater.theatre_name === bestValueTheatre && (
                                                                    <span className="px-2 py-0.5 text-xs bg-emerald-500/20 text-emerald-400 rounded-full border border-emerald-500/30">
                                                                        💰 Best Value
                                                                    </span>
                                                                )}
                                                                {theater.theatre_name === mostShowtimesTheatre && theaters.length > 1 && (
                                                                    <span className="px-2 py-0.5 text-xs bg-purple-500/20 text-purple-400 rounded-full border border-purple-500/30">
                                                                        🎬 Most Showtimes
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <p className="text-xs text-gray-500 mt-0.5">{theater.address}</p>
                                                        </div>
                                                        <span className={`text-xs px-2 py-1 rounded font-semibold ${theater.merchant === 'XXI' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' :
                                                            theater.merchant === 'CGV' ? 'bg-red-500/20 text-red-400 border border-red-500/30' :
                                                                theater.merchant === 'Cinépolis' ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30' :
                                                                    'bg-gray-500/20 text-gray-400 border border-gray-500/30'
                                                            }`}>
                                                            {theater.merchant}
                                                        </span>
                                                    </div>

                                                    <div className="space-y-3">
                                                        {theater.rooms.map((room, idx) => (
                                                            <div key={idx} className="bg-gradient-to-r from-gray-800/50 to-gray-900/50 rounded-lg p-3 border-l-4 border-purple-500">
                                                                <div className="flex items-center justify-between mb-2">
                                                                    <span className="text-sm font-medium text-gray-300">{room.category}</span>
                                                                    <span className="text-sm font-bold text-emerald-400">{room.price}</span>
                                                                </div>
                                                                <div className="flex flex-wrap gap-2">
                                                                    {/* Past showtimes (grayed out) */}
                                                                    {room.past_showtimes?.map((time: string, timeIdx: number) => (
                                                                        <span
                                                                            key={`past-${timeIdx}`}
                                                                            className="px-3 py-1.5 text-sm rounded-lg font-medium 
                                                                                bg-gray-700/30 text-gray-500 line-through cursor-not-allowed"
                                                                            title="Past showtime"
                                                                        >
                                                                            {time}
                                                                        </span>
                                                                    ))}
                                                                    {/* Available showtimes */}
                                                                    {room.showtimes?.map((time: string, timeIdx: number) => (
                                                                        <span
                                                                            key={timeIdx}
                                                                            className={`px-3 py-1.5 text-sm rounded-lg font-medium cursor-pointer transition-all 
                                                                                bg-gradient-to-r ${getTimeStyle(time)} 
                                                                                hover:scale-105 hover:shadow-lg shadow-md`}
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
                    <div className="bg-white/5 rounded-xl p-8 text-center border border-white/10 backdrop-blur-sm mt-6">
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
        </div>
    );
}
