'use client';

import { useState, useRef, useEffect } from 'react';
import Image from 'next/image';
import {
    MapPin,
    Film,
    Building2,
    Banknote,
    Activity,
    ChevronDown,
    Sparkles,
    Ticket,
    Clock,
    Flame
} from 'lucide-react';
import { formatPrice, calculateShowtimeStats } from '@/lib/showtime-utils';
import { CHAIN_COLORS, ChainName } from '@/lib/constants';
import ShowtimeSparkline from '../showtimes/ShowtimeSparkline';
import CityShowtimesFilters from '../showtimes/CityShowtimesFilters';
import TheaterCard from '../showtimes/TheaterCard';
import { TheaterSchedule } from '@/types';
import { AdmissionStats } from './MovieBrowser';
import { useTranslation } from '@/i18n';
import { TranslationKey } from '@/i18n/types';
import { normalizeGenre, getGenreEmoji } from '@/lib/genres';

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
}

export default function CityShowtimes({ movie }: CityShowtimesProps) {
    const { t } = useTranslation();
    const [selectedCity, setSelectedCity] = useState('');
    const [expandedCity, setExpandedCity] = useState<string | null>(null);
    const [hiddenChains, setHiddenChains] = useState<Set<string>>(new Set());
    const cityRefs = useRef<Record<string, HTMLDivElement | null>>({});

    // Reset expanded city when movie changes
    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setExpandedCity(null);
        setSelectedCity('');
        setHiddenChains(new Set());
    }, [movie?.id]);

    if (!movie) {
        return (
            <div className="flex-1 flex items-center justify-center p-8 bg-gray-950">
                <div className="text-center">
                    <p className="text-gray-400 font-medium">{t('sidebar.emptyTitle')}</p>
                </div>
            </div>
        );
    }

    const cities = movie.cities || [];
    const hasSchedules = movie.schedules && Object.keys(movie.schedules).length > 0;
    const merchants = movie.merchants || [];
    const genres = movie.genres || [];

    // Calculate aggregated stats
    const stats = hasSchedules ? calculateShowtimeStats(movie.schedules!) : null;

    // Get all available chains for this movie
    const availableChains = Array.from(
        new Set(
            Object.values(movie.schedules || {})
                .flat()
                .map(t => t.merchant)
                .filter(Boolean)
        )
    );

    // Toggle chain filter
    const toggleChain = (chain: string) => {
        setHiddenChains(prev => {
            const next = new Set(prev);
            if (next.has(chain)) {
                next.delete(chain);
            } else {
                next.add(chain);
            }
            return next;
        });
    };

    const isChainEnabled = (chain: string) => !hiddenChains.has(chain);

    // Filter theaters by active chain filters
    const filterTheaters = (theaters: TheaterSchedule[] = []) => {
        return theaters.filter(t => isChainEnabled(t.merchant));
    };

    // Scroll to city section
    const handleCityJump = (city: string) => {
        setSelectedCity(city);
        if (city) {
            setExpandedCity(city);
            setTimeout(() => {
                cityRefs.current[city]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }, 100);
        }
    };

    return (
        <div className="flex-1 overflow-y-auto bg-gray-950 p-4 sm:p-6 lg:p-8">
            <div className="max-w-7xl mx-auto space-y-6">
                {/* Hero Section */}
                <div className="relative rounded-3xl p-5 sm:p-8 lg:p-10 bg-gradient-to-br from-purple-950/40 via-gray-900/60 to-black border border-white/10 backdrop-blur-xl overflow-hidden shadow-2xl flex flex-col md:flex-row gap-6 sm:gap-8 items-start">
                    {/* Atmospheric Ambient Glow */}
                    <div className="absolute top-0 right-0 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />
                    <div className="absolute bottom-0 left-0 w-64 h-64 bg-pink-500/10 rounded-full blur-3xl pointer-events-none" />

                    {/* Movie Poster */}
                    <div className="relative w-36 sm:w-48 md:w-56 lg:w-64 aspect-[2/3] flex-shrink-0 rounded-2xl overflow-hidden bg-gray-800 border border-white/15 shadow-2xl mx-auto md:mx-0 group">
                        {movie.poster ? (
                            <Image
                                src={movie.poster}
                                alt={movie.title}
                                fill
                                className="object-cover transition-transform duration-500 group-hover:scale-105"
                                sizes="(max-width: 640px) 144px, (max-width: 768px) 192px, (max-width: 1024px) 224px, 256px"
                                priority
                            />
                        ) : (
                            <div className="w-full h-full flex flex-col items-center justify-center bg-gray-800 text-gray-500">
                                <Film className="w-12 h-12 mb-2 opacity-50" />
                                <span className="text-sm">🎬</span>
                            </div>
                        )}
                        {movie.is_presale && (
                            <div className="absolute top-0 left-0 right-0 bg-gradient-to-r from-amber-500 to-orange-500 text-white text-sm sm:text-sm font-extrabold text-center py-1 tracking-wider shadow-md">
                                {t('showtimes.hero.presale')}
                            </div>
                        )}
                        {/* Admission Metric Badge on Poster */}
                        {movie.admissionStats && movie.admissionStats.total_admissions > 0 && (
                            <div className="absolute bottom-3 right-3 bg-gray-950/80 backdrop-blur-md border border-emerald-500/30 rounded-xl px-2.5 py-1.5 flex items-center gap-2 shadow-2xl">
                                <Flame className="w-4 h-4 text-emerald-400 animate-pulse" />
                                <div className="flex flex-col items-start leading-none">
                                    <span className="text-sm uppercase tracking-widest text-emerald-400 font-bold mb-0.5">
                                        {t('common.showing')}
                                    </span>
                                    <span className="text-sm sm:text-sm font-extrabold text-white">
                                        {movie.admissionStats.total_admissions.toLocaleString()}
                                    </span>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Movie Details Column */}
                    <div className="flex-1 min-w-0 w-full flex flex-col justify-between pt-1">
                        <div>
                            {/* Badges & Tags Row */}
                            <div className="flex flex-wrap items-center gap-2 mb-3">
                                {movie.is_presale ? (
                                    <span className="inline-flex items-center gap-1.5 px-3 py-1 text-sm font-bold tracking-wider text-amber-300 bg-amber-500/15 border border-amber-500/30 rounded-full shadow-[0_0_15px_rgba(245,158,11,0.2)]">
                                        <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                                        {t('showtimes.hero.presale')}
                                    </span>
                                ) : hasSchedules ? (
                                    <span className="inline-flex items-center gap-1.5 px-3 py-1 text-sm font-bold tracking-wider text-emerald-300 bg-emerald-500/15 border border-emerald-500/30 rounded-full shadow-[0_0_15px_rgba(16,185,129,0.15)]">
                                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping inline-block" />
                                        {t('showtimes.hero.nowShowing')}
                                    </span>
                                ) : (
                                    <span className="inline-flex items-center gap-1.5 px-3 py-1 text-sm font-bold tracking-wider text-sky-300 bg-sky-500/15 border border-sky-500/30 rounded-full">
                                        <Clock className="w-3.5 h-3.5 text-sky-300" />
                                        {t('showtimes.hero.presale')}
                                    </span>
                                )}

                                {movie.age_category && (
                                    <span className="px-2.5 py-1 text-sm font-bold text-white bg-white/10 border border-white/15 rounded-full backdrop-blur-sm shadow-sm">
                                        {movie.age_category}
                                    </span>
                                )}

                                {genres.length > 0 && genres.slice(0, 3).map((genre) => {
                                    const key = normalizeGenre(genre);
                                    const localized = t(`genres.${key}` as TranslationKey) || genre;
                                    const emoji = getGenreEmoji(key);
                                    return (
                                        <span
                                            key={genre}
                                            className="inline-flex items-center gap-1 px-2.5 py-1 text-sm font-medium text-gray-300 bg-white/[0.04] border border-white/10 rounded-full hover:bg-white/[0.08] transition-colors"
                                        >
                                            <span>{emoji}</span>
                                            <span>{localized}</span>
                                        </span>
                                    );
                                })}
                            </div>

                            {/* Movie Title */}
                            <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-black text-white tracking-tight leading-[1.12] mb-4">
                                {movie.title}
                            </h1>

                            {/* Cinema Chains Available */}
                            <div className="flex flex-wrap items-center gap-2 mb-6">
                                <span className="text-sm text-gray-400 font-semibold uppercase tracking-wider mr-1">
                                    {t('showtimes.hero.availableAt')}
                                </span>
                                {merchants.map((merchant) => {
                                    const color = CHAIN_COLORS[merchant as ChainName] || '#9CA3AF';
                                    return (
                                        <span
                                            key={merchant}
                                            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-sm font-bold rounded-lg border backdrop-blur-sm shadow-sm transition-all duration-200"
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
                                })}
                            </div>
                        </div>

                        {/* Quick Stats Grid */}
                        {hasSchedules && stats && (
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
                                        <div className="text-sm sm:text-sm uppercase tracking-wider text-gray-400 font-semibold truncate">
                                            {t('showtimes.hero.stats.cities')}
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
                                        <div className="text-sm sm:text-sm uppercase tracking-wider text-gray-400 font-semibold truncate">
                                            {t('showtimes.hero.stats.theatres')}
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
                                        <div className="text-sm sm:text-sm uppercase tracking-wider text-gray-400 font-semibold truncate">
                                            {t('showtimes.hero.stats.dailyShowtimes')}
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
                                                : '-'}
                                        </div>
                                        <div className="text-sm sm:text-sm uppercase tracking-wider text-gray-400 font-semibold truncate">
                                            {t('showtimes.hero.stats.priceRange')}
                                        </div>
                                    </div>
                                </div>

                                {/* Density Sparkline */}
                                <div className="col-span-2 sm:col-span-4 lg:col-span-1 flex flex-col justify-center p-2.5 rounded-xl bg-white/[0.02] border-t sm:border-t-0 sm:border-l border-white/5 lg:pl-3">
                                    <div className="flex items-center justify-between text-sm sm:text-sm uppercase tracking-wider text-gray-400 font-semibold mb-1">
                                        <span className="flex items-center gap-1 text-purple-300">
                                            <Activity className="w-3.5 h-3.5 text-purple-400" />
                                            <span>{t('showtimes.hero.stats.hourlyDensity')}</span>
                                        </span>
                                    </div>
                                    <ShowtimeSparkline showtimes={stats.allShowtimes} />
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

                {/* Cities & Showtimes Section */}
                {hasSchedules && (
                    <div className="space-y-3.5 mt-6">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2 tracking-tight">
                                <Ticket className="w-5 h-5 text-purple-400" />
                                <span>{t('nav.showtimes')}</span>
                            </h2>
                            <span className="text-sm text-gray-400">
                                {t('catalog.citiesCount', { count: cities.length })}
                            </span>
                        </div>

                        {cities.map((city) => {
                            const theaters = filterTheaters(movie.schedules![city]);
                            if (theaters.length === 0) return null;

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
                            const totalShows = theaters.reduce((acc, t) => acc + (t.rooms || []).reduce((s, r) => s + (r.showtimes?.length || 0), 0), 0);

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
                                                <p className="text-sm text-gray-400 font-medium">
                                                    {t('showtimes.card.theatresCount', { count: theaters.length })}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-3">
                                            <span className="text-sm px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-gray-300 font-medium hidden sm:inline-block">
                                                {t('showtimes.card.showtimesCount', { count: totalShows })}
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
                )}
            </div>
        </div>
    );
}
