export const LOCALES = ['id', 'en'] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = 'id';

export const LOCALE_LABELS: Record<Locale, { label: string; flag: string; short: string }> = {
  id: { label: 'Bahasa Indonesia', flag: '🇮🇩', short: 'ID' },
  en: { label: 'English', flag: '🇬🇧', short: 'EN' },
};
