import useSWR from 'swr';

export interface Studio {
    studio_id: string;
    name: string;
    total_seats?: number;
    is_locked?: boolean;
    last_updated?: string;
}

const fetcher = (url: string) => fetch(url).then(res => {
    if (!res.ok) throw new Error('Failed to fetch studios');
    return res.json();
});

export function useTheatreStudios(theatreId?: string) {
    const { data, error, isLoading, mutate } = useSWR<Studio[]>(
        theatreId ? `/api/theatres/${theatreId}/studios` : null,
        fetcher
    );

    return {
        studios: data || [],
        isLoading,
        isError: !!error,
        refresh: mutate
    };
}
