'use client';

import useSWR from 'swr';
import { fetcher } from '@/lib/api';
import type { Theatre } from '../types';

interface TheatreResponse {
  success?: boolean;
  data?: Theatre;
  error?: string;
}

export function useCinemaDetails(theatreId: string | null) {
  const { data, error, isLoading, mutate } = useSWR<TheatreResponse>(
    theatreId ? `/api/theatres/${theatreId}` : null,
    fetcher,
    { dedupingInterval: 60_000 },
  );

  return {
    theatre: data?.data ?? null,
    loading: isLoading,
    error: error
      ? error.message
      : data && data.error
        ? data.error
        : null,
    refresh: mutate,
  };
}
