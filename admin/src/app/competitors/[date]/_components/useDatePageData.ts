'use client';

import { useCallback, useEffect, useState } from 'react';
import type {
  CompetitorSnapshot,
  ComparisonRow,
  ComparisonSummary,
  CineRadarMovie,
  CumulativeMovieTrack,
} from '@/features/competitors/types';

export interface PageData {
  snapshot: CompetitorSnapshot | null;
  comparison: { rows: ComparisonRow[]; summary: ComparisonSummary } | null;
  cr_movies: CineRadarMovie[];
  cinema_count: number;
}

export function useDatePageData(date: string) {
  const [data, setData] = useState<PageData | null>(null);
  const [cumulative, setCumulative] = useState<CumulativeMovieTrack[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/competitors/${date}`);
      if (res.ok) {
        const json = await res.json();
        setData(json.data);
      } else {
        setError(`Failed to load data for ${date} (HTTP ${res.status}). Please try refreshing.`);
      }
    } catch (err) {
      console.error('[Competitor fetch error]', err);
      setError('Failed to load competitor data. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => {
    fetchData();
    // Fetch cumulative box office data (one-time, cached by browser)
    fetch('/api/competitors/cumulative')
      .then((r) => r.json())
      .then((json) => {
        if (json.success) setCumulative(json.data || []);
      })
      .catch(() => {});
  }, [fetchData]);

  return { data, cumulative, loading, error, fetchData };
}
