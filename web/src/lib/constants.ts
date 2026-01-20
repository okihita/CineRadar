export const CHAIN_COLORS = {
    'XXI': '#CFAB7A', // Gold-ish for XXI
    'CGV': '#E03C31', // Red for CGV
    'Cinépolis': '#002069', // Blue for Cinépolis
} as const;

export type ChainName = keyof typeof CHAIN_COLORS;

export function getChainColor(chain: string): string {
    return CHAIN_COLORS[chain as ChainName] || '#666666';
}
