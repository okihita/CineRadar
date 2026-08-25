'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import useSWR from 'swr';
import { fetcher } from '@/lib/api';
import { toast } from 'sonner';
import type { CinePointMovie, CinePointSyncMeta } from '@/features/competitors/types';

export interface CatalogData {
  movies: CinePointMovie[];
  pagination: { page: number; limit: number; total: number; total_pages: number; sort: string; dir: string };
  stats: {
    total_movies: number;
    local: number;
    international: number;
    matched: number;
    unmatched: number;
    with_poster: number;
    genres: string[];
  };
  sync: {
    status: string;
    total_movies: number;
    movies_scraped: number;
    pages_scraped: number;
    last_scraped_page: number;
    started_at: string | null;
    completed_at: string | null;
    error_message: string | null;
  } | null;
}

/** Hook for catalog data fetching, pagination, search, sort — backed by SWR */
export function useCatalogData() {
  const [page, setPage] = useState(0);
  const [typeFilter, setTypeFilter] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [sortCol, setSortCol] = useState<string>('release_date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  // Build SWR key from filter state
  const swrKey = (() => {
    const params = new URLSearchParams();
    params.set('page', String(page));
    params.set('limit', '24');
    params.set('sort', sortCol);
    params.set('dir', sortDir);
    if (typeFilter) params.set('type', typeFilter);
    if (search) params.set('search', search);
    return `/api/competitors/cinepoint/movies?${params}`;
  })();

  const { data, error, isLoading, mutate } = useSWR<{ success: boolean; data: CatalogData }>(
    swrKey,
    fetcher,
    { dedupingInterval: 30_000, keepPreviousData: true },
  );

  const fetchCatalog = useCallback(async () => { await mutate(); }, [mutate]);

  return {
    data: data?.success ? data.data : null,
    loading: isLoading,
    error: error ? error.message : null,
    page, setPage, typeFilter, setTypeFilter,
    search, setSearch, sortCol, setSortCol, sortDir, setSortDir,
    fetchCatalog,
  };
}

// ─── SSE Event Detection ─────────────────────────────────────

function detectEventType(d: Record<string, unknown>): string {
  if ('total_pages' in d && 'total_movies' in d) return 'discovered';
  if ('pages_validated' in d && 'remaining_pages' in d) return 'gate';
  if ('progress_pct' in d && 'total_scraped' in d) return 'page';
  if ('duration_sec' in d && 'total_movies' in d) return 'complete';
  if ('message' in d && !('total_movies' in d)) return 'log';
  return 'unknown';
}

/** Parse JWT exp claim */
export function getTokenExpiry(token: string): number | null {
  try {
    const parts = token.split('.');
    if (parts.length < 2) return null;
    const payload = JSON.parse(atob(parts[1]));
    return payload.exp ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
}

export interface SyncProgress {
  page: number;
  total: number;
  pct: number;
}

/** Hook for SSE sync streaming */
export function useSyncStream(fetchCatalog: () => Promise<void>) {
  const [syncing, setSyncing] = useState(false);
  const [syncToken, setSyncToken] = useState('');
  const [syncLogs, setSyncLogs] = useState<string[]>([]);
  const [syncProgress, setSyncProgress] = useState<SyncProgress | null>(null);
  const [showTokenInput, setShowTokenInput] = useState(false);
  const [gatePending, setGatePending] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const addLog = useCallback((msg: string) => {
    setSyncLogs((prev) => [...prev.slice(-50), msg]);
  }, []);

  const handleSSEEvent = useCallback((type: string, d: Record<string, unknown>) => {
    switch (type) {
      case 'discovered':
        setSyncProgress({ page: 0, total: d.total_pages as number, pct: 0 });
        addLog(`Discovered ${d.total_movies} movies across ${d.total_pages} pages`);
        break;
      case 'gate':
        addLog(`⏸ Gate — ${d.pages_validated} pages validated. ${d.remaining_pages} remaining (~${d.remaining_time_min}m)`);
        setGatePending(true);
        break;
      case 'page':
        setSyncProgress((prev) => ({
          page: (d.page as number) + 1,
          total: prev?.total ?? (d.page as number) + 1,
          pct: (d.progress_pct as number) ?? 0,
        }));
        addLog(`Page ${(d.page as number) + 1} → ${d.count} movies (${d.total_scraped} total)`);
        break;
      case 'complete':
        addLog(`✓ Complete — ${d.total_movies} movies in ${Math.round((d.duration_sec as number) / 60)}m`);
        setShowTokenInput(false);
        setGatePending(false);
        fetchCatalog();
        break;
      case 'log':
        addLog(d.message as string);
        break;
      case 'error':
        addLog(`✗ Error: ${d.message}`);
        setGatePending(false);
        break;
    }
  }, [addLog, fetchCatalog]);

  const startSync = useCallback(async () => {
    if (!syncToken.trim()) return;
    setSyncing(true);
    setSyncLogs([]);
    setSyncProgress(null);
    setGatePending(false);

    const ac = new AbortController();
    abortRef.current = ac;

    try {
      const res = await fetch('/api/competitors/cinepoint/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: syncToken.trim() }),
        signal: ac.signal,
      });

      if (!res.ok || !res.body) {
        const err = await res.text();
        addLog(`✗ Error: ${err || res.statusText}`);
        setSyncing(false);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('event: ')) continue;
          if (line.startsWith('data: ')) {
            try {
              const d = JSON.parse(line.slice(6));
              handleSSEEvent(detectEventType(d), d);
            } catch { /* skip malformed */ }
          }
        }
      }

      if (buffer.startsWith('data: ')) {
        try {
          const d = JSON.parse(buffer.slice(6));
          handleSSEEvent(detectEventType(d), d);
        } catch { /* skip */ }
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        addLog(`✗ Network error: ${(err as Error).message}`);
      }
    } finally {
      setSyncing(false);
      abortRef.current = null;
    }
  }, [syncToken, addLog, handleSSEEvent]);

  const resetSync = useCallback(async () => {
    try {
      await fetch('/api/competitors/cinepoint/reset', { method: 'POST' });
      setSyncLogs([]);
      setSyncProgress(null);
      setGatePending(false);
      fetchCatalog();
      toast.success('Sync state reset');
    } catch {
      toast.error('Failed to reset sync state');
    }
  }, [fetchCatalog]);

  const stopSync = useCallback(() => {
    abortRef.current?.abort();
    setSyncing(false);
    setGatePending(false);
  }, []);

  // Auto-refresh stats during sync
  useEffect(() => {
    if (!syncing) return;
    const interval = setInterval(fetchCatalog, 15000);
    return () => clearInterval(interval);
  }, [syncing, fetchCatalog]);

  // Token expiry
  const tokenExpiry = syncToken ? getTokenExpiry(syncToken) : null;
  const tokenExpiryMin = tokenExpiry ? Math.round((tokenExpiry - Date.now()) / 60000) : null;
  const tokenExpired = tokenExpiry ? tokenExpiry < Date.now() : false;

  return {
    syncing, syncToken, setSyncToken, syncLogs, syncProgress,
    showTokenInput, setShowTokenInput, gatePending,
    tokenExpiryMin, tokenExpired,
    startSync, resetSync, stopSync,
  };
}
