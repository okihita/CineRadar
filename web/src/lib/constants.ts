export const CHAIN_COLORS = {
    'XXI': '#CFAB7A', // Gold for XXI
    'CGV': '#E03C31', // Vibrant Crimson for CGV
    'Cinépolis': '#0284C7', // Vivid Cinema Blue for Cinépolis (accessible on dark themes)
} as const;

export type ChainName = keyof typeof CHAIN_COLORS;

