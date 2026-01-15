/**
 * Movie Filters component
 */
'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';

interface MovieFiltersProps {
    searchTerm: string;
    filterCity: string;
    filterChain: string;
    filterRoom: string;
    showAvailableOnly: boolean;
    cities: string[];
    chains: string[];
    roomTypes: string[];
    onSearchChange: (term: string) => void;
    onCityChange: (city: string) => void;
    onChainChange: (chain: string) => void;
    onRoomChange: (room: string) => void;
    onAvailableOnlyChange: (show: boolean) => void;
    onClearFilters: () => void;
}

export function MovieFilters({
    searchTerm,
    filterCity,
    filterChain,
    filterRoom,
    showAvailableOnly,
    cities,
    chains,
    roomTypes,
    onSearchChange,
    onCityChange,
    onChainChange,
    onRoomChange,
    onAvailableOnlyChange,
    onClearFilters,
}: MovieFiltersProps) {
    const hasActiveFilters =
        searchTerm ||
        filterCity !== 'all' ||
        filterChain !== 'all' ||
        filterRoom !== 'all';

    return (
        <Card className="mb-6">
            <CardContent className="pt-4">
                <div className="flex flex-wrap items-center gap-4">
                    {/* Search */}
                    <div className="relative flex-1 min-w-[200px] max-w-xs">
                        <Input
                            placeholder="Search movie, theatre..."
                            value={searchTerm}
                            onChange={(e) => onSearchChange(e.target.value)}
                            className="h-9 text-sm pr-8"
                        />
                        {searchTerm && (
                            <button
                                onClick={() => onSearchChange('')}
                                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        )}
                    </div>

                    {/* City Filter */}
                    <select
                        value={filterCity}
                        onChange={(e) => onCityChange(e.target.value)}
                        className="h-9 px-3 rounded-md border text-sm bg-background"
                    >
                        <option value="all">All Cities ({cities.length})</option>
                        {cities.map((c) => (
                            <option key={c} value={c}>
                                {c}
                            </option>
                        ))}
                    </select>

                    {/* Chain Filter */}
                    <select
                        value={filterChain}
                        onChange={(e) => onChainChange(e.target.value)}
                        className="h-9 px-3 rounded-md border text-sm bg-background"
                    >
                        <option value="all">All Chains</option>
                        {chains.map((c) => (
                            <option key={c} value={c}>
                                {c}
                            </option>
                        ))}
                    </select>

                    {/* Room Type Filter */}
                    <select
                        value={filterRoom}
                        onChange={(e) => onRoomChange(e.target.value)}
                        className="h-9 px-3 rounded-md border text-sm bg-background"
                    >
                        <option value="all">All Room Types</option>
                        {roomTypes.map((r) => (
                            <option key={r} value={r}>
                                {r}
                            </option>
                        ))}
                    </select>

                    {/* Available Only Toggle */}
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                        <input
                            type="checkbox"
                            checked={showAvailableOnly}
                            onChange={(e) => onAvailableOnlyChange(e.target.checked)}
                            className="rounded"
                        />
                        Available only
                    </label>

                    {/* Clear All */}
                    {hasActiveFilters && (
                        <Button variant="ghost" size="sm" onClick={onClearFilters} className="h-9">
                            Clear All
                        </Button>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
