'use client';

import { useTranslation, LOCALES, LOCALE_LABELS, Locale } from '@/i18n';
import { Globe } from 'lucide-react';

export default function LanguageSwitcher() {
  const { locale, setLocale } = useTranslation();

  return (
    <div className="flex items-center gap-1 p-0.5 sm:p-1 bg-white/[0.06] border border-white/10 rounded-xl backdrop-blur-md shadow-inner">
      <Globe className="w-3.5 h-3.5 text-gray-400 ml-1.5 hidden sm:block pointer-events-none" />
      {LOCALES.map((loc: Locale) => {
        const isActive = locale === loc;
        const info = LOCALE_LABELS[loc];

        return (
          <button
            key={loc}
            onClick={() => setLocale(loc)}
            className={`px-2 py-0.5 sm:py-1 rounded-lg text-[11px] sm:text-xs font-bold transition-all duration-200 cursor-pointer flex items-center gap-1 active:scale-95 ${
              isActive
                ? 'bg-purple-600 text-white shadow-md shadow-purple-500/25 border border-purple-400/40'
                : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}
            title={info.label}
            aria-label={`Switch language to ${info.label}`}
          >
            <span>{info.flag}</span>
            <span>{info.short}</span>
          </button>
        );
      })}
    </div>
  );
}
