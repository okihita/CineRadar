/**
 * Shared hook for fetching CinePoint analysis data.
 *
 * Uses SWR for automatic caching, deduplication, and revalidation.
 */

'use client';

import useSWR from 'swr';
import { fetcher } from '@/lib/api';
import type { AnalysisMovie } from './types';

interface AnalysisResponse {
  success: boolean;
  data: AnalysisMovie[];
  error?: string;
}

export function useAnalysisData() {
  const { data, error, isLoading, mutate } = useSWR<AnalysisResponse>(
    '/api/competitors/cinepoint/analysis',
    fetcher,
    { dedupingInterval: 60_000 },
  );

  return {
    movies: data?.success ? data.data : [],
    loading: isLoading,
    error: error ? error.message : data && !data.success ? (data.error ?? 'Failed to load') : null,
    refresh: mutate,
  };
}
