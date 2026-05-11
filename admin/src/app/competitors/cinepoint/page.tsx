'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Library,
  Loader2,
  Play,
  RotateCcw,
  Search,
  Film,
  Globe,
  CheckCircle2,
  AlertCircle,
  Database,
  Table2,
  LayoutGrid,
  ChevronUp,
  ChevronDown,
  ChevronRight,
  Bug,
  Timer,
  BarChart3,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import NextImage from 'next/image';
import type { CinePointMovie, CinePointSyncMeta } from '@/features/competitors/types';

// ─── Types ─────────────────────────────────────────────────

interface CatalogData {
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

// ─── Page Component ────────────────────────────────────────

export default function CinePointCatalogPage() {
  const router = useRouter();
  const [data, setData] = useState<CatalogData | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [typeFilter, setTypeFilter] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [syncToken, setSyncToken] = useState('');
  const [syncLogs, setSyncLogs] = useState<string[]>([]);
  const [syncProgress, setSyncProgress] = useState<{ page: number; total: number; pct: number } | null>(null);
  const [showTokenInput, setShowTokenInput] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('table');
  const [sortCol, setSortCol] = useState<string>('release_date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [showDebugCols, setShowDebugCols] = useState(false);
  const [gatePending, setGatePending] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  // Token expiry check
  const tokenExpiry = syncToken ? getTokenExpiry(syncToken) : null;
  const tokenExpiryMin = tokenExpiry ? Math.round((tokenExpiry - Date.now()) / 60000) : null;
  const tokenExpired = tokenExpiry ? tokenExpiry < Date.now() : false;

  const fetchCatalog = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('limit', '24');
      params.set('sort', sortCol);
      params.set('dir', sortDir);
      if (typeFilter) params.set('type', typeFilter);
      if (search) params.set('search', search);
      const res = await fetch(`/api/competitors/cinepoint/movies?${params}`);
      if (res.ok) {
        const json = await res.json();
        setData(json.data);
      }
    } catch (err) {
      console.error('[Catalog fetch error]', err);
    } finally {
      setLoading(false);
    }
  }, [page, typeFilter, search, sortCol, sortDir]);

  useEffect(() => {
    fetchCatalog();
  }, [fetchCatalog]);

  // Auto-refresh stats during sync
  useEffect(() => {
    if (!syncing) return;
    const interval = setInterval(fetchCatalog, 15000);
    return () => clearInterval(interval);
  }, [syncing, fetchCatalog]);

  const addLog = useCallback((msg: string) => {
    setSyncLogs((prev) => [...prev.slice(-50), msg]);
  }, []);

  // ── Sync via fetch + ReadableStream (not EventSource) ──
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
          if (line.startsWith('event: ')) {
            const event = line.slice(7).trim();
            // next line should be data:
            continue;
          }
          if (line.startsWith('data: ')) {
            const raw = line.slice(6);
            try {
              const d = JSON.parse(raw);
              const eventType = detectEventType(d);
              handleSSEEvent(eventType, d);
            } catch { /* skip malformed */ }
          }
        }
      }

      // Parse any remaining buffer
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
  }, [syncToken, addLog]);

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

  // Resume after gate
  const continueSync = useCallback(async () => {
    setGatePending(false);
    // The server pauses at gate — we need to signal continuation
    // For now, the gate is informational (server auto-continues)
    // TODO: implement real server-side pause if needed
  }, []);

  const resetSync = useCallback(async () => {
    await fetch('/api/competitors/cinepoint/reset', { method: 'POST' });
    setSyncLogs([]);
    setSyncProgress(null);
    setGatePending(false);
    fetchCatalog();
  }, [fetchCatalog]);

  const stopSync = useCallback(() => {
    abortRef.current?.abort();
    setSyncing(false);
    setGatePending(false);
  }, []);

  const syncMeta = data?.sync;
  const stats = data?.stats;
  const movies = data?.movies ?? [];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-30 w-full border-b border-border/40 bg-background/95 backdrop-blur-md">
        <div className="px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/20">
              <Library className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-base font-black uppercase tracking-tighter">CinePoint Catalog</h1>
              <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold opacity-60">
                Movie Database Sync
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link href="/competitors/cinepoint/analysis">
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-2 px-4 text-[10px] font-black uppercase tracking-wider rounded-xl border-border/60 hover:bg-muted transition-all"
              >
                <BarChart3 className="w-3.5 h-3.5" />
                Analysis
              </Button>
            </Link>
            <Button
              variant="outline"
              size="sm"
              onClick={resetSync}
              disabled={syncing}
              className="h-8 gap-2 px-4 text-[10px] font-black uppercase tracking-wider rounded-xl border-border/60 hover:bg-muted transition-all"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset
            </Button>
            {syncing && (
              <Button
                variant="destructive"
                size="sm"
                onClick={stopSync}
                className="h-8 gap-2 px-4 text-[10px] font-black uppercase tracking-wider rounded-xl"
              >
                Stop
              </Button>
            )}
            <Button
              variant={syncing ? 'secondary' : 'default'}
              size="sm"
              onClick={() => {
                if (syncing) return;
                setShowTokenInput(!showTokenInput);
              }}
              disabled={syncing}
              className="h-8 gap-2 px-4 text-[10px] font-black uppercase tracking-wider rounded-xl transition-all"
            >
              {syncing ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Syncing...
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5" />
                  Start Sync
                </>
              )}
            </Button>
          </div>
        </div>
      </header>

      <div className="px-6 py-8 space-y-6">
        {/* Token input */}
        {showTokenInput && !syncing && (
          <div className="p-4 rounded-2xl border border-border/40 bg-card shadow-sm animate-in fade-in slide-in-from-top-2 duration-300">
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/50 mb-3">
              Paste CinePoint Bearer Token
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                value={syncToken}
                onChange={(e) => setSyncToken(e.target.value)}
                placeholder="eyJhbGciOiJIUzI1NiIs..."
                className="flex-1 px-3 py-2 rounded-lg border border-border/40 bg-muted/5 text-xs font-mono focus:outline-none focus:border-primary/40"
              />
              <Button
                size="sm"
                onClick={startSync}
                disabled={!syncToken.trim() || tokenExpired}
                className="h-9 gap-2 px-4 text-[10px] font-black uppercase tracking-wider rounded-xl"
              >
                <Play className="w-3 h-3" />
                Go
              </Button>
            </div>
            <div className="flex items-center gap-4 mt-2">
              <p className="text-[9px] text-muted-foreground/30">
                Copy from browser DevTools → Network → any /bff/ request → Authorization header
              </p>
              {tokenExpiryMin !== null && (
                <span className={cn(
                  'text-[9px] font-bold flex items-center gap-1',
                  tokenExpired ? 'text-red-500' : tokenExpiryMin < 60 ? 'text-amber-500' : 'text-muted-foreground/30',
                )}>
                  <Timer className="w-2.5 h-2.5" />
                  {tokenExpired ? 'Token expired' : `${tokenExpiryMin}m remaining`}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Sync progress */}
        {(syncing || syncLogs.length > 0) && (
          <div className="p-4 rounded-2xl border border-border/40 bg-card shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {syncing ? (
                  <Loader2 className="w-4 h-4 animate-spin text-primary" />
                ) : (
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                )}
                <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">
                  Sync Progress
                </span>
              </div>
              {syncProgress && (
                <span className="text-[10px] font-mono text-muted-foreground/50">
                  {syncProgress.page}/{syncProgress.total} pages • {syncProgress.pct}%
                </span>
              )}
            </div>

            {syncProgress && (
              <div className="w-full h-1.5 bg-muted/50 rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all duration-500"
                  style={{ width: `${syncProgress.pct}%` }}
                />
              </div>
            )}

            {/* Gate confirmation */}
            {gatePending && (
              <div className="p-3 rounded-xl bg-amber-500/5 border border-amber-500/20 flex items-center justify-between">
                <span className="text-[10px] font-bold text-amber-600">
                  ⏸ 3 pages validated. Ready to continue full backfill?
                </span>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={stopSync} className="h-7 text-[9px] rounded-lg">
                    Cancel
                  </Button>
                  <Button size="sm" onClick={continueSync} className="h-7 text-[9px] rounded-lg">
                    Continue All
                  </Button>
                </div>
              </div>
            )}

            <div className="max-h-[120px] overflow-y-auto space-y-0.5">
              {syncLogs.map((log, i) => (
                <p key={i} className="text-[10px] font-mono text-muted-foreground/50">{log}</p>
              ))}
            </div>
          </div>
        )}

        {/* Stats bar */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
            <StatCard icon={Database} label="Total" value={stats.total_movies} />
            <StatCard icon={Film} label="Local" value={stats.local} />
            <StatCard icon={Globe} label="International" value={stats.international} />
            <StatCard icon={CheckCircle2} label="Matched" value={stats.matched} color="text-emerald-500" />
            <StatCard icon={AlertCircle} label="Unmatched" value={stats.unmatched} color="text-amber-500" />
            <StatCard icon={Film} label="With Poster" value={stats.with_poster} />
          </div>
        )}

        {/* Filters + View Toggle */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/40" />
            <input
              type="text"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(0); }}
              placeholder="Search titles..."
              className="w-full pl-9 pr-3 py-2 rounded-lg border border-border/40 bg-muted/5 text-xs focus:outline-none focus:border-primary/40"
            />
          </div>

          <div className="flex gap-1.5">
            {[null, 'local', 'international'].map((t) => (
              <button
                key={t ?? 'all'}
                onClick={() => { setTypeFilter(t); setPage(0); }}
                className={cn(
                  'px-3 py-1.5 rounded-lg border text-[9px] font-black uppercase tracking-widest transition-all',
                  typeFilter === t
                    ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                    : 'bg-muted/5 border-border/30 hover:bg-muted/20 text-muted-foreground',
                )}
              >
                {t ?? 'All'}
              </button>
            ))}
          </div>

          <div className="flex gap-1 ml-auto">
            <button
              onClick={() => setShowDebugCols(!showDebugCols)}
              className={cn(
                'p-2 rounded-lg border transition-all',
                showDebugCols
                  ? 'bg-amber-500/10 border-amber-500/30 text-amber-600'
                  : 'bg-muted/5 border-border/30 text-muted-foreground/30 hover:text-muted-foreground',
              )}
              title="Toggle debug columns"
            >
              <Bug className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={cn(
                'p-2 rounded-lg border transition-all',
                viewMode === 'table'
                  ? 'bg-primary/10 border-primary/30 text-primary'
                  : 'bg-muted/5 border-border/30 text-muted-foreground/40 hover:text-muted-foreground',
              )}
              title="Table view"
            >
              <Table2 className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={cn(
                'p-2 rounded-lg border transition-all',
                viewMode === 'grid'
                  ? 'bg-primary/10 border-primary/30 text-primary'
                  : 'bg-muted/5 border-border/30 text-muted-foreground/40 hover:text-muted-foreground',
              )}
              title="Grid view"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Query info bar */}
        {data && !loading && (
          <div className="flex items-center gap-4 px-3 py-2 rounded-xl bg-muted/10 border border-border/20">
            <span className="text-[9px] font-mono text-muted-foreground/40">
              SELECT * FROM cinepoint_movies
              {typeFilter ? ` WHERE type = '${typeFilter}'` : ''}
              {search ? ` AND title_cp LIKE '%${search}%'` : ''}
              {' ORDER BY '}{sortCol} {sortDir.toUpperCase()}
            </span>
            <span className="text-[9px] font-mono text-primary/50 ml-auto">
              {data.pagination.total} rows → page {data.pagination.page + 1}/{data.pagination.total_pages}
            </span>
          </div>
        )}

        {/* Content */}
        {loading ? (
          <div className="py-32 flex flex-col items-center justify-center gap-4">
            <Loader2 className="w-8 h-8 animate-spin text-primary opacity-40" />
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground/40">
              Loading Catalog...
            </p>
          </div>
        ) : movies.length > 0 ? (
          <>
            {viewMode === 'grid' ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {movies.map((movie) => (
                  <MovieCard key={movie.id} movie={movie} />
                ))}
              </div>
            ) : (
              <DataTable
                movies={movies}
                sortCol={sortCol}
                sortDir={sortDir}
                showDebugCols={showDebugCols}
                onSort={(col) => {
                  if (sortCol === col) {
                    setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
                  } else {
                    setSortCol(col);
                    setSortDir('asc');
                  }
                  setPage(0);
                }}
                onRowClick={(id) => router.push(`/competitors/cinepoint/movies/${id}`)}
              />
            )}

            {/* Pagination */}
            {data && data.pagination.total_pages > 1 && (
              <div className="flex items-center justify-center gap-2 pt-8">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page === 0}
                  onClick={() => setPage(page - 1)}
                  className="h-8 px-4 text-[10px] font-black uppercase tracking-wider rounded-xl"
                >
                  Previous
                </Button>
                <span className="text-[10px] font-mono text-muted-foreground/50 px-3">
                  Page {page + 1} / {data.pagination.total_pages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= data.pagination.total_pages - 1}
                  onClick={() => setPage(page + 1)}
                  className="h-8 px-4 text-[10px] font-black uppercase tracking-wider rounded-xl"
                >
                  Next
                </Button>
              </div>
            )}
          </>
        ) : (
          <div className="py-16 text-center border-2 border-dashed rounded-[2.5rem] border-border/40 bg-muted/5">
            <div className="w-12 h-12 rounded-full bg-muted mx-auto mb-4 flex items-center justify-center">
              <Library className="w-6 h-6 text-muted-foreground/40" />
            </div>
            <p className="text-muted-foreground text-xs font-bold uppercase tracking-widest">
              No movies in catalog yet.
            </p>
            <p className="text-muted-foreground/50 text-[10px] mt-2 uppercase tracking-tight font-medium">
              Click &quot;Start Sync&quot; above to begin scraping from CinePoint
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Helpers ───────────────────────────────────────────────

function getTokenExpiry(token: string): number | null {
  try {
    const parts = token.split('.');
    if (parts.length < 2) return null;
    const payload = JSON.parse(atob(parts[1]));
    return payload.exp ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
}

/** Detect event type from SSE data payload */
function detectEventType(d: Record<string, unknown>): string {
  if ('total_pages' in d && 'total_movies' in d) return 'discovered';
  if ('pages_validated' in d && 'remaining_pages' in d) return 'gate';
  if ('progress_pct' in d && 'total_scraped' in d) return 'page';
  if ('duration_sec' in d && 'total_movies' in d) return 'complete';
  if ('message' in d && !('total_movies' in d)) return 'log';
  return 'unknown';
}

// ─── Sub-components ────────────────────────────────────────

// ─── DataTable ─────────────────────────────────────────────

interface DataTableProps {
  movies: CinePointMovie[];
  sortCol: string;
  sortDir: 'asc' | 'desc';
  showDebugCols: boolean;
  onSort: (col: string) => void;
  onRowClick: (id: number) => void;
}

type ColDef = { key: string; label: string; align?: 'left' | 'right' | 'center'; debug?: boolean };

const COLUMNS: ColDef[] = [
  { key: 'id', label: 'id', align: 'right' },
  { key: 'poster', label: 'poster', align: 'center' },
  { key: 'title', label: 'title' },
  { key: 'title_cp', label: 'title_cp', debug: true },
  { key: 'type', label: 'type', align: 'center' },
  { key: 'movie_genre', label: 'genre' },
  { key: 'release_date', label: 'release_date' },
  { key: 'duration', label: 'dur', align: 'right' },
  { key: 'matched', label: 'matched', align: 'center' },
];

function DataTable({ movies, sortCol, sortDir, showDebugCols, onSort, onRowClick }: DataTableProps) {
  const visibleCols = COLUMNS.filter((c) => !c.debug || showDebugCols);

  return (
    <div className="rounded-2xl border border-border/40 bg-card overflow-hidden shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-border/30 bg-muted/20">
              {visibleCols.map((col) => (
                <th
                  key={col.key}
                  onClick={() => col.key !== 'poster' && onSort(col.key)}
                  className={cn(
                    'px-3 py-2.5 text-[8px] font-black uppercase tracking-[0.15em] select-none transition-colors whitespace-nowrap',
                    col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left',
                    col.key === 'poster' ? 'cursor-default' : 'cursor-pointer',
                    sortCol === col.key ? 'text-primary/70 bg-primary/5' : 'text-muted-foreground/30 hover:text-muted-foreground/60 hover:bg-muted/30',
                  )}
                >
                  <span className="inline-flex items-center gap-1">
                    {col.label}
                    {sortCol === col.key && (
                      sortDir === 'asc' ? <ChevronUp className="w-2.5 h-2.5" /> : <ChevronDown className="w-2.5 h-2.5" />
                    )}
                  </span>
                </th>
              ))}
              <th className="px-3 w-6" />
            </tr>
          </thead>

          <tbody>
            {movies.map((movie) => (
              <tr
                key={movie.id}
                onClick={() => onRowClick(movie.id)}
                className="border-b border-border/10 hover:bg-primary/[0.02] transition-colors group cursor-pointer"
              >
                {/* id */}
                <td className="px-3 py-2 text-[10px] font-mono text-muted-foreground/50 text-right">
                  {movie.id}
                </td>

                {/* poster */}
                <td className="px-3 py-1.5 text-center">
                  <div className="w-6 h-8 rounded overflow-hidden bg-muted/30 mx-auto relative">
                    {movie.image_title ? (
                      <NextImage
                        src={movie.image_title}
                        alt=""
                        fill
                        className="object-cover"
                        sizes="24px"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Film className="w-2.5 h-2.5 text-muted-foreground/20" />
                      </div>
                    )}
                  </div>
                </td>

                {/* title */}
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold text-foreground/90 group-hover:text-primary transition-colors">
                      {movie.title}
                    </span>
                    {movie.details_fetched_at && (
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" title="Details enriched" />
                    )}
                  </div>
                </td>

                {/* title_cp (debug) */}
                {showDebugCols && (
                  <td className="px-3 py-2">
                    <span className="text-[10px] font-mono text-amber-500/40">
                      {movie.title_cp}
                    </span>
                  </td>
                )}

                {/* type */}
                <td className="px-3 py-2 text-center">
                  <span className={cn(
                    'inline-block text-[8px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full',
                    movie.type === 'local'
                      ? 'bg-blue-500/10 text-blue-600 border border-blue-500/20'
                      : 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20',
                  )}>
                    {movie.type}
                  </span>
                </td>

                {/* genre */}
                <td className="px-3 py-2">
                  <div className="flex flex-wrap gap-1">
                    {movie.movie_genre.map((g) => (
                      <span key={g} className="text-[8px] font-medium text-muted-foreground/40 bg-muted/30 px-1.5 py-0.5 rounded">
                        {g}
                      </span>
                    ))}
                    {movie.movie_genre.length === 0 && (
                      <span className="text-[8px] text-muted-foreground/20">—</span>
                    )}
                  </div>
                </td>

                {/* release_date */}
                <td className="px-3 py-2">
                  <span className="text-[10px] font-mono text-muted-foreground/50">
                    {movie.release_date}
                  </span>
                </td>

                {/* duration */}
                <td className="px-3 py-2 text-right">
                  <span className="text-[10px] font-mono text-muted-foreground/40">
                    {movie.duration > 0 ? `${movie.duration}m` : '—'}
                  </span>
                </td>

                {/* matched */}
                <td className="px-3 py-2 text-center">
                  {movie.matched_movie_id ? (
                    <span className="inline-flex items-center gap-1 text-[8px] font-bold text-emerald-600 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                      <CheckCircle2 className="w-2.5 h-2.5" />
                      Yes
                    </span>
                  ) : (
                    <span className="text-[8px] text-muted-foreground/20">—</span>
                  )}
                </td>

                {/* chevron */}
                <td className="px-3">
                  <ChevronRight className="w-3 h-3 text-muted-foreground/20 group-hover:text-primary/40 transition-colors" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="px-4 py-2 border-t border-border/20 bg-muted/10 flex items-center justify-between">
        <span className="text-[9px] font-mono text-muted-foreground/30">
          {movies.length} row{movies.length !== 1 ? 's' : ''} in page
        </span>
        <span className="text-[9px] font-mono text-muted-foreground/20">
          ORDER BY {sortCol} {sortDir.toUpperCase()}
        </span>
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color }: { icon: typeof Database; label: string; value: number; color?: string }) {
  return (
    <div className="px-4 py-3 rounded-xl border border-border/40 bg-card">
      <div className="flex items-center gap-2 mb-1">
        <Icon className={cn('w-3 h-3', color || 'text-muted-foreground/40')} />
        <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/40">{label}</span>
      </div>
      <p className={cn('text-lg font-black tracking-tight', color || 'text-foreground')}>{value.toLocaleString()}</p>
    </div>
  );
}

function MovieCard({ movie }: { movie: CinePointMovie }) {
  return (
    <Link href={`/competitors/cinepoint/movies/${movie.id}`} className="group rounded-2xl border border-border/40 bg-card overflow-hidden shadow-sm hover:shadow-xl hover:border-primary/20 transition-all duration-300 block">
      <div className="relative aspect-[2/3] bg-muted/20 overflow-hidden">
        {movie.image_title ? (
          <NextImage
            src={movie.image_title}
            alt={movie.title}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-500"
            sizes="200px"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Film className="w-8 h-8 text-muted-foreground/20" />
          </div>
        )}
        <div className={cn(
          'absolute top-2 left-2 px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider',
          movie.type === 'local'
            ? 'bg-blue-500/80 text-white'
            : 'bg-emerald-500/80 text-white',
        )}>
          {movie.type === 'local' ? 'ID' : 'INT'}
        </div>
        {movie.matched_movie_id && (
          <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center">
            <CheckCircle2 className="w-3 h-3 text-white" />
          </div>
        )}
      </div>
      <div className="p-3 space-y-1.5">
        <p className="text-[12px] font-bold leading-tight line-clamp-2 group-hover:text-primary transition-colors">
          {movie.title}
        </p>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-muted-foreground/50 font-mono">{movie.release_date}</span>
          {movie.duration > 0 && (
            <span className="text-[10px] text-muted-foreground/30">{movie.duration}m</span>
          )}
        </div>
        {movie.movie_genre.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {movie.movie_genre.slice(0, 2).map((g) => (
              <span key={g} className="text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-muted/50 text-muted-foreground/50">
                {g}
              </span>
            ))}
          </div>
        )}
      </div>
    </Link>
  );
}
