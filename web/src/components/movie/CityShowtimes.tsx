
'use client';

import { useState, useMemo, useRef } from 'react';
import Image from 'next/image';
import { MapPin, Building2, Film, Banknote, Ticket, Activity, Sparkles, Globe, ChevronDown, Flame, Clock } from 'lucide-react';
import { AdmissionStats } from './MovieBrowser';
import MovieInsights from './MovieInsights';
import ShowtimeSparkline from '../showtimes/ShowtimeSparkline';
import TheaterCard from '../showtimes/TheaterCard';
import CityShowtimesFilters from '../showtimes/CityShowtimesFilters';
import { extractPriceRange, formatPrice, getAllShowtimes } from '@/lib/showtime-utils';
import { TheaterSchedule } from '@/types';
import { CHAIN_COLORS, ChainName } from '@/lib/constants';

interface Movie {
    id: string;
    title: string;
    genres?: string[];
    poster?: string;
    age_category?: string;
    country?: string;
    merchants?: string[];
    cities?: string[];
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
        if (!movie?.schedules) return movie?.merchants || [];
        const chains = new Set<string>();
        Object.values(movie.schedules).forEach(theaters => {
            (theaters || []).forEach(t => {
                if (t.merchant) chains.add(t.merchant);
            });
        });
        return Array.from(chains).sort();
    }, [movie]);

    // Calculate stats
    const stats = useMemo(() => {
        if (!movie?.schedules) return null;
        const priceRange = extractPriceRange(movie.schedules);
        const allShowtimes = getAllShowtimes(movie.schedules);
        const totalTheatres = Object.values(movie.schedules).reduce((acc, t) => acc + (t?.length || 0), 0);
        return { priceRange, allShowtimes, totalTheatres };
    }, [movie]);

    // Handle city quick-jump
    const handleCityJump = (city: string) => {
        setSelectedCity(city);
        if (city) {
            setExpandedCity(city);
            setTimeout(() => {
                cityRefs.current[city]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }, 100);
        }
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
            <div className="flex-1 flex items-center justify-center text-gray-500 relative overflow-hidden min-h-[400px]">
                {/* Film grain overlay */}
                <div
                    className="absolute inset-0 opacity-[0.03] pointer-events-none"
                    style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 256 256\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noise\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'4\' /%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noise)\' /%3E%3C/svg%3E")' }}
                />
                <div className="text-center z-10 p-8 max-w-sm">
                    <div className="w-16 h-16 rounded-2xl bg-white/[0.04] border border-white/10 flex items-center justify-center mx-auto mb-4 text-3xl shadow-xl">
                        🎬
                    </div>
                    <h3 className="text-lg font-bold text-white mb-1">Select a Movie</h3>
                    <p className="text-sm text-gray-400">Choose a title from the catalog on the left to view detailed showtimes and pricing telemetry.</p>
                </div>
            </div>
        );
    }

    const hasSchedules = Boolean(movie.schedules && Object.keys(movie.schedules).length > 0);
    const cities = hasSchedules ? Object.keys(movie.schedules!).sort() : (movie.cities || []);
    const genres = movie.genres || [];
    const merchants = movie.merchants || [];

    // Filter theaters by selected chains
    const filterTheaters = (theaters: TheaterSchedule[] = []) => {
        return theaters.filter(t => isChainEnabled(t.merchant));
    };

    return (
        <div className="flex-1 overflow-y-auto relative bg-gray-950">
            {/* Hero Background with Dynamic Blur & Multi-layer Vignette */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                {movie.poster && (
                    <div
                        className="absolute inset-0 bg-cover bg-center scale-125 blur-3xl opacity-20 transition-all duration-700"
                        style={{ backgroundImage: `url("${movie.poster}")` }}
                    />
                )}
                <div className="absolute inset-0 bg-gradient-to-b from-black/80 via-gray-950/90 to-gray-950" />
                <div className="absolute top-0 left-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />
            </div>

            {/* Film grain overlay */}
            <div
                className="absolute inset-0 opacity-[0.025] pointer-events-none z-10"
                style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 256 256\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noise\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.8\' numOctaves=\'4\' /%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noise)\' /%3E%3C/svg%3E")' }}
            />

            {/* Main Content Area */}
            <div className="relative z-20 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
                {/* Hero Section Container */}
                <div className="flex flex-col lg:flex-row gap-6 lg:gap-8 items-start relative z-10 mb-8">
                    {/* Poster Showcase */}
                    <div className="w-44 sm:w-52 md:w-60 lg:w-72 max-w-[280px] mx-auto lg:mx-0 flex-shrink-0 group">
                        <div className="relative aspect-[2/3] rounded-2xl overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.85)] transition-all duration-500 group-hover:scale-[1.02] bg-black/60 border border-white/10 ring-1 ring-white/10 backdrop-blur-md">
                            {movie.poster ? (
                                <Image
                                    src={movie.poster}
                                    alt={movie.title}
                                    fill
                                    className="object-cover transition-transform duration-700 group-hover:scale-105"
                                    sizes="(max-width: 640px) 176px, (max-width: 768px) 208px, (max-width: 1024px) 240px, 288px"
                                    priority
                                />
                            ) : (
                                <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-white/5 to-white/[0.02] text-gray-400 p-4 text-center">
                                    <Film className="w-12 h-12 mb-2 opacity-50" />
                                    <span className="text-xs font-semibold uppercase tracking-wider">{movie.title.slice(0, 20)}</span>
                                </div>
                            )}

                            {/* Gradient Vignette over poster */}
                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-60 group-hover:opacity-40 transition-opacity pointer-events-none" />

                            {/* Admission Metric Badge on Poster */}
                            {movie.admissionStats && movie.admissionStats.total_admissions > 0 && (
                                <div className="absolute top-3 right-3 bg-gray-950/80 backdrop-blur-md border border-emerald-500/30 rounded-xl px-2.5 py-1.5 flex items-center gap-2 shadow-2xl">
                                    <Flame className="w-4 h-4 text-emerald-400 animate-pulse" />
                                    <div className="flex flex-col items-start leading-none">
                                        <span className="text-[8px] uppercase tracking-widest text-emerald-400 font-bold mb-0.5">Admissions</span>
                                        <span className="text-xs sm:text-sm font-extrabold text-white">
                                            {movie.admissionStats.total_admissions.toLocaleString()}
                                        </span>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Title & Metadata Info Container */}
                    <div className="flex-1 min-w-0 w-full flex flex-col justify-between pt-1">
                        <div>
                            {/* Badges & Tags Row */}
                            <div className="flex flex-wrap items-center gap-2 mb-3">
                                {movie.is_presale ? (
                                    <span className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-bold tracking-wider text-amber-300 bg-amber-500/15 border border-amber-500/30 rounded-full shadow-[0_0_15px_rgba(245,158,11,0.2)]">
                                        <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                                        PRESALE ACTIVE
                                    </span>
                                ) : hasSchedules ? (
                                    <span className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-bold tracking-wider text-emerald-300 bg-emerald-500/15 border border-emerald-500/30 rounded-full shadow-[0_0_15px_rgba(16,185,129,0.15)]">
                                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping inline-block" />
                                        NOW SHOWING
                                    </span>
                                ) : (
                                    <span className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-bold tracking-wider text-sky-300 bg-sky-500/15 border border-sky-500/30 rounded-full">
                                        <Clock className="w-3.5 h-3.5 text-sky-300" />
                                        SCHEDULE PENDING
                                    </span>
                                )}

                                {movie.age_category && (
                                    <span className="px-2.5 py-1 text-xs font-bold text-white bg-white/10 border border-white/15 rounded-full backdrop-blur-sm shadow-sm">
                                        {movie.age_category}
                                    </span>
                                )}

                                {movie.country && (
                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-gray-300 bg-white/5 border border-white/10 rounded-full">
                                        <Globe className="w-3.5 h-3.5 text-gray-400" />
                                        {movie.country}
                                    </span>
                                )}

                                {genres.length > 0 && genres.slice(0, 3).map((genre) => (
                                    <span
                                        key={genre}
                                        className="px-2.5 py-1 text-xs font-medium text-gray-300 bg-white/[0.04] border border-white/10 rounded-full hover:bg-white/[0.08] transition-colors"
                                    >
                                        {genre}
                                    </span>
                                ))}
                            </div>

                            {/* Movie Title - Responsive, Elegant, Never Compressed */}
                            <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl xl:text-6xl font-black text-white tracking-tight leading-[1.12] break-words drop-shadow-lg mb-4">
                                {movie.title}
                            </h1>

                            {/* Cinema Chains Available */}
                            <div className="flex flex-wrap items-center gap-2 mb-6">
                                <span className="text-xs text-gray-400 font-semibold uppercase tracking-wider mr-1">Available at:</span>
                                {merchants.length > 0 ? (
                                    merchants.map((merchant) => {
                                        const color = CHAIN_COLORS[merchant as ChainName] || '#9CA3AF';
                                        return (
                                            <span
                                                key={merchant}
                                                className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold rounded-lg border backdrop-blur-sm shadow-sm transition-all duration-200"
                                                style={{
                                                    borderColor: `${color}40`,
                                                    backgroundColor: `${color}15`,
                                                    color: '#ffffff',
                                                }}
                                            >
                                                <span
                                                    className="w-2 h-2 rounded-full"
                                                    style={{ backgroundColor: color }}
                                                />
                                                {merchant}
                                            </span>
                                        );
                                    })
                                ) : (
                                    <span className="text-xs text-gray-500 italic">Major cinema networks</span>
                                )}
                            </div>
                        </div>

                        {/* Quick Stats Grid - Full Width, Responsive, Resilient Glassmorphic Design */}
                        {hasSchedules && stats ? (
                            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-2.5 sm:gap-3 p-3.5 sm:p-4 bg-white/[0.03] rounded-2xl border border-white/10 backdrop-blur-md shadow-xl w-full">
                                {/* Cities */}
                                <div className="flex items-center gap-3 p-2.5 rounded-xl bg-white/[0.02] hover:bg-white/[0.05] transition-colors border border-transparent hover:border-white/5">
                                    <div className="p-2 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex-shrink-0">
                                        <MapPin className="w-4 h-4 sm:w-5 sm:h-5" />
                                    </div>
                                    <div className="min-w-0">
                                        <div className="text-lg sm:text-xl font-bold text-white tracking-tight truncate">
                                            {cities.length}
                                        </div>
                                        <div className="text-[10px] sm:text-[11px] uppercase tracking-wider text-gray-400 font-semibold truncate">
                                            Cities
                                        </div>
                                    </div>
                                </div>

                                {/* Theatres */}
                                <div className="flex items-center gap-3 p-2.5 rounded-xl bg-white/[0.02] hover:bg-white/[0.05] transition-colors border border-transparent hover:border-white/5">
                                    <div className="p-2 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400 flex-shrink-0">
                                        <Building2 className="w-4 h-4 sm:w-5 sm:h-5" />
                                    </div>
                                    <div className="min-w-0">
                                        <div className="text-lg sm:text-xl font-bold text-white tracking-tight truncate">
                                            {stats.totalTheatres.toLocaleString()}
                                        </div>
                                        <div className="text-[10px] sm:text-[11px] uppercase tracking-wider text-gray-400 font-semibold truncate">
                                            Theatres
                                        </div>
                                    </div>
                                </div>

                                {/* Daily Showtimes */}
                                <div className="flex items-center gap-3 p-2.5 rounded-xl bg-white/[0.02] hover:bg-white/[0.05] transition-colors border border-transparent hover:border-white/5">
                                    <div className="p-2 rounded-xl bg-pink-500/10 border border-pink-500/20 text-pink-400 flex-shrink-0">
                                        <Film className="w-4 h-4 sm:w-5 sm:h-5" />
                                    </div>
                                    <div className="min-w-0">
                                        <div className="text-lg sm:text-xl font-bold text-white tracking-tight truncate">
                                            {stats.allShowtimes.length.toLocaleString()}
                                        </div>
                                        <div className="text-[10px] sm:text-[11px] uppercase tracking-wider text-gray-400 font-semibold truncate">
                                            Showtimes
                                        </div>
                                    </div>
                                </div>

                                {/* Ticket Price Range */}
                                <div className="flex items-center gap-3 p-2.5 rounded-xl bg-white/[0.02] hover:bg-white/[0.05] transition-colors border border-transparent hover:border-white/5">
                                    <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex-shrink-0">
                                        <Banknote className="w-4 h-4 sm:w-5 sm:h-5" />
                                    </div>
                                    <div className="min-w-0">
                                        <div className="text-sm sm:text-base lg:text-lg font-bold text-emerald-400 tracking-tight truncate">
                                            {stats.priceRange
                                                ? `${formatPrice(stats.priceRange.min)} – ${formatPrice(stats.priceRange.max)}`
                                                : 'N/A'}
                                        </div>
                                        <div className="text-[10px] sm:text-[11px] uppercase tracking-wider text-gray-400 font-semibold truncate">
                                            Price Range
                                        </div>
                                    </div>
                                </div>

                                {/* Density Sparkline */}
                                <div className="col-span-2 sm:col-span-4 lg:col-span-1 flex flex-col justify-center p-2.5 rounded-xl bg-white/[0.02] border-t sm:border-t-0 sm:border-l border-white/5 lg:pl-3">
                                    <div className="flex items-center justify-between text-[10px] sm:text-[11px] uppercase tracking-wider text-gray-400 font-semibold mb-1">
                                        <span className="flex items-center gap-1 text-purple-300">
                                            <Activity className="w-3.5 h-3.5 text-purple-400" />
                                            <span>Density</span>
                                        </span>
                                        <span className="text-[9px] font-mono text-gray-500">10:00–23:00</span>
                                    </div>
                                    <ShowtimeSparkline showtimes={stats.allShowtimes} />
                                </div>
                            </div>
                        ) : (
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-4 bg-white/[0.03] rounded-2xl border border-white/10 backdrop-blur-md shadow-xl w-full">
                                <div className="flex items-center gap-3 p-2.5 rounded-xl bg-white/[0.02]">
                                    <div className="p-2 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400">
                                        <MapPin className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <div className="text-xl font-bold text-white">{cities.length}</div>
                                        <div className="text-[11px] uppercase tracking-wider text-gray-400 font-semibold">Cities Planned</div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3 p-2.5 rounded-xl bg-white/[0.02]">
                                    <div className="p-2 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400">
                                        <Building2 className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <div className="text-xl font-bold text-white">{merchants.length}</div>
                                        <div className="text-[11px] uppercase tracking-wider text-gray-400 font-semibold">Exhibitor Networks</div>
                                    </div>
                                </div>
                                <div className="col-span-2 sm:col-span-1 flex items-center gap-3 p-2.5 rounded-xl bg-white/[0.02]">
                                    <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
                                        <Clock className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <div className="text-sm font-bold text-amber-300">Sync Pending</div>
                                        <div className="text-[11px] uppercase tracking-wider text-gray-400 font-semibold">Timetable Status</div>
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

                {/* AI Intelligence Insights Section */}
                {allMovies.length > 0 && (
                    <MovieInsights movie={movie} allMovies={allMovies} />
                )}

                {/* Cities & Showtimes Section */}
                {hasSchedules ? (
                    <div className="space-y-3.5 mt-6">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2 tracking-tight">
                                <Ticket className="w-5 h-5 text-purple-400" />
                                <span>Showtimes by City</span>
                            </h2>
                            <span className="text-xs text-gray-400">
                                {cities.length} {cities.length === 1 ? 'City' : 'Cities'} available
                            </span>
                        </div>

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
                                (t.rooms || []).forEach(r => {
                                    theatreShowtimes += (r.showtimes || []).length;
                                    const matches = r.price.match(/\d+[.,]?\d*/);
                                    if (matches) {
                                        const price = parseInt(matches[0].replace(/[.,]/g, ''), 10);
                                        if (price > 0 && price < lowestPrice) {
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

                            const isExpanded = expandedCity === city;

                            return (
                                <div
                                    key={city}
                                    ref={el => { cityRefs.current[city] = el; }}
                                    className="bg-white/[0.03] rounded-2xl overflow-hidden border border-white/10 backdrop-blur-sm hover:border-purple-500/30 transition-all shadow-md"
                                >
                                    <button
                                        onClick={() => setExpandedCity(isExpanded ? null : city)}
                                        className="w-full flex items-center justify-between p-4 sm:p-5 hover:bg-white/[0.03] transition-colors cursor-pointer text-left"
                                        aria-expanded={isExpanded}
                                    >
                                        <div className="flex items-center gap-3.5 min-w-0">
                                            <div className="p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex-shrink-0">
                                                <MapPin className="w-5 h-5" />
                                            </div>
                                            <div className="min-w-0">
                                                <h3 className="text-base sm:text-lg font-bold text-white truncate">{city}</h3>
                                                <p className="text-xs text-gray-400 font-medium">
                                                    {theaters.length} {theaters.length === 1 ? 'theatre' : 'theatres'} showing
                                                </p>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-3">
                                            <span className="text-xs px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-gray-300 font-medium hidden sm:inline-block">
                                                {theaters.reduce((acc, t) => acc + (t.rooms || []).reduce((s, r) => s + (r.showtimes?.length || 0), 0), 0)} shows
                                            </span>
                                            <div className={`p-1.5 rounded-lg bg-white/5 text-gray-400 transition-transform duration-300 ${isExpanded ? 'rotate-180 text-white bg-white/10' : ''}`}>
                                                <ChevronDown className="w-4 h-4" />
                                            </div>
                                        </div>
                                    </button>

                                    {isExpanded && (
                                        <div className="border-t border-white/10 divide-y divide-white/5 bg-black/20 animate-fadeIn">
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
                    <div className="bg-white/[0.03] rounded-2xl p-8 text-center border border-white/10 backdrop-blur-sm mt-6 shadow-xl">
                        <div className="w-12 h-12 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center mx-auto mb-4 shadow-lg">
                            <MapPin className="w-6 h-6" />
                        </div>
                        <h3 className="text-lg font-bold text-white mb-2">Available across {cities.length} cities</h3>
                        <p className="text-xs text-gray-400 max-w-md mx-auto mb-5">
                            Specific auditorium showtimes and room schedules are updating for this release.
                        </p>
                        <div className="flex flex-wrap justify-center gap-2 max-w-2xl mx-auto">
                            {cities.slice(0, 24).map((city) => (
                                <span key={city} className="px-3 py-1 bg-white/[0.05] border border-white/10 text-gray-300 rounded-full text-xs font-medium">
                                    {city}
                                </span>
                            ))}
                            {cities.length > 24 && (
                                <span className="px-3 py-1 bg-white/[0.08] border border-white/15 text-purple-300 rounded-full text-xs font-bold">
                                    +{cities.length - 24} more cities
                                </span>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

