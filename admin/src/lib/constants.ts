/**
 * Shared constants for the admin dashboard
 * Eliminates magic strings and duplicated color definitions
 */

// Chain brand colors
export const CHAIN_COLORS = {
  XXI: '#CFAB7A',
  CGV: '#E03C31',
  Cinépolis: '#002069',
} as const;

// Chain colors with opacity for badges/backgrounds
export const CHAIN_COLORS_LIGHT = {
  XXI: 'rgba(207, 171, 122, 0.2)',
  CGV: 'rgba(224, 60, 49, 0.2)',
  Cinépolis: 'rgba(0, 32, 105, 0.2)',
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
export const CHAIN_NAMES = ['XXI', 'CGV', 'Cinépolis'] as const;
export type ChainName = (typeof CHAIN_NAMES)[number];

// Helper to get chain color
export function getChainColor(chain: string): string {
  return CHAIN_COLORS[chain as ChainName] || '#666666';
}

// Helper to get chain light color
export function getChainColorLight(chain: string): string {
  return CHAIN_COLORS_LIGHT[chain as ChainName] || 'rgba(102, 102, 102, 0.2)';
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
} as const;
