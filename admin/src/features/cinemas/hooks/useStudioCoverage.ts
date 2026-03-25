import useSWR from 'swr';

export interface StudioCoverageData {
    studio_progress: {
        total: number;
        scraped: number;
        percentage: number;
        v3_count: number;
        v2_count: number;
        confirmed_count: number;
        pending_count: number;
    };
    theatre_progress: {
        total: number;
        fully_scraped: number;
        partially_scraped: number;
        totally_missing: number;
        percentage: number;
    };
    missing_list: Array<{
        theatre_id: string;
        name: string;
        missing_studios: string[];
        total: number;
        scraped: number;
    }>;
}

const fetcher = (url: string): Promise<StudioCoverageData> => fetch(url).then(res => {
    if (!res.ok) throw new Error('Failed to fetch coverage');
    return res.json() as Promise<StudioCoverageData>;
});

export function useStudioCoverage() {
    const { data, error, isLoading, mutate } = useSWR<StudioCoverageData>(
        '/api/studios/coverage',
        fetcher,
        {
            revalidateOnFocus: false,
            refreshInterval: 3600000 // Refresh every hour in UI
        }
    );

    return {
        coverage: data,
        isLoading,
        isError: !!error,
        refresh: mutate
    };
}
