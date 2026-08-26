'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Search, X, Film, Sparkles, MapPin } from 'lucide-react';
import { TheaterSchedule } from '@/types';

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

interface MovieSidebarProps {
  movies: Movie[];
  selectedMovie: Movie | null;
  onSelectMovie: (movie: Movie) => void;
  onClose?: () => void;
  isMobile?: boolean;
}

import { useTranslation } from '@/i18n';

export default function MovieSidebar({
  movies,
  selectedMovie,
  onSelectMovie,
  onClose,
  isMobile = false,
}: MovieSidebarProps) {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');

  const filteredMovies = movies.filter(movie =>
    movie.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="w-full h-full bg-gray-950/95 lg:bg-black/40 backdrop-blur-xl flex flex-col">
      {/* Mobile Drawer Header */}
      {isMobile && (
        <div className="p-4 border-b border-white/10 flex items-center justify-between bg-black/40">
          <div className="flex items-center gap-2">
            <Film className="w-5 h-5 text-purple-400" />
            <h2 className="text-base font-bold text-white tracking-tight">{t('sidebar.title')}</h2>
            <span className="text-sm px-2 py-0.5 rounded-full bg-white/10 text-gray-400 font-mono">
              {movies.length}
            </span>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-colors cursor-pointer"
              aria-label="Close movie selector"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      )}

      {/* Search Bar */}
      <div className="p-3.5 sm:p-4 border-b border-white/10">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          <input
            type="text"
            placeholder={t('sidebar.searchPlaceholder')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-9 py-2 bg-white/[0.06] border border-white/15 rounded-xl text-sm text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 transition-all shadow-inner"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-white cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Movie List */}
      <div className="flex-1 overflow-y-auto divide-y divide-white/5">
        {filteredMovies.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <Film className="w-8 h-8 mx-auto mb-2 opacity-40" />
            <p className="text-sm font-medium">{t('sidebar.emptyTitle')}</p>
            <p className="text-sm text-gray-600 mt-1">{t('sidebar.emptySubtitle')}</p>
          </div>
        ) : (
          filteredMovies.map((movie, index) => {
            const isSelected = selectedMovie?.id === movie.id;

            return (
              <button
                key={movie.id}
                onClick={() => {
                  onSelectMovie(movie);
                  if (isMobile && onClose) onClose();
                }}
                className={`w-full flex items-center gap-3 p-3 text-left transition-all duration-200 cursor-pointer ${
                  isSelected
                    ? 'bg-purple-500/20 border-l-4 border-l-purple-500 shadow-inner'
                    : 'hover:bg-white/[0.04] border-l-4 border-l-transparent'
                }`}
              >
                {/* Index */}
                <span className="text-gray-500 text-sm font-mono w-5 flex-shrink-0 text-center">
                  {index + 1}
                </span>

                {/* Poster Thumbnail */}
                <div className="relative w-11 h-15 flex-shrink-0 rounded-lg overflow-hidden bg-gray-800 border border-white/10 shadow-sm">
                  {movie.poster ? (
                    <Image
                      src={movie.poster}
                      alt={movie.title}
                      fill
                      className="object-cover"
                      sizes="44px"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-sm bg-white/5">
                      🎬
                    </div>
                  )}
                  {movie.is_presale && (
                    <div className="absolute top-0 left-0 right-0 bg-gradient-to-r from-amber-500 to-orange-500 text-white text-sm font-extrabold text-center py-0.5 tracking-tighter">
                      {t('showtimes.hero.presale')}
                    </div>
                  )}
                </div>

                {/* Movie Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    {movie.is_presale ? (
                      <span className="inline-flex items-center gap-0.5 text-sm font-bold text-amber-400 uppercase tracking-wider">
                        <Sparkles className="w-2.5 h-2.5" /> {t('sidebar.presale')}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-sm font-bold text-emerald-400 uppercase tracking-wider">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> {t('sidebar.showing')}
                      </span>
                    )}
                  </div>

                  <h3
                    className={`font-semibold truncate text-sm leading-snug ${
                      isSelected ? 'text-white font-bold' : 'text-gray-200'
                    }`}
                  >
                    {movie.title}
                  </h3>

                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-sm text-gray-400 flex items-center gap-1 truncate">
                      <MapPin className="w-3 h-3 text-blue-400 flex-shrink-0" />
                      {movie.cities.length === 1 ? t('sidebar.singleCity') : t('sidebar.citiesCount', { count: movie.cities.length })}
                    </span>
                    {movie.age_category && (
                      <span
                        className={`text-sm font-bold px-1.5 py-0.2 rounded ${
                          movie.age_category === 'SU'
                            ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                            : movie.age_category === 'R' || movie.age_category === '13+'
                            ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
                            : movie.age_category === 'D' || movie.age_category === '17+' || movie.age_category === '21+'
                            ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                            : 'bg-white/10 text-gray-400 border border-white/10'
                        }`}
                      >
                        {movie.age_category}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>

      {/* Sidebar Footer */}
      <div className="p-3 border-t border-white/10 bg-black/40 text-center text-sm text-gray-400 flex items-center justify-between px-4">
        <span>{t('sidebar.totalListings')}</span>
        <span className="font-mono font-bold text-white">{filteredMovies.length}</span>
      </div>
    </div>
  );
}

