'use client';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Filter } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TypeFilterBar } from '@/components/cinepoint/SharedUi';
import type { FactorState } from '@/lib/cinepoint';

interface FilterPanelProps {
  factors: FactorState;
  factorConfig: { key: keyof FactorState; label: string; icon: React.ComponentType<{ className?: string }> }[];
  toggleFactor: (key: keyof FactorState) => void;
  typeFilter: 'all' | 'local' | 'international';
  setTypeFilter: (t: 'all' | 'local' | 'international') => void;
  selectedGenres: string[];
  setSelectedGenres: (g: string[]) => void;
  allGenres: string[];
  yearRangeFilter: [number, number];
  setYearRangeFilter: (r: [number, number]) => void;
  yearMin: number;
  yearMax: number;
  moviesCount: number;
  filteredCount: number;
}

export function FilterPanel({
  factors, factorConfig, toggleFactor,
  typeFilter, setTypeFilter,
  selectedGenres, setSelectedGenres, allGenres,
  yearRangeFilter, setYearRangeFilter, yearMin, yearMax,
  moviesCount, filteredCount,
}: FilterPanelProps) {
  const hasActiveFilters = typeFilter !== 'all' || selectedGenres.length > 0 || yearRangeFilter[0] > 0 || yearRangeFilter[1] > 0;

  return (
    <Card>
      <CardContent className="py-4 space-y-4">
        {/* Factor toggles */}
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 mb-2">Analysis Factors</p>
          <div className="flex flex-wrap gap-2">
            {factorConfig.map(({ key, label, icon: Icon }) => (
              <button key={key} onClick={() => toggleFactor(key)}
                className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all',
                  factors[key] ? 'bg-primary/10 border-primary/20 text-primary' : 'bg-muted/30 border-border/20 text-muted-foreground/40')}>
                <Icon className="w-3 h-3" />{label}
              </button>
            ))}
          </div>
        </div>

        {/* Type filter */}
        <div className="flex items-center gap-4">
          <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">Type</p>
          <TypeFilterBar value={typeFilter} onChange={setTypeFilter} />
        </div>

        {/* Genre filter */}
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 mb-2">
            Genre Filter
            {selectedGenres.length > 0 && (
              <button onClick={() => setSelectedGenres([])} className="ml-2 text-primary hover:underline normal-case tracking-normal font-medium">
                Clear ({selectedGenres.length})
              </button>
            )}
          </p>
          <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
            {allGenres.map((g) => (
              <button key={g} onClick={() => setSelectedGenres(selectedGenres.includes(g) ? selectedGenres.filter((x) => x !== g) : [...selectedGenres, g])}
                className={cn('px-2 py-0.5 rounded text-[10px] font-medium border transition-all',
                  selectedGenres.includes(g) ? 'bg-indigo-500/10 border-indigo-500/30 text-indigo-600' : 'bg-muted/20 border-border/20 text-muted-foreground/50 hover:bg-muted/40')}>
                {g}
              </button>
            ))}
          </div>
        </div>

        {/* Year range filter */}
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 mb-2">
            Year Range
            {(yearRangeFilter[0] > 0 || yearRangeFilter[1] > 0) && (
              <button onClick={() => setYearRangeFilter([0, 0])} className="ml-2 text-primary hover:underline normal-case tracking-normal font-medium">Reset</button>
            )}
          </p>
          <div className="flex items-center gap-2">
            <input type="number" value={yearRangeFilter[0] || ''} onChange={(e) => setYearRangeFilter([Number(e.target.value) || 0, yearRangeFilter[1]])}
              placeholder={String(yearMin)} min={yearMin} max={yearMax}
              className="w-20 px-2 py-1 text-xs rounded-md border border-border/40 bg-background text-center font-mono" />
            <span className="text-[10px] text-muted-foreground/50">to</span>
            <input type="number" value={yearRangeFilter[1] || ''} onChange={(e) => setYearRangeFilter([yearRangeFilter[0], Number(e.target.value) || 0])}
              placeholder={String(yearMax)} min={yearMin} max={yearMax}
              className="w-20 px-2 py-1 text-xs rounded-md border border-border/40 bg-background text-center font-mono" />
            <span className="text-[10px] text-muted-foreground/40 font-mono">{yearMin}–{yearMax}</span>
          </div>
        </div>

        {/* Active filters summary */}
        {hasActiveFilters && (
          <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
            <Filter className="w-3 h-3" />
            <span>Showing {filteredCount.toLocaleString()} of {moviesCount.toLocaleString()} movies</span>
            {typeFilter !== 'all' && <Badge variant="outline" className="text-[9px] px-1.5 py-0">{typeFilter}</Badge>}
            {selectedGenres.map((g) => <Badge key={g} variant="outline" className="text-[9px] px-1.5 py-0 border-indigo-500/30 text-indigo-600">{g}</Badge>)}
            {(yearRangeFilter[0] > 0 || yearRangeFilter[1] > 0) && (
              <Badge variant="outline" className="text-[9px] px-1.5 py-0 border-amber-500/30 text-amber-600">
                {yearRangeFilter[0] || yearMin}–{yearRangeFilter[1] || yearMax}
              </Badge>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
