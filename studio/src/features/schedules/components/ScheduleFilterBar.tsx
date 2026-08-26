"use client";

import { Search, X, SlidersHorizontal, Sparkles } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ChainName, CHAIN_TAILWIND } from "@/lib/constants";
import { cn } from "@/lib/utils";

interface ScheduleFilterBarProps {
    search: string;
    onSearchChange: (value: string) => void;
    availableGenres: string[];
    selectedGenres: Set<string>;
    onToggleGenre: (genre: string) => void;
    availableChains: ChainName[];
    selectedChains: Set<ChainName>;
    onToggleChain: (chain: ChainName) => void;
    presaleOnly: boolean;
    onTogglePresale: () => void;
    hasActiveFilters: boolean;
    onClear: () => void;
    resultCount: number;
    totalCount: number;
}

export function ScheduleFilterBar({
    search,
    onSearchChange,
    availableGenres,
    selectedGenres,
    onToggleGenre,
    availableChains,
    selectedChains,
    onToggleChain,
    presaleOnly,
    onTogglePresale,
    hasActiveFilters,
    onClear,
    resultCount,
    totalCount,
}: ScheduleFilterBarProps) {
    return (
        <div className="space-y-3 rounded-xl border border-border/60 bg-card p-4 shadow-sm">
            {/* Search row */}
            <div className="flex items-center gap-2">
                <div className="relative flex-1">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                        placeholder="Search movies..."
                        value={search}
                        onChange={(e) => onSearchChange(e.target.value)}
                        className="h-8 text-sm pl-8"
                    />
                </div>
                <Button
                    variant={presaleOnly ? "default" : "outline"}
                    size="sm"
                    className={cn("h-8 text-sm font-bold uppercase tracking-wider gap-1", !presaleOnly && "text-amber-600 border-amber-500/30 hover:bg-amber-500/10")}
                    onClick={onTogglePresale}
                >
                    <Sparkles className="h-3 w-3" />
                    Presale
                </Button>
                {hasActiveFilters && (
                    <Button variant="ghost" size="sm" className="h-8 text-sm text-muted-foreground gap-1" onClick={onClear}>
                        <X className="h-3 w-3" />
                        Clear
                    </Button>
                )}
                <span className="text-sm font-mono text-muted-foreground/60 tabular-nums whitespace-nowrap">
                    {resultCount === totalCount ? `${totalCount} movies` : `${resultCount} / ${totalCount}`}
                </span>
            </div>

            {/* Chain pills */}
            {availableChains.length > 0 && (
                <div className="flex items-center gap-1.5">
                    <SlidersHorizontal className="h-3 w-3 text-muted-foreground/50 flex-shrink-0" />
                    {availableChains.map((chain) => {
                        const isSelected = selectedChains.has(chain);
                        const tw = CHAIN_TAILWIND[chain];
                        return (
                            <button
                                key={chain}
                                onClick={() => onToggleChain(chain)}
                                aria-pressed={isSelected}
                                className={cn(
                                    "px-2 py-0.5 rounded text-sm font-bold uppercase tracking-wider transition-all border",
                                    isSelected
                                        ? `${tw?.bg || 'bg-gray-500'} text-white border-transparent`
                                        : "bg-muted/50 text-muted-foreground border-border/50 hover:bg-muted"
                                )}
                            >
                                {chain}
                            </button>
                        );
                    })}
                </div>
            )}

            {/* Genre pills */}
            {availableGenres.length > 0 && (
                <div className="flex flex-wrap gap-1">
                    {availableGenres.map((genre) => (
                        <button
                            key={genre}
                            onClick={() => onToggleGenre(genre)}
                            aria-pressed={selectedGenres.has(genre)}
                            className={cn(
                                "px-2 py-0.5 rounded text-sm font-medium transition-all border",
                                selectedGenres.has(genre)
                                    ? "bg-primary text-primary-foreground border-transparent"
                                    : "bg-muted/30 text-muted-foreground border-transparent hover:bg-muted/60"
                            )}
                        >
                            {genre}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
