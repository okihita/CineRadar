import useSWR from 'swr';

export interface Seat {
    id: string;
    type: string;
    grade?: string;
}

export interface LayoutRow {
    row_name: string;
    seats: Seat[];
}

export interface Audit {
    source: 'raw_initial_layout' | 'guessed_compressed_layout';
    method: 'multi_movie_consensus' | 'snapshot_inference';
    is_confirmed: boolean;
    confirmed_at?: string;
    confirmed_by?: string;
    version: number;
    sample_count?: number;
    audited_at?: string;
}

export interface Studio {
    studio_id: string;
    name: string;
    total_seats?: number;
    is_locked?: boolean;
    last_updated?: string;
    layout?: LayoutRow[];
    audit?: Audit;
    version?: number;
    room_category?: string;
    initial_layout_compressed?: unknown;
    created_at?: string;
    updated_at?: string;
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
