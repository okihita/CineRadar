'use client';

import { useMemo } from 'react';
import { REGION_CITIES, getRegion } from '@/lib/regions';
import type { Theatre, RegionBreakdown } from '../types';

/**
 * High-performance analytics hook for the Cinema Registry.
 * Derives merchant and regional distributions from the master dataset.
 */
export function useCinemaAnalytics(theatres: Theatre[], selectedMerchant: string) {
    // 1. Merchant Breakdown (Chain Distribution)
    const merchantBreakdown = useMemo(() => {
        const merchants = [...new Set(theatres.map((t) => t.merchant))].filter(Boolean).sort();
        return merchants
            .map((m) => ({
                name: m,
                count: theatres.filter((t) => t.merchant === m).length,
            }))
            .sort((a, b) => b.count - a.count);
    }, [theatres]);

    // 2. Filter theatres by merchant for region calculation
    const merchantFilteredTheatres = useMemo(() => {
        return selectedMerchant === 'all'
            ? theatres
            : theatres.filter((t) => t.merchant === selectedMerchant);
    }, [theatres, selectedMerchant]);

    // 3. Region Breakdown (Regional Density)
    const regionBreakdown = useMemo(() => {
        const breakdown = Object.keys(REGION_CITIES)
            .map((region) => ({
                name: region,
                count: merchantFilteredTheatres.filter((t) => getRegion(t.city) === region).length,
            }))
            .filter((r) => r.count > 0)
            .sort((a, b) => b.count - a.count);

        const othersCount = merchantFilteredTheatres.filter(
            (t) => getRegion(t.city) === 'Others'
        ).length;
        
        if (othersCount > 0) {
            breakdown.push({ name: 'Others', count: othersCount });
        }

        return breakdown as RegionBreakdown[];
    }, [merchantFilteredTheatres]);

    return {
        merchantBreakdown,
        regionBreakdown,
        totalSeats: useMemo(() => theatres.reduce((acc, t) => acc + (t.total_capacity || 0), 0), [theatres]),
        totalStudios: useMemo(() => theatres.reduce((acc, t) => acc + (t.studio_count || 0), 0), [theatres])
    };
}
