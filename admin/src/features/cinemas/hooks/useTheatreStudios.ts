import useSWR from 'swr';
import { useState } from 'react';

export interface Seat {
    id: string;
    type: string;
    grade?: string; // PK: seat_grd_cd
    color?: string; // Legacy V3.2 support
}

export interface LayoutRow {
    row_name: string;
    seats: Seat[];
}

export interface PriceGroup {
    name: string;
    color: string;
    prices?: {
        mon_thu: number;
        fri: number;
        sat_sun: number;
    };
}

export interface PriceGroups {
    [seat_grd_cd: string]: PriceGroup;
}

export interface Evidence {
    movie: string;
    date: string;
    time: string;
    showtime_id: string;
    movie_id?: string;
    movie_title?: string;
    price?: number;
}

export interface PhysicalLayout {
    total_capacity: number;
    grid: LayoutRow[];
}

export interface Studio {
    id: string;
    room_category?: string;
    layout?: LayoutRow[]; // Legacy V1/V2 fallback
    physical_layout?: PhysicalLayout; // V3.2+ Single Source of Truth
    price_groups?: PriceGroups; // V3.3+ Normalized Metadata
    evidence?: Evidence[]; // V3.3.3 Atomic Evidence
    version: number;
    last_updated: string;
    is_locked?: boolean; // Manual override if needed
}

export interface PerformanceMetrics {
    latencyMs: number;
    sizeMB: number;
}

export function useTheatreStudios(theatreId: string | null) {
    const [metrics, setMetrics] = useState<PerformanceMetrics | null>(null);

    const fetcher = async (url: string) => {
        const start = performance.now();
        const response = await fetch(url);
        const end = performance.now();
        
        const data = await response.json();
        
        // Calculate size: Convert JSON to string length as a proxy for download size
        // (Since Content-Length might be missing in some environments)
        const sizeBytes = new TextEncoder().encode(JSON.stringify(data)).length;
        
        setMetrics({
            latencyMs: Math.round(end - start),
            sizeMB: parseFloat((sizeBytes / (1024 * 1024)).toFixed(3))
        });
        
        return data;
    };

    const { data, error, isLoading, mutate } = useSWR<Studio[]>(
        theatreId ? `/api/theatres/${theatreId}/studios` : null,
        fetcher,
        {
            revalidateOnFocus: false,
            dedupingInterval: 10000
        }
    );

    return {
        studios: data || [],
        isLoading,
        isError: !!error,
        refresh: mutate,
        metrics
    };
}
