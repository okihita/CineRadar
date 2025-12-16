'use client';

/**
 * useTheatres - Custom hook for fetching and managing theatre data
 * Following Single Responsibility Principle
 */

import { useState, useEffect } from 'react';
import { Theatre, ScraperRun } from '@/types';
import theatreService from '@/services/theatreService';

interface UseTheatresReturn {
    theatres: Theatre[];
    runs: ScraperRun[];
    loading: boolean;
    error: Error | null;
    refetch: () => Promise<void>;
}

export function useTheatres(): UseTheatresReturn {
    const [theatres, setTheatres] = useState<Theatre[]>([]);
    const [runs, setRuns] = useState<ScraperRun[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);

    const fetchData = async () => {
        try {
            setLoading(true);
            setError(null);

            const [theatreData, runData] = await Promise.all([
                theatreService.getTheatres(),
                theatreService.getScraperRuns(10)
            ]);

            setTheatres(theatreData);
            setRuns(runData);
        } catch (err) {
            setError(err instanceof Error ? err : new Error('Failed to fetch data'));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    return { theatres, runs, loading, error, refetch: fetchData };
}

export default useTheatres;
