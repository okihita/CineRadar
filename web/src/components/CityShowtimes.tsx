
import { useState, useMemo, useRef } from 'react';
import Image from 'next/image';
import { AdmissionStats } from './MovieBrowser';
import MovieInsights from './MovieInsights';
import ShowtimeSparkline from './showtimes/ShowtimeSparkline';
import TheaterCard from './showtimes/TheaterCard';
import CityShowtimesFilters from './showtimes/CityShowtimesFilters';
import { TheaterSchedule, extractPriceRange, formatPrice, getAllShowtimes } from '@/lib/showtime-utils';

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
    admissionStats?: AdmissionStats;
}

interface CityShowtimesProps {
    movie: Movie | null;
    allMovies?: Movie[];
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
                {/* Header Content */}
                <div className="flex flex-col md:flex-row gap-8 relative z-10">
                    {/* Poster Card */}
                    <div className="md:w-64 flex-shrink-0 group perspective-1000">
                        <div className="relative aspect-[2/3] rounded-2xl overflow-hidden shadow-2xl transition-transform duration-500 group-hover:rotate-y-12 bg-black/50 border border-white/10 ring-1 ring-white/5 backdrop-blur-sm">
                            {movie.poster ? (
                                <Image
                                    src={movie.poster}
                                    alt={movie.title}
                                    fill
                                    className="object-cover transition-transform duration-700 group-hover:scale-110"
                                    sizes="(max-width: 768px) 100vw, 256px"
                                />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center bg-white/5">
                                    <span className="text-4xl">🎬</span>
                                </div>
                            )}
                            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent opacity-60 group-hover:opacity-40 transition-opacity" />

                            {/* Admission Badge on Poster */}
                            {movie.admissionStats && (
                                <div className="absolute top-3 right-3 bg-black/60 backdrop-blur-md border border-white/10 rounded-lg px-2 py-1.5 flex flex-col items-center shadow-xl">
                                    <span className="text-[10px] uppercase tracking-wider text-green-400 font-bold mb-0.5">Admissions</span>
                                    <span className="text-base font-bold text-white leading-none">
                                        {(movie.admissionStats.total_admissions || 0).toLocaleString()}
                                    </span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Info */}
                    <div className="flex-1 pt-2">
                        <div className="flex flex-wrap items-center gap-3 mb-4">
                            {movie.is_presale && (
                                <span className="px-3 py-1 text-xs font-bold tracking-wider text-yellow-300 bg-yellow-500/10 border border-yellow-500/20 rounded-full animate-pulse shadow-[0_0_15px_rgba(234,179,8,0.2)]">
                                    PRESALE ACTIVE
                                </span>
                            )}
                            {movie.age_category && (
                                <span className="px-3 py-1 text-xs font-bold text-white bg-white/10 border border-white/10 rounded-full backdrop-blur-sm">
                                    {movie.age_category}
                                </span>
                            )}
                            <span className="px-3 py-1 text-xs font-medium text-gray-300 bg-black/20 border border-white/5 rounded-full">
                                {movie.country || 'International'}
                            </span>
                        </div>

                        <div className="flex justify-between items-start">
                            <h1 className="text-4xl md:text-5xl lg:text-6xl font-black text-transparent bg-clip-text bg-gradient-to-br from-white via-white to-white/70 tracking-tight mb-2 leading-none drop-shadow-2xl">
                                {movie.title}
                            </h1>

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
                        <CityShowtimesFilters
                            cities={cities}
                            selectedCity={selectedCity}
                            onCityJump={handleCityJump}
                            availableChains={availableChains}
                            isChainEnabled={isChainEnabled}
                            toggleChain={toggleChain}
                        />
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
                                                    <TheaterCard
                                                        key={theater.theatre_id || theater.theatre_name}
                                                        theater={theater}
                                                        isBestValue={theater.theatre_name === bestValueTheatre}
                                                        isMostShowtimes={theater.theatre_name === mostShowtimesTheatre}
                                                        showMostShowtimesBadge={theaters.length > 1}
                                                    />
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
        </div>
    );
}
