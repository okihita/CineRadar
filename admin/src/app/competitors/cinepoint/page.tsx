'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Library, Loader2, Play, RotateCcw, Search, Film, Globe,
  CheckCircle2, AlertCircle, Database, Table2, LayoutGrid, Bug,
  Timer, BarChart3,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { PageLoader } from '@/components/cinepoint/PageShell';
import { useCatalogData, useSyncStream } from './_components/useCatalogData';
import { DataTable, MovieCard, StatCard } from './_components/CatalogViews';

// ─── Page Component (Thin Orchestrator) ─────────────────────

export default function CinePointCatalogPage() {
  const router = useRouter();
  const {
    data, loading, page, setPage, typeFilter, setTypeFilter,
    search, setSearch, sortCol, setSortCol, sortDir, setSortDir, fetchCatalog,
  } = useCatalogData();

  const {
    syncing, syncToken, setSyncToken, syncLogs, syncProgress,
    showTokenInput, setShowTokenInput, gatePending,
    tokenExpiryMin, tokenExpired,
    startSync, resetSync, stopSync,
  } = useSyncStream(fetchCatalog);

  const stats = data?.stats;
  const movies = data?.movies ?? [];
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('table');
  const [showDebugCols, setShowDebugCols] = useState(false);

  return (
    <div className="px-6 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/20">
            <Library className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-base font-black uppercase tracking-tighter">CinePoint Catalog</h1>
            <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold opacity-60">Movie Database Sync</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/competitors/cinepoint/analysis">
            <Button variant="outline" size="sm" className="h-8 gap-2 px-4 text-[10px] font-black uppercase tracking-wider rounded-xl border-border/60 hover:bg-muted transition-all">
              <BarChart3 className="w-3.5 h-3.5" /> Analysis
            </Button>
          </Link>
          <Button variant="outline" size="sm" onClick={resetSync} disabled={syncing} className="h-8 gap-2 px-4 text-[10px] font-black uppercase tracking-wider rounded-xl border-border/60 hover:bg-muted transition-all">
            <RotateCcw className="w-3.5 h-3.5" /> Reset
          </Button>
          {syncing && (
            <Button variant="destructive" size="sm" onClick={stopSync} className="h-8 gap-2 px-4 text-[10px] font-black uppercase tracking-wider rounded-xl">Stop</Button>
          )}
          <Button variant={syncing ? 'secondary' : 'default'} size="sm"
            onClick={() => { if (!syncing) setShowTokenInput(!showTokenInput); }}
            disabled={syncing}
            className="h-8 gap-2 px-4 text-[10px] font-black uppercase tracking-wider rounded-xl transition-all">
            {syncing ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Syncing...</> : <><Play className="w-3.5 h-3.5" /> Start Sync</>}
          </Button>
        </div>
      </div>

      {/* Token input */}
      {showTokenInput && !syncing && (
        <div className="p-4 rounded-2xl border border-border/40 bg-card shadow-sm animate-in fade-in slide-in-from-top-2 duration-300">
          <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/50 mb-3">Paste CinePoint Bearer Token</p>
          <div className="flex gap-2">
            <input type="text" value={syncToken} onChange={(e) => setSyncToken(e.target.value)} placeholder="eyJhbGciOiJIUzI1NiIs..."
              className="flex-1 px-3 py-2 rounded-lg border border-border/40 bg-muted/5 text-xs font-mono focus:outline-none focus:border-primary/40" />
            <Button size="sm" onClick={startSync} disabled={!syncToken.trim() || tokenExpired} className="h-9 gap-2 px-4 text-[10px] font-black uppercase tracking-wider rounded-xl">
              <Play className="w-3 h-3" /> Go
            </Button>
          </div>
          <div className="flex items-center gap-4 mt-2">
            <p className="text-[9px] text-muted-foreground/30">Copy from browser DevTools → Network → any /bff/ request → Authorization header</p>
            {tokenExpiryMin !== null && (
              <span className={cn('text-[9px] font-bold flex items-center gap-1',
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
              {syncing ? <Loader2 className="w-4 h-4 animate-spin text-primary" /> : <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
              <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">Sync Progress</span>
            </div>
            {syncProgress && <span className="text-[10px] font-mono text-muted-foreground/50">{syncProgress.page}/{syncProgress.total} pages • {syncProgress.pct}%</span>}
          </div>
          {syncProgress && (
            <div className="w-full h-1.5 bg-muted/50 rounded-full overflow-hidden">
              <div className="h-full bg-primary rounded-full transition-all duration-500" style={{ width: `${syncProgress.pct}%` }} />
            </div>
          )}
          {gatePending && (
            <div className="p-3 rounded-xl bg-amber-500/5 border border-amber-500/20 flex items-center justify-between">
              <span className="text-[10px] font-bold text-amber-600">⏸ 3 pages validated. Ready to continue full backfill?</span>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={stopSync} className="h-7 text-[9px] rounded-lg">Cancel</Button>
                <Button size="sm" onClick={() => {}} className="h-7 text-[9px] rounded-lg">Continue All</Button>
              </div>
            </div>
          )}
          <div className="max-h-[120px] overflow-y-auto space-y-0.5">
            {syncLogs.map((log, i) => (<p key={i} className="text-[10px] font-mono text-muted-foreground/50">{log}</p>))}
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
          <input type="text" value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} placeholder="Search titles..."
            className="w-full pl-9 pr-3 py-2 rounded-lg border border-border/40 bg-muted/5 text-xs focus:outline-none focus:border-primary/40" />
        </div>
        <div className="flex gap-1.5">
          {[null, 'local', 'international'].map((t) => (
            <button key={t ?? 'all'} onClick={() => { setTypeFilter(t); setPage(0); }}
              className={cn('px-3 py-1.5 rounded-lg border text-[9px] font-black uppercase tracking-widest transition-all',
                typeFilter === t ? 'bg-primary text-primary-foreground border-primary shadow-sm' : 'bg-muted/5 border-border/30 hover:bg-muted/20 text-muted-foreground',
              )}>
              {t ?? 'All'}
            </button>
          ))}
        </div>
        <div className="flex gap-1 ml-auto">
          <button onClick={() => setShowDebugCols(!showDebugCols)}
            className={cn('p-2 rounded-lg border transition-all',
              showDebugCols ? 'bg-amber-500/10 border-amber-500/30 text-amber-600' : 'bg-muted/5 border-border/30 text-muted-foreground/30 hover:text-muted-foreground',
            )} title="Toggle debug columns"><Bug className="w-3.5 h-3.5" /></button>
          <button onClick={() => setViewMode('table')}
            className={cn('p-2 rounded-lg border transition-all',
              viewMode === 'table' ? 'bg-primary/10 border-primary/30 text-primary' : 'bg-muted/5 border-border/30 text-muted-foreground/40 hover:text-muted-foreground',
            )} title="Table view"><Table2 className="w-3.5 h-3.5" /></button>
          <button onClick={() => setViewMode('grid')}
            className={cn('p-2 rounded-lg border transition-all',
              viewMode === 'grid' ? 'bg-primary/10 border-primary/30 text-primary' : 'bg-muted/5 border-border/30 text-muted-foreground/40 hover:text-muted-foreground',
            )} title="Grid view"><LayoutGrid className="w-3.5 h-3.5" /></button>
        </div>
      </div>

      {/* Query info bar */}
      {data && !loading && (
        <div className="flex items-center gap-4 px-3 py-2 rounded-xl bg-muted/10 border border-border/20">
          <span className="text-[9px] font-mono text-muted-foreground/40">
            SELECT * FROM cinepoint_movies{typeFilter ? ` WHERE type = '${typeFilter}'` : ''}{search ? ` AND title_cp LIKE '%${search}%'` : ''}{' ORDER BY '}{sortCol} {sortDir.toUpperCase()}
          </span>
          <span className="text-[9px] font-mono text-primary/50 ml-auto">{data.pagination.total} rows → page {data.pagination.page + 1}/{data.pagination.total_pages}</span>
        </div>
      )}

      {/* Content */}
      {loading ? (
        <PageLoader message="Loading Catalog..." />
      ) : movies.length > 0 ? (
        <>
          {viewMode === 'grid' ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {movies.map((movie) => <MovieCard key={movie.id} movie={movie} />)}
            </div>
          ) : (
            <DataTable movies={movies} sortCol={sortCol} sortDir={sortDir} showDebugCols={showDebugCols}
              onSort={(col) => { if (sortCol === col) setSortDir(sortDir === 'asc' ? 'desc' : 'asc'); else { setSortCol(col); setSortDir('asc'); } setPage(0); }}
              onRowClick={(id) => router.push(`/competitors/cinepoint/movies/${id}`)} />
          )}
          {data && data.pagination.total_pages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-8">
              <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(page - 1)}
                className="h-8 px-4 text-[10px] font-black uppercase tracking-wider rounded-xl">Previous</Button>
              <span className="text-[10px] font-mono text-muted-foreground/50 px-3">Page {page + 1} / {data.pagination.total_pages}</span>
              <Button variant="outline" size="sm" disabled={page >= data.pagination.total_pages - 1} onClick={() => setPage(page + 1)}
                className="h-8 px-4 text-[10px] font-black uppercase tracking-wider rounded-xl">Next</Button>
            </div>
          )}
        </>
      ) : (
        <div className="py-16 text-center border-2 border-dashed rounded-[2.5rem] border-border/40 bg-muted/5">
          <div className="w-12 h-12 rounded-full bg-muted mx-auto mb-4 flex items-center justify-center"><Library className="w-6 h-6 text-muted-foreground/40" /></div>
          <p className="text-muted-foreground text-xs font-bold uppercase tracking-widest">No movies in catalog yet.</p>
          <p className="text-muted-foreground/50 text-[10px] mt-2 uppercase tracking-tight font-medium">Click &quot;Start Sync&quot; above to begin scraping from CinePoint</p>
        </div>
      )}
    </div>
  );
}
