/**
 * Cinemas feature types
 * Re-exports shared types and adds feature-specific types
 */

// Re-export shared types
export type { Theatre, ScraperRun } from '@/types';

export interface RegionBreakdown {
    name: string;
    count: number;
}

export interface MerchantBreakdown {
    name: string;
    count: number;
}
