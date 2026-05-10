/**
 * Shared hook for fetching CinePoint analysis data.
 *
 * Single source of truth for the API call — all consumer pages use this hook
 * instead of copy-pasting fetch + loading + error state.
 */

'use client';

import { useEffect, useState } from 'react';
import type { AnalysisMovie } from './types';

interface UseAnalysisDataReturn {
  movies: AnalysisMovie[];
  loading: boolean;
  error: string | null;
}

export function useAnalysisData(): UseAnalysisDataReturn {
  const [movies, setMovies] = useState<AnalysisMovie[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/competitors/cinepoint/analysis')
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((json) => {
        if (json.success) setMovies(json.data);
        else throw new Error(json.error || 'Failed to load');
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  return { movies, loading, error };
}
