/** Shared cinema types for the cinemas feature module. */

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

export interface RigidityStat {
    merchant: string;
    collisionRate: number;
    totalStudios: number;
    quarantined: number;
}

export interface PricingStat {
    city: string;
    avgPrice: number;
}

export interface FormatStats {
    atmos: number;
    threeD: number;
    total: number;
}

export interface InsightData {
    formatStats: FormatStats;
    regionalPricing: PricingStat[];
    rigidityStats: RigidityStat[];
    metadata: {
        totalTheatres: number;
        totalStudios: number;
        timestamp: string;
    };
}
