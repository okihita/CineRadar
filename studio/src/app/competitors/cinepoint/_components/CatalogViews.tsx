'use client';

import Link from 'next/link';
import NextImage from 'next/image';
import { Film, CheckCircle2, ChevronUp, ChevronDown, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { CinePointMovie } from '@/features/competitors/types';

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

interface DataTableProps {
  movies: CinePointMovie[];
  sortCol: string;
  sortDir: 'asc' | 'desc';
  showDebugCols: boolean;
  onSort: (col: string) => void;
  onRowClick: (id: number) => void;
}

export function DataTable({ movies, sortCol, sortDir, showDebugCols, onSort, onRowClick }: DataTableProps) {
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
                    'px-3 py-2.5 text-sm font-black uppercase tracking-[0.15em] select-none transition-colors whitespace-nowrap',
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
                <td className="px-3 py-2 text-sm font-mono text-muted-foreground/50 text-right">{movie.id}</td>

                <td className="px-3 py-1.5 text-center">
                  <div className="w-6 h-8 rounded overflow-hidden bg-muted/30 mx-auto relative">
                    {movie.image_title ? (
                      <NextImage src={movie.image_title} alt="" fill className="object-cover" sizes="24px" referrerPolicy="no-referrer" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center"><Film className="w-2.5 h-2.5 text-muted-foreground/20" /></div>
                    )}
                  </div>
                </td>

                <td className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-foreground/90 group-hover:text-primary transition-colors">{movie.title}</span>
                    {movie.details_fetched_at && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" title="Details enriched" />}
                  </div>
                </td>

                {showDebugCols && (
                  <td className="px-3 py-2"><span className="text-sm font-mono text-amber-500/40">{movie.title_cp}</span></td>
                )}

                <td className="px-3 py-2 text-center">
                  <span className={cn('inline-block text-sm font-black uppercase tracking-wider px-2 py-0.5 rounded-full',
                    movie.type === 'local' ? 'bg-blue-500/10 text-blue-600 border border-blue-500/20' : 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20',
                  )}>{movie.type}</span>
                </td>

                <td className="px-3 py-2">
                  <div className="flex flex-wrap gap-1">
                    {movie.movie_genre.map((g) => (
                      <span key={g} className="text-sm font-medium text-muted-foreground/40 bg-muted/30 px-1.5 py-0.5 rounded">{g}</span>
                    ))}
                    {movie.movie_genre.length === 0 && <span className="text-sm text-muted-foreground/20">—</span>}
                  </div>
                </td>

                <td className="px-3 py-2"><span className="text-sm font-mono text-muted-foreground/50">{movie.release_date}</span></td>
                <td className="px-3 py-2 text-right"><span className="text-sm font-mono text-muted-foreground/40">{movie.duration > 0 ? `${movie.duration}m` : '—'}</span></td>

                <td className="px-3 py-2 text-center">
                  {movie.matched_movie_id ? (
                    <span className="inline-flex items-center gap-1 text-sm font-bold text-emerald-600 bg-emerald-500/10 px-2 py-0.5 rounded-full"><CheckCircle2 className="w-2.5 h-2.5" />Yes</span>
                  ) : (
                    <span className="text-sm text-muted-foreground/20">—</span>
                  )}
                </td>

                <td className="px-3"><ChevronRight className="w-3 h-3 text-muted-foreground/20 group-hover:text-primary/40 transition-colors" /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="px-4 py-2 border-t border-border/20 bg-muted/10 flex items-center justify-between">
        <span className="text-sm font-mono text-muted-foreground/30">{movies.length} row{movies.length !== 1 ? 's' : ''} in page</span>
        <span className="text-sm font-mono text-muted-foreground/20">ORDER BY {sortCol} {sortDir.toUpperCase()}</span>
      </div>
    </div>
  );
}

export function MovieCard({ movie }: { movie: CinePointMovie }) {
  return (
    <Link href={`/competitors/cinepoint/movies/${movie.id}`} className="group rounded-2xl border border-border/40 bg-card overflow-hidden shadow-sm hover:shadow-xl hover:border-primary/20 transition-all duration-300 block">
      <div className="relative aspect-[2/3] bg-muted/20 overflow-hidden">
        {movie.image_title ? (
          <NextImage src={movie.image_title} alt={movie.title} fill className="object-cover group-hover:scale-105 transition-transform duration-500" sizes="200px" referrerPolicy="no-referrer" />
        ) : (
          <div className="w-full h-full flex items-center justify-center"><Film className="w-8 h-8 text-muted-foreground/20" /></div>
        )}
        <div className={cn('absolute top-2 left-2 px-1.5 py-0.5 rounded text-sm font-black uppercase tracking-wider',
          movie.type === 'local' ? 'bg-blue-500/80 text-white' : 'bg-emerald-500/80 text-white',
        )}>{movie.type === 'local' ? 'ID' : 'INT'}</div>
        {movie.matched_movie_id && (
          <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center"><CheckCircle2 className="w-3 h-3 text-white" /></div>
        )}
      </div>
      <div className="p-3 space-y-1.5">
        <p className="text-sm font-bold leading-tight line-clamp-2 group-hover:text-primary transition-colors">{movie.title}</p>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground/50 font-mono">{movie.release_date}</span>
          {movie.duration > 0 && <span className="text-sm text-muted-foreground/30">{movie.duration}m</span>}
        </div>
        {movie.movie_genre.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {movie.movie_genre.slice(0, 2).map((g) => (
              <span key={g} className="text-sm font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-muted/50 text-muted-foreground/50">{g}</span>
            ))}
          </div>
        )}
      </div>
    </Link>
  );
}

export function CatalogStatCard({ icon: Icon, label, value, color }: { icon: typeof Film; label: string; value: number; color?: string }) {
  return (
    <div className="px-4 py-3 rounded-xl border border-border/40 bg-card">
      <div className="flex items-center gap-2 mb-1">
        <Icon className={cn('w-3 h-3', color || 'text-muted-foreground/40')} />
        <span className="text-sm font-black uppercase tracking-widest text-muted-foreground/40">{label}</span>
      </div>
      <p className={cn('text-lg font-black tracking-tight', color || 'text-foreground')}>{value.toLocaleString()}</p>
    </div>
  );
}
