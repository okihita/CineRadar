'use client';

import { useMemo } from 'react';
import { REGION_CITIES, getRegion } from '@/lib/regions';
import type { Theatre, RegionBreakdown } from '../types';

/**
 * High-performance analytics hook for the Cinema Registry.
 * Derives merchant and regional distributions from the master dataset.
 */
export function useCinemaAnalytics(theatres: Theatre[] = [], selectedMerchant: string) {
    // Ensure theatres is an array to prevent "map is not a function" errors
    const safeTheatres = useMemo(() => Array.isArray(theatres) ? theatres : [], [theatres]);

    // 1. Merchant Breakdown (Chain Distribution)
    const merchantBreakdown = useMemo(() => {
        const merchants = [...new Set(safeTheatres.map((t) => t.merchant))].filter(Boolean).sort();
        return merchants
            .map((m) => ({
                name: m,
                count: safeTheatres.filter((t) => t.merchant === m).length,
            }))
            .sort((a, b) => b.count - a.count);
    }, [safeTheatres]);

    // 2. Filter theatres by merchant for region calculation
    const merchantFilteredTheatres = useMemo(() => {
        return selectedMerchant === 'all'
            ? safeTheatres
            : safeTheatres.filter((t) => t.merchant === selectedMerchant);
    }, [safeTheatres, selectedMerchant]);

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
        totalSeats: useMemo(() => safeTheatres.reduce((acc, t) => acc + (t.total_capacity || 0), 0), [safeTheatres]),
        totalStudios: useMemo(() => safeTheatres.reduce((acc, t) => acc + (t.studio_count || 0), 0), [safeTheatres])
    };
}
