'use client';

/**
 * useTheatres - Custom hook for fetching and managing theatre data
 * With caching for faster perceived loading
 */

import { useState, useEffect, useCallback } from 'react';
import { Theatre, ScraperRun } from '@/types';
import theatreService from '@/services/theatreService';

const CACHE_KEY = 'cineradar_theatres_cache';
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

interface CacheData {
    theatres: Theatre[];
    runs: ScraperRun[];
    timestamp: number;
}

function getCache(): CacheData | null {
    if (typeof window === 'undefined') return null;
    try {
        const cached = localStorage.getItem(CACHE_KEY);
        if (!cached) return null;
        const data = JSON.parse(cached) as CacheData;
        return data;
    } catch {
        return null;
    }
}

function setCache(data: CacheData): void {
    if (typeof window === 'undefined') return;
    try {
        localStorage.setItem(CACHE_KEY, JSON.stringify(data));
    } catch {
        // Ignore storage errors
    }
}

interface UseTheatresReturn {
    theatres: Theatre[];
    runs: ScraperRun[];
    loading: boolean;
    error: Error | null;
    refetch: () => Promise<void>;
    isStale: boolean;
}

export function useTheatres(): UseTheatresReturn {
    const [theatres, setTheatres] = useState<Theatre[]>([]);
    const [runs, setRuns] = useState<ScraperRun[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);
    const [isStale, setIsStale] = useState(false);

    const fetchData = useCallback(async (useCache = true) => {
        try {
            // Check cache first for instant display
            if (useCache) {
                const cached = getCache();
                if (cached && cached.theatres.length > 0) {
                    setTheatres(cached.theatres);
                    setRuns(cached.runs);
                    setLoading(false);

                    // Check if cache is stale
                    const isExpired = Date.now() - cached.timestamp > CACHE_TTL;
                    if (!isExpired) {
                        return; // Cache is fresh, no need to refetch
                    }
                    setIsStale(true);
                    // Continue to fetch fresh data in background
                }
            }

            setError(null);
            if (!theatres.length) setLoading(true);

            const [theatreData, runData] = await Promise.all([
                theatreService.getTheatres(),
                theatreService.getScraperRuns(10)
            ]);

            setTheatres(theatreData);
            setRuns(runData);
            setIsStale(false);

            // Update cache
            setCache({
                theatres: theatreData,
                runs: runData,
                timestamp: Date.now(),
            });
        } catch (err) {
            setError(err instanceof Error ? err : new Error('Failed to fetch data'));
        } finally {
            setLoading(false);
        }
    }, [theatres.length]);

    useEffect(() => {
        fetchData(true);
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    return { theatres, runs, loading, error, refetch: () => fetchData(false), isStale };
}

export default useTheatres;

