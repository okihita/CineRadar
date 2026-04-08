'use client';

import { useState, useEffect } from 'react';
import { Theatre } from '../types';

export function useCinemaDetails(theatreId: string) {
    const [theatre, setTheatre] = useState<Theatre | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        async function fetchData() {
            setLoading(true);
            try {
                const res = await fetch(`/api/theatres/${theatreId}`);

                if (!res.ok) {
                    if (res.status === 404) throw new Error('Cinema not found');
                    throw new Error('Failed to fetch cinema details');
                }

                const theatreData = await res.json();
                setTheatre(theatreData);
            } catch (err: unknown) {
                setError(err instanceof Error ? err.message : 'An unknown error occurred');
            } finally {
                setLoading(false);
            }
        }

        if (theatreId) {
            fetchData();
        }
    }, [theatreId]);

    return { theatre, loading, error };
}
