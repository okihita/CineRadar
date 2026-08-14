'use client';

import { useTranslation } from '@/i18n';
import LanguageSwitcher from './LanguageSwitcher';

interface AppHeaderProps {
  totalMovies: number;
  totalCities: number;
  totalTheatres: number;
  date: string;
  formattedTime: string;
}

export default function AppHeader({
  totalMovies,
  totalCities,
  totalTheatres,
  date,
  formattedTime,
}: AppHeaderProps) {
  const { t } = useTranslation();

  return (
    <header className="sticky top-0 z-50 backdrop-blur-xl bg-black/40 border-b border-white/10 h-16 sm:h-20">
      <div className="h-full px-3.5 sm:px-6 flex items-center justify-between max-w-7xl mx-auto">
        {/* Logo Section */}
        <div className="flex items-center gap-2.5 sm:gap-3.5 min-w-0">
          <span className="text-2xl sm:text-3xl flex-shrink-0">🎬</span>
          <div className="min-w-0">
            <h1 className="text-base sm:text-xl font-bold text-white tracking-tight truncate">
              {t('common.appName')}
            </h1>
            <p className="text-[10px] sm:text-xs text-gray-400 hidden xs:block truncate">
              {t('common.tagline')}
            </p>
          </div>
        </div>

        {/* Right Section: Stats & Language Switcher */}
        <div className="flex items-center gap-2.5 sm:gap-5 flex-shrink-0">
          {/* Desktop Stats */}
          <div className="hidden sm:flex items-center gap-5 md:gap-6">
            <div className="text-center">
              <p className="text-xl md:text-2xl font-bold text-white leading-none">{totalMovies}</p>
              <p className="text-[10px] md:text-xs text-gray-400 uppercase tracking-wider mt-0.5">
                {t('header.movies')}
              </p>
            </div>
            <div className="text-center">
              <p className="text-xl md:text-2xl font-bold text-white leading-none">{totalCities}</p>
              <p className="text-[10px] md:text-xs text-gray-400 uppercase tracking-wider mt-0.5">
                {t('header.cities')}
              </p>
            </div>
            {totalTheatres > 0 && (
              <div className="text-center hidden md:block">
                <p className="text-xl md:text-2xl font-bold text-white leading-none">{totalTheatres}</p>
                <p className="text-[10px] md:text-xs text-gray-400 uppercase tracking-wider mt-0.5">
                  {t('header.theatres')}
                </p>
              </div>
            )}
          </div>

          {/* Mobile Pill Badges */}
          <div className="flex sm:hidden items-center gap-1.5">
            <span className="px-2 py-0.5 rounded-md bg-white/10 border border-white/10 text-[11px] font-bold text-white">
              {totalMovies} <span className="text-gray-400 font-normal">{t('header.movies')}</span>
            </span>
            <span className="px-2 py-0.5 rounded-md bg-white/10 border border-white/10 text-[11px] font-bold text-white">
              {totalCities} <span className="text-gray-400 font-normal">{t('header.cities')}</span>
            </span>
          </div>

          {/* Timestamp */}
          <div className="hidden lg:block text-right text-sm border-l border-white/10 pl-4">
            <p className="text-gray-300 font-medium text-xs">{date}</p>
            <p className="text-[10px] text-gray-500 font-mono">{formattedTime}</p>
          </div>

          {/* Language Switcher */}
          <div className="border-l border-white/10 pl-2.5 sm:pl-3">
            <LanguageSwitcher />
          </div>
        </div>
      </div>
    </header>
  );
}
