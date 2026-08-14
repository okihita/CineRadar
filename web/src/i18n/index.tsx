'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { Locale, DEFAULT_LOCALE, LOCALES } from './config';
import { id } from './locales/id';
import { en } from './locales/en';
import { TranslationKey, TranslationSchema } from './types';

const dictionaries: Record<Locale, TranslationSchema> = {
  id,
  en,
};

interface I18nContextType {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: TranslationKey | string, params?: Record<string, string | number>) => string;
  dict: TranslationSchema;
}

const I18nContext = createContext<I18nContextType | null>(null);

const STORAGE_KEY = 'cineradar_locale';

export function I18nProvider({
  children,
  initialLocale = DEFAULT_LOCALE,
}: {
  children: ReactNode;
  initialLocale?: Locale;
}) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale);

  // Sync with localStorage on client
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY) as Locale | null;
      if (saved && LOCALES.includes(saved)) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setLocaleState(saved);
      }
    } catch {
      // ignore storage errors
    }
  }, []);

  const setLocale = useCallback((newLocale: Locale) => {
    setLocaleState(newLocale);
    try {
      localStorage.setItem(STORAGE_KEY, newLocale);
      document.documentElement.lang = newLocale;
    } catch {
      // ignore storage errors
    }
  }, []);

  const dict = dictionaries[locale] || dictionaries[DEFAULT_LOCALE];

  const t = useCallback(
    (key: TranslationKey | string, params?: Record<string, string | number>): string => {
      const keys = (key as string).split('.');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let current: any = dict;

      for (const k of keys) {
        if (current && typeof current === 'object' && k in current) {
          current = current[k];
        } else {
          // Fallback to Indonesian if key not found
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          let fallback: any = dictionaries[DEFAULT_LOCALE];
          for (const fk of keys) {
            if (fallback && typeof fallback === 'object' && fk in fallback) {
              fallback = fallback[fk];
            } else {
              fallback = undefined;
              break;
            }
          }
          current = fallback !== undefined ? fallback : key;
          break;
        }
      }

      if (typeof current !== 'string') {
        return (key as string);
      }

      if (!params) {
        return current;
      }

      // Replace {param} placeholders
      return Object.entries(params).reduce(
        (str, [paramKey, value]) => str.replace(new RegExp(`\\{${paramKey}\\}`, 'g'), String(value)),
        current
      );
    },
    [dict]
  );

  return (
    <I18nContext.Provider value={{ locale, setLocale, t, dict }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useTranslation() {
  const context = useContext(I18nContext);
  if (!context) {
    // Fallback if rendered outside provider
    const defaultDict = dictionaries[DEFAULT_LOCALE];
    const fallbackT = (key: TranslationKey | string, params?: Record<string, string | number>): string => {
      const keys = (key as string).split('.');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let current: any = defaultDict;
      for (const k of keys) {
        if (current && typeof current === 'object' && k in current) {
          current = current[k];
        } else {
          return key as string;
        }
      }
      if (typeof current !== 'string') return key as string;
      if (!params) return current;
      return Object.entries(params).reduce(
        (str, [paramKey, value]) => str.replace(new RegExp(`\\{${paramKey}\\}`, 'g'), String(value)),
        current
      );
    };

    return {
      locale: DEFAULT_LOCALE,
      setLocale: () => {},
      t: fallbackT,
      dict: defaultDict,
    };
  }
  return context;
}

export * from './config';
export * from './types';
