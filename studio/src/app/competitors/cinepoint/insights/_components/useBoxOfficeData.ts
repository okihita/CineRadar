'use client';

import { useCallback, useEffect, useState } from 'react';
import { format, subDays } from 'date-fns';
import type { CinePointMovie } from '@/features/competitors/types';
import type { BoxOfficeData, MovieRanking, YearSummary } from '@/lib/cinepoint';

export type RangePreset = '7d' | '14d' | '30d' | '90d';

export const RANGE_PRESETS: { value: RangePreset; label: string }[] = [
  { value: '7d', label: '7D' },
  { value: '14d', label: '14D' },
  { value: '30d', label: '30D' },
  { value: '90d', label: '90D' },
];

export function getPresetRange(preset: RangePreset) {
  const today = new Date();
  const to = format(today, 'yyyy-MM-dd');
  const days = { '7d': 7, '14d': 14, '30d': 30, '90d': 90 }[preset];
  return { from: format(subDays(today, days), 'yyyy-MM-dd'), to };
}

export function useBoxOfficeData() {
  const [data, setData] = useState<BoxOfficeData | null>(null);
  const [yearsData, setYearsData] = useState<{ success: boolean; years: YearSummary[]; total_years: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [yearsLoading, setYearsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [yearsError, setYearsError] = useState<string | null>(null);
  const [range, setRange] = useState<RangePreset>('30d');
  const [selectedMovie, setSelectedMovie] = useState<number | null>(null);
  const [enrichedMovie, setEnrichedMovie] = useState<CinePointMovie | null>(null);
  const [enrichedLoading, setEnrichedLoading] = useState(false);

  const loadData = useCallback(async (preset: RangePreset) => {
    setLoading(true);
    setError(null);
    try {
      const { from, to } = getPresetRange(preset);
      const res = await fetch(`/api/competitors/cinepoint/boxoffice?from=${from}&to=${to}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setData(json);
    } catch (e) {
      setError((e as Error).message || 'Failed to load box office data');
    }
    setLoading(false);
  }, []);

  const loadYears = useCallback(async () => {
    setYearsLoading(true);
    setYearsError(null);
    try {
      const res = await fetch('/api/competitors/cinepoint/boxoffice/years');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setYearsData(json);
    } catch (e) {
      setYearsError((e as Error).message || 'Failed to load yearly data');
    }
    setYearsLoading(false);
  }, []);

  useEffect(() => { loadData(range); }, [range, loadData]);

  useEffect(() => {
    if (selectedMovie === null) { setEnrichedMovie(null); return; }
    setEnrichedLoading(true);
    fetch(`/api/competitors/cinepoint/movies/${selectedMovie}/detail`)
      .then((r) => r.json())
      .then((json) => { setEnrichedMovie(json.success && json.data?.details_fetched_at ? json.data : null); })
      .catch(() => setEnrichedMovie(null))
      .finally(() => setEnrichedLoading(false));
  }, [selectedMovie]);

  return {
    data, yearsData, loading, yearsLoading, error, yearsError, range, setRange,
    selectedMovie, setSelectedMovie, enrichedMovie, enrichedLoading,
    loadData, loadYears,
  };
}
