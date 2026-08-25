'use client';

/**
 * Shared small UI components used across CinePoint pages.
 * Eliminates copy-paste patterns for stat cards, search, filters, tables, and skeletons.
 */

import Link from 'next/link';
import { Eye, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { formatAdm } from '@/lib/cinepoint';
import type { PersonRanking } from '@/lib/cinepoint';

// ─── TypeBadge ──────────────────────────────────────────────

export function TypeBadge({ type, short }: { type: string; short?: boolean }) {
  const isLocal = type === 'local';
  return (
    <Badge variant="outline" className={cn(
      short ? 'text-[9px] px-1 py-0' : 'text-[10px]',
      isLocal ? 'border-indigo-500/20 text-indigo-600' : 'border-amber-500/20 text-amber-600',
    )}>
      {short ? (isLocal ? 'Local' : 'Intl') : (isLocal ? 'Local' : 'International')}
    </Badge>
  );
}

// ─── StatCard ────────────────────────────────────────────────

export function StatCard({ label, value, sub, className }: {
  label: string;
  value: string | number;
  sub?: string;
  className?: string;
}) {
  return (
    <div className="px-4 py-3 rounded-xl border border-border/30 bg-card">
      <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/50">{label}</p>
      <p className={cn('text-xl font-black', className)}>{value}</p>
      {sub && <p className="text-[10px] text-muted-foreground truncate">{sub}</p>}
    </div>
  );
}

// ─── SearchInput ─────────────────────────────────────────────

export function SearchInput({ value, onChange, placeholder }: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <div className="relative flex-1 max-w-xs">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/40" />
      <input
        type="text" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        className="w-full pl-9 pr-3 py-2 rounded-lg border border-border/40 bg-muted/5 text-xs focus:outline-none focus:border-primary/40"
      />
    </div>
  );
}

// ─── TypeFilterBar ───────────────────────────────────────────

export function TypeFilterBar({ value, onChange }: {
  value: 'all' | 'local' | 'international';
  onChange: (t: 'all' | 'local' | 'international') => void;
}) {
  return (
    <div className="flex gap-1">
      {(['all', 'local', 'international'] as const).map((t) => (
        <button key={t} onClick={() => onChange(t)}
          className={cn('px-3 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all',
            value === t ? 'bg-primary text-primary-foreground' : 'bg-muted/30 text-muted-foreground hover:bg-muted/50')}>
          {t === 'all' ? 'All' : t === 'local' ? 'Local' : 'International'}
        </button>
      ))}
    </div>
  );
}

// ─── PersonPageSkeleton ──────────────────────────────────────

export function PersonPageSkeleton({ icon: Icon, iconClassName, title, message }: {
  icon: React.ComponentType<{ className?: string }>;
  iconClassName: string;
  title: string;
  message: string;
}) {
  return (
    <div className="px-6 py-8 space-y-6">
      <div className="flex items-center gap-3">
        <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center border', iconClassName)}>
          <Icon className="w-5 h-5 animate-pulse" />
        </div>
        <div>
          <h1 className="text-base font-black uppercase tracking-tighter">{title}</h1>
          <p className="text-[10px] text-muted-foreground/60">{message}</p>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-4">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="h-16 rounded-xl border border-border/20 animate-pulse bg-muted/20" />
        ))}
      </div>
      <div className="h-96 rounded-xl border border-border/20 animate-pulse bg-muted/10" />
    </div>
  );
}

// ─── PersonRankingsTable ─────────────────────────────────────

export function PersonRankingsTable({ rankings, label }: {
  rankings: PersonRanking[];
  label: string;
}) {
  return (
    <Card>
      <CardContent className="p-0">
        <div className="overflow-auto max-h-[70vh]">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-background z-10 border-b">
              <tr className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/50">
                <th className="p-3 text-left w-10">#</th>
                <th className="p-3 text-left">{label}</th>
                <th className="p-3 text-right">Movies</th>
                <th className="p-3 text-right">Avg Admissions</th>
                <th className="p-3 text-right">Median</th>
                <th className="p-3 text-right">Hit Rate</th>
                <th className="p-3 text-right">Total</th>
                <th className="p-3 text-left">Best Movie</th>
                <th className="p-3 text-center w-28" />
              </tr>
            </thead>
            <tbody>
              {rankings.map((p, i) => (
                <tr key={p.name} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                  <td className="p-3 text-muted-foreground/30 font-mono">{i + 1}</td>
                  <td className="p-3 font-bold">{p.name}</td>
                  <td className="p-3 text-right font-mono text-muted-foreground">{p.movie_count}</td>
                  <td className="p-3 text-right font-mono font-bold">{formatAdm(p.avg_admission)}</td>
                  <td className="p-3 text-right font-mono text-muted-foreground">{formatAdm(p.median_admission)}</td>
                  <td className="p-3 text-right">
                    <span className={cn('font-mono font-bold', p.hit_rate >= 30 ? 'text-emerald-600' : p.hit_rate >= 15 ? 'text-amber-600' : 'text-muted-foreground')}>
                      {p.hit_rate}%
                    </span>
                  </td>
                  <td className="p-3 text-right font-mono text-muted-foreground">{formatAdm(p.total_admission)}</td>
                  <td className="p-3">
                    {p.best_movie && (
                      <Link href={`/competitors/cinepoint/movies/${p.best_movie.id}`}
                        className="text-[10px] text-primary hover:underline truncate block max-w-[200px]">
                        {p.best_movie.title}
                        <span className="text-muted-foreground ml-1 font-mono">({formatAdm(p.best_movie.total_admission)})</span>
                      </Link>
                    )}
                  </td>
                  <td className="p-3 text-center">
                    <button
                      onClick={() => { window.location.href = `/competitors/cinepoint/analysis/person/${encodeURIComponent(p.name)}`; }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border/40 bg-muted/30 text-[10px] font-bold uppercase tracking-wider text-muted-foreground hover:bg-primary hover:text-primary-foreground hover:border-primary transition-all cursor-pointer"
                    >
                      <Eye className="w-3 h-3" />
                      View Details
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
