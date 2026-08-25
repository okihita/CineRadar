/**
 * Shared constants for the admin dashboard
 * Eliminates magic strings and duplicated color definitions
 */

// Chain brand colors
export const CHAIN_COLORS = {
  XXI: '#CFAB7A',
  CGV: '#E03C31',
  Cinépolis: '#002069',
  FLIX: '#FFDA00',
} as const;

// Chain colors with opacity for badges/backgrounds
export const CHAIN_COLORS_LIGHT = {
  XXI: 'rgba(207, 171, 122, 0.2)',
  CGV: 'rgba(224, 60, 49, 0.2)',
  Cinépolis: 'rgba(0, 32, 105, 0.2)',
  FLIX: 'rgba(255, 218, 0, 0.2)',
} as const;

// Region colors for charts and filters (ordered by typical display)
export const REGION_COLORS = [
  '#0d9488', // teal - Jawa
  '#7c3aed', // purple - Sumatera
  '#db2777', // pink - Kalimantan
  '#ea580c', // orange - Sulawesi
  '#0891b2', // cyan - Bali & NT
  '#65a30d', // lime - Papua & Maluku
] as const;

// Default pagination
export const ITEMS_PER_PAGE = 15;

// Chain names for iteration
export const CHAIN_NAMES = ['XXI', 'CGV', 'Cinépolis', 'FLIX'] as const;
export type ChainName = (typeof CHAIN_NAMES)[number];

/**
 * Normalizes merchant name to match CHAIN_NAMES keys
 */
export function normalizeMerchant(merchant: string | undefined | null): ChainName | null {
  if (!merchant) return null;
  const m = merchant.toUpperCase();
  if (m.includes('XXI')) return 'XXI';
  if (m.includes('CGV')) return 'CGV';
  if (m.includes('CINEPOLIS') || m.includes('CINÉPOLIS')) return 'Cinépolis';
  if (m.includes('FLIX')) return 'FLIX';
  return null;
}

// Chain Tailwind classes for badges and text
export const CHAIN_TAILWIND = {
  XXI: { bg: 'bg-amber-500', text: 'text-amber-600 dark:text-amber-400', badge: 'bg-amber-500 text-white', badgeLight: 'bg-amber-500/20' },
  CGV: { bg: 'bg-red-600', text: 'text-red-600 dark:text-red-400', badge: 'bg-red-600 text-white', badgeLight: 'bg-red-500/20' },
  Cinépolis: { bg: 'bg-blue-600', text: 'text-blue-600 dark:text-blue-400', badge: 'bg-blue-600 text-white', badgeLight: 'bg-blue-500/20' },
  FLIX: { bg: 'bg-yellow-400', text: 'text-yellow-600 dark:text-yellow-400', badge: 'bg-yellow-400 text-black', badgeLight: 'bg-yellow-400/20' },
} as const;
export type ChainTailwindKey = keyof typeof CHAIN_TAILWIND;

/**
 * Gets tailwind classes for a merchant
 */
export function getChainTailwind(merchant: string | undefined | null) {
  const normalized = normalizeMerchant(merchant);
  return normalized ? CHAIN_TAILWIND[normalized] : null;
}

// Helper to get chain color
export function getChainColor(chain: string): string {
  const normalized = normalizeMerchant(chain);
  return normalized ? CHAIN_COLORS[normalized] : '#666666';
}

// Helper to get chain light color
export function getChainColorLight(chain: string): string {
  const normalized = normalizeMerchant(chain);
  return normalized ? CHAIN_COLORS_LIGHT[normalized] : 'rgba(102, 102, 102, 0.2)';
}

/** Firebase Firestore Console URL base */
const FIRESTORE_CONSOLE_BASE = 'https://console.firebase.google.com/project/cineradar-481014/firestore/databases/-default-/data';

/**
 * Generates a direct link to a document in the Firebase Console.
 * @param pathSegments - Path segments (e.g. ['movie_performance_v2', movieId])
 */
export function getFirestoreConsoleUrl(...pathSegments: string[]): string {
  return `${FIRESTORE_CONSOLE_BASE}/${pathSegments.map(s => `~2F${s}`).join('')}`;
}

// Refresh intervals (milliseconds)
export const REFRESH_INTERVALS = {
  FAST: 30000,        // 30 seconds - for real-time monitoring
  MODERATE: 60000,    // 1 minute - for live data feeds
  SLOW: 300000,       // 5 minutes - for cached data
} as const;

// Time constants (milliseconds)
export const TIME_CONSTANTS = {
  ONE_SECOND: 1000,
  ONE_MINUTE: 60000,
  FIVE_MINUTES: 300000,
  ONE_HOUR: 3600000,
  TOKEN_BUFFER: 300000,  // 5 min buffer for token expiry checks
  FIREBASE_REQUEST_TIMEOUT: 30000,  // 30 seconds
  MAX_RETRIES: 3,
  RETRY_DELAY_BASE: 1000,  // 1 second base delay
} as const;

/**
 * Performance Tiers for Occupancy (OCR)
 * Unified color scale from Red (0%) to Purple (30%+)
 *
 * All Tailwind classes are full static strings so the JIT compiler can detect them.
 */
export const PERFORMANCE_TIERS = [
  { threshold: 2.5, color: '#b91c1c', twText: 'text-red-700', twBg: 'bg-red-700', twFill: 'fill-red-700', twBgSoft: 'bg-red-700/5', twBorderSoft: 'border-red-700/10', label: 'Critical' },
  { threshold: 5.0, color: '#ef4444', twText: 'text-red-500', twBg: 'bg-red-500', twFill: 'fill-red-500', twBgSoft: 'bg-red-500/5', twBorderSoft: 'border-red-500/10', label: 'Very Low' },
  { threshold: 7.5, color: '#ea580c', twText: 'text-orange-600', twBg: 'bg-orange-600', twFill: 'fill-orange-600', twBgSoft: 'bg-orange-600/5', twBorderSoft: 'border-orange-600/10', label: 'Low' },
  { threshold: 10.0, color: '#fb923c', twText: 'text-orange-400', twBg: 'bg-orange-400', twFill: 'fill-orange-400', twBgSoft: 'bg-orange-400/5', twBorderSoft: 'border-orange-400/10', label: 'Underperforming' },
  { threshold: 12.5, color: '#eab308', twText: 'text-yellow-500', twBg: 'bg-yellow-500', twFill: 'fill-yellow-500', twBgSoft: 'bg-yellow-500/5', twBorderSoft: 'border-yellow-500/10', label: 'Soft' },
  { threshold: 15.0, color: '#facc15', twText: 'text-yellow-400', twBg: 'bg-yellow-400', twFill: 'fill-yellow-400', twBgSoft: 'bg-yellow-400/5', twBorderSoft: 'border-yellow-400/10', label: 'Steady' },
  { threshold: 17.5, color: '#84cc16', twText: 'text-lime-500', twBg: 'bg-lime-500', twFill: 'fill-lime-500', twBgSoft: 'bg-lime-500/5', twBorderSoft: 'border-lime-500/10', label: 'Healthy' },
  { threshold: 20.0, color: '#22c55e', twText: 'text-green-500', twBg: 'bg-green-500', twFill: 'fill-green-500', twBgSoft: 'bg-green-500/5', twBorderSoft: 'border-green-500/10', label: 'Good' },
  { threshold: 22.5, color: '#10b981', twText: 'text-emerald-500', twBg: 'bg-emerald-500', twFill: 'fill-emerald-500', twBgSoft: 'bg-emerald-500/5', twBorderSoft: 'border-emerald-500/10', label: 'High' },
  { threshold: 25.0, color: '#14b8a6', twText: 'text-teal-500', twBg: 'bg-teal-500', twFill: 'fill-teal-500', twBgSoft: 'bg-teal-500/5', twBorderSoft: 'border-teal-500/10', label: 'Very High' },
  { threshold: 27.5, color: '#2563eb', twText: 'text-blue-600', twBg: 'bg-blue-600', twFill: 'fill-blue-600', twBgSoft: 'bg-blue-600/5', twBorderSoft: 'border-blue-600/10', label: 'Elite' },
  { threshold: 30.0, color: '#7e22ce', twText: 'text-purple-700', twBg: 'bg-purple-700', twFill: 'fill-purple-700', twBgSoft: 'bg-purple-700/5', twBorderSoft: 'border-purple-700/10', label: 'Peak' },
] as const;

/**
 * Gets the performance tier based on occupancy percentage
 */
export function getPerformanceTier(pct: number) {
  for (const tier of PERFORMANCE_TIERS) {
    if (pct < tier.threshold) return tier;
  }
  return PERFORMANCE_TIERS[PERFORMANCE_TIERS.length - 1];
}
