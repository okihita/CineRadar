'use client';

/**
 * useCachedFetch - Generic hook for cached API fetching
 * Uses stale-while-revalidate pattern for instant display
 */

import { useState, useEffect, useCallback, useRef } from 'react';

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

interface CacheEntry<T> {
    data: T;
    timestamp: number;
}

function getCacheKey(url: string): string {
    return `cineradar_cache_${url}`;
}

function getCache<T>(url: string): CacheEntry<T> | null {
    if (typeof window === 'undefined') return null;
    try {
        const cached = localStorage.getItem(getCacheKey(url));
        if (!cached) return null;
        return JSON.parse(cached) as CacheEntry<T>;
    } catch {
        return null;
    }
}

function setCache<T>(url: string, data: T): void {
    if (typeof window === 'undefined') return;
    try {
        localStorage.setItem(getCacheKey(url), JSON.stringify({
            data,
            timestamp: Date.now(),
        }));
    } catch {
        // Ignore storage errors (quota exceeded, etc.)
    }
}

interface UseCachedFetchReturn<T> {
    data: T | null;
    loading: boolean;
    error: Error | null;
    refresh: () => Promise<void>;
    isStale: boolean;
    lastUpdated: Date | null;
}

export function useCachedFetch<T>(url: string): UseCachedFetchReturn<T> {
    const [data, setData] = useState<T | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);
    const [isStale, setIsStale] = useState(false);
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
    const fetchedRef = useRef(false);

    const fetchData = useCallback(async (useCache = true) => {
        try {
            // Check cache first
            if (useCache && !fetchedRef.current) {
                const cached = getCache<T>(url);
                if (cached) {
                    setData(cached.data);
                    setLastUpdated(new Date(cached.timestamp));
                    setLoading(false);

                    const isExpired = Date.now() - cached.timestamp > CACHE_TTL;
                    if (!isExpired) {
                        fetchedRef.current = true;
                        return;
                    }
                    setIsStale(true);
                }
            }

            setError(null);
            if (!data) setLoading(true);

            const response = await fetch(url);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);

            const newData = await response.json() as T;
            setData(newData);
            setIsStale(false);
            setLastUpdated(new Date());
            setCache(url, newData);
            fetchedRef.current = true;
        } catch (err) {
            setError(err instanceof Error ? err : new Error('Failed to fetch'));
        } finally {
            setLoading(false);
        }
    }, [url, data]);

    useEffect(() => {
        fetchedRef.current = false;
        fetchData(true);
    }, [url]); // eslint-disable-line react-hooks/exhaustive-deps

    return {
        data,
        loading,
        error,
        refresh: () => fetchData(false),
        isStale,
        lastUpdated,
    };
}

export default useCachedFetch;
