'use client';

import { useState, useMemo } from 'react';
import Image from 'next/image';
import { Search, X, Sparkles, MapPin, Film, Flame, SlidersHorizontal } from 'lucide-react';
import { CHAIN_COLORS, ChainName } from '@/lib/constants';
import { TheaterSchedule } from '@/types';
import { AdmissionStats } from './MovieBrowser';

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

interface MovieCatalogGridProps {
  movies: Movie[];
  onSelectMovie: (movie: Movie) => void;
}

type FilterTab = 'all' | 'now_showing' | 'presale';

export default function MovieCatalogGrid({ movies, onSelectMovie }: MovieCatalogGridProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const [selectedGenre, setSelectedGenre] = useState<string>('all');

  // Extract all unique genres
  const allGenres = useMemo(() => {
    const genres = new Set<string>();
    movies.forEach(m => (m.genres || []).forEach(g => genres.add(g)));
    return Array.from(genres).sort();
  }, [movies]);

  // Counts for tabs
  const counts = useMemo(() => {
    const presale = movies.filter(m => m.is_presale).length;
    const nowShowing = movies.length - presale;
    return { all: movies.length, presale, nowShowing };
  }, [movies]);

  // Filter movies
  const filteredMovies = useMemo(() => {
    return movies.filter(movie => {
      // Tab filter
      if (activeTab === 'presale' && !movie.is_presale) return false;
      if (activeTab === 'now_showing' && movie.is_presale) return false;

      // Genre filter
      if (selectedGenre !== 'all' && !(movie.genres || []).includes(selectedGenre)) {
        return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = movie.title.toLowerCase().includes(q);
        const matchesCountry = (movie.country || '').toLowerCase().includes(q);
        const matchesGenre = (movie.genres || []).some(g => g.toLowerCase().includes(q));
        const matchesCity = (movie.cities || []).some(c => c.toLowerCase().includes(q));
        return matchesTitle || matchesCountry || matchesGenre || matchesCity;
      }

      return true;
    });
  }, [movies, activeTab, selectedGenre, searchQuery]);

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 bg-gray-950">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Hero Banner / Header for Discovery */}
        <div className="relative rounded-3xl p-6 sm:p-8 bg-gradient-to-br from-purple-950/40 via-gray-900/60 to-black border border-white/10 backdrop-blur-xl overflow-hidden shadow-2xl">
          <div className="absolute top-0 right-0 w-80 h-80 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="relative z-10 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/15 border border-purple-500/30 text-purple-300 text-xs font-bold mb-3 shadow-sm">
              <Sparkles className="w-3.5 h-3.5 text-purple-400" />
              <span>Indonesia Cinema Radar</span>
            </div>
            <h1 className="text-2xl sm:text-4xl font-black text-white tracking-tight leading-tight mb-2">
              Explore All Movies in Theatres
            </h1>
            <p className="text-xs sm:text-sm text-gray-300">
              Browse showtimes, live seat occupancy, and ticket prices across XXI, CGV, and Cinépolis nationwide.
            </p>
          </div>
        </div>

        {/* Search & Filters Controls */}
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              <input
                type="text"
                placeholder="Search by title, genre, city, or country..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-9 py-2.5 bg-white/[0.05] border border-white/15 rounded-2xl text-sm text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500/50 hover:border-white/30 transition-all shadow-inner"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-white"
                  aria-label="Clear search"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Genre Filter */}
            {allGenres.length > 0 && (
              <div className="flex items-center gap-2 flex-shrink-0">
                <SlidersHorizontal className="w-4 h-4 text-gray-400 hidden sm:block" />
                <select
                  value={selectedGenre}
                  onChange={(e) => setSelectedGenre(e.target.value)}
                  className="bg-black/50 border border-white/15 rounded-2xl px-3.5 py-2.5 text-xs sm:text-sm font-medium text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50 hover:border-white/30 transition-all cursor-pointer"
                >
                  <option value="all" className="bg-gray-900 text-gray-400">All Genres ({allGenres.length})</option>
                  {allGenres.map(g => (
                    <option key={g} value={g} className="bg-gray-900 text-white">
                      {g}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Status Filter Tabs */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
            <button
              onClick={() => setActiveTab('all')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer flex items-center gap-1.5 flex-shrink-0 ${
                activeTab === 'all'
                  ? 'bg-white/20 text-white border border-white/30 shadow-md backdrop-blur-md'
                  : 'bg-white/[0.03] text-gray-400 border border-white/10 hover:text-white hover:bg-white/[0.07]'
              }`}
            >
              <span>🍿 All Movies</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-white/10">{counts.all}</span>
            </button>

            <button
              onClick={() => setActiveTab('now_showing')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer flex items-center gap-1.5 flex-shrink-0 ${
                activeTab === 'now_showing'
                  ? 'bg-emerald-500/25 text-emerald-300 border border-emerald-500/40 shadow-md backdrop-blur-md'
                  : 'bg-white/[0.03] text-gray-400 border border-white/10 hover:text-white hover:bg-white/[0.07]'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              <span>Now Showing</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-white/10">{counts.nowShowing}</span>
            </button>

            {counts.presale > 0 && (
              <button
                onClick={() => setActiveTab('presale')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer flex items-center gap-1.5 flex-shrink-0 ${
                  activeTab === 'presale'
                    ? 'bg-amber-500/25 text-amber-300 border border-amber-500/40 shadow-md backdrop-blur-md'
                    : 'bg-white/[0.03] text-gray-400 border border-white/10 hover:text-white hover:bg-white/[0.07]'
                }`}
              >
                <Sparkles className="w-3 h-3 text-amber-400" />
                <span>Pre-Sale Active</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-white/10">{counts.presale}</span>
              </button>
            )}
          </div>
        </div>

        {/* Movies Grid */}
        {filteredMovies.length === 0 ? (
          <div className="p-12 text-center rounded-3xl bg-white/[0.02] border border-white/10">
            <Film className="w-12 h-12 mx-auto mb-3 text-gray-500 opacity-50" />
            <h3 className="text-base font-bold text-white mb-1">No movies found</h3>
            <p className="text-xs text-gray-400 max-w-sm mx-auto mb-4">
              We couldn&apos;t find any titles matching your filter. Try adjusting your search query.
            </p>
            <button
              onClick={() => { setSearchQuery(''); setActiveTab('all'); setSelectedGenre('all'); }}
              className="px-4 py-2 rounded-xl bg-purple-600/30 hover:bg-purple-600/50 border border-purple-500/40 text-purple-200 text-xs font-bold transition-colors cursor-pointer"
            >
              Reset Filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4">
            {filteredMovies.map((movie) => (
              <div
                key={movie.id}
                onClick={() => onSelectMovie(movie)}
                className="group relative flex flex-col bg-white/[0.03] hover:bg-white/[0.06] rounded-2xl overflow-hidden border border-white/10 hover:border-purple-500/50 transition-all duration-300 hover:scale-[1.02] hover:shadow-2xl hover:shadow-purple-500/20 cursor-pointer"
              >
                {/* Poster Container */}
                <div className="aspect-[2/3] relative w-full overflow-hidden bg-gray-900">
                  {movie.poster ? (
                    <Image
                      src={movie.poster}
                      alt={movie.title}
                      fill
                      className="object-cover transition-transform duration-700 group-hover:scale-105"
                      sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, (max-width: 1024px) 25vw, 16vw"
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center bg-white/5 text-gray-400 p-2 text-center">
                      <Film className="w-8 h-8 mb-1 opacity-50" />
                      <span className="text-[10px] font-bold uppercase">{movie.title.slice(0, 16)}</span>
                    </div>
                  )}

                  {/* Gradient Overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-60 group-hover:opacity-30 transition-opacity pointer-events-none" />

                  {/* Pre-sale Badge */}
                  {movie.is_presale && (
                    <div className="absolute top-2 left-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white text-[8px] sm:text-[9px] font-extrabold px-2 py-0.5 rounded-md shadow-md uppercase tracking-wider">
                      PRE-SALE
                    </div>
                  )}

                  {/* Age Rating Badge */}
                  {movie.age_category && (
                    <div className="absolute top-2 right-2 px-1.5 py-0.5 rounded bg-black/70 backdrop-blur-md border border-white/20 text-[9px] sm:text-[10px] font-bold text-white shadow-md">
                      {movie.age_category}
                    </div>
                  )}

                  {/* Live Admissions Badge if available */}
                  {movie.admissionStats && movie.admissionStats.total_admissions > 0 && (
                    <div className="absolute bottom-2 right-2 bg-black/80 backdrop-blur-md border border-emerald-500/30 rounded-lg px-2 py-0.5 flex items-center gap-1 shadow-lg">
                      <Flame className="w-3 h-3 text-emerald-400 animate-pulse" />
                      <span className="text-[10px] font-extrabold text-white">
                        {movie.admissionStats.total_admissions.toLocaleString()}
                      </span>
                    </div>
                  )}
                </div>

                {/* Movie Info */}
                <div className="p-3 flex-1 flex flex-col justify-between">
                  <div>
                    <h3 className="font-bold text-white text-xs sm:text-sm line-clamp-2 leading-snug group-hover:text-purple-300 transition-colors">
                      {movie.title}
                    </h3>
                    <p className="text-[10px] text-gray-400 mt-1 line-clamp-1">
                      {movie.genres && movie.genres.length > 0 ? movie.genres.join(' • ') : movie.country || 'Cinema Release'}
                    </p>
                  </div>

                  <div className="mt-3 pt-2 border-t border-white/5 flex items-center justify-between text-[10px] text-gray-400">
                    <span className="flex items-center gap-1 truncate font-medium">
                      <MapPin className="w-3 h-3 text-blue-400 flex-shrink-0" />
                      {movie.cities.length} {movie.cities.length === 1 ? 'City' : 'Cities'}
                    </span>

                    {/* Merchant Dots */}
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {movie.merchants.map((merchant) => {
                        const color = CHAIN_COLORS[merchant as ChainName] || '#9CA3AF';
                        return (
                          <span
                            key={merchant}
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: color }}
                            title={merchant}
                          />
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
