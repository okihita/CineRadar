'use client';

import { useState, useEffect } from 'react';
import { Theatre } from '../types';
import { ShowtimeSnapshot } from '@/features/performances_v2/components/ShowtimeTable';

export function useCinemaDetails(theatreId: string, date: string) {
    const [theatre, setTheatre] = useState<Theatre | null>(null);
    const [showtimes, setShowtimes] = useState<ShowtimeSnapshot[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        async function fetchData() {
            setLoading(true);
            try {
                const [theatreRes, showtimesRes] = await Promise.all([
                    fetch(`/api/theatres/${theatreId}`),
                    fetch(`/api/theatres/${theatreId}/showtimes?date=${date}`)
                ]);

                if (!theatreRes.ok) {
                    if (theatreRes.status === 404) throw new Error('Cinema not found');
                    throw new Error('Failed to fetch cinema details');
                }
                if (!showtimesRes.ok) throw new Error('Failed to fetch showtimes');

                const theatreData = await theatreRes.json();
                const showtimesData = await showtimesRes.json();

                setTheatre(theatreData);
                setShowtimes(showtimesData);
            } catch (err: any) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        }

        if (theatreId && date) {
            fetchData();
        }
    }, [theatreId, date]);

    return { theatre, showtimes, loading, error };
}
