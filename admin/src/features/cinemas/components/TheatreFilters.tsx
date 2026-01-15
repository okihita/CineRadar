/**
 * Theatre Filters component
 * Chain and Region filter pills
 */
'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { X } from 'lucide-react';
import { CHAIN_COLORS, REGION_COLORS } from '@/lib/constants';
import { REGION_CENTERS } from '@/lib/regions';
import type { MerchantBreakdown, RegionBreakdown } from '../types';

interface TheatreFiltersProps {
    totalCount: number;
    merchantBreakdown: MerchantBreakdown[];
    regionBreakdown: RegionBreakdown[];
    selectedMerchant: string;
    selectedRegion: string;
    searchTerm: string;
    onMerchantChange: (merchant: string) => void;
    onRegionChange: (region: string) => void;
    onMapCenter: (center: { lat: number; lng: number; zoom: number } | null) => void;
    onClearFilters: () => void;
}

export function TheatreFilters({
    totalCount,
    merchantBreakdown,
    regionBreakdown,
    selectedMerchant,
    selectedRegion,
    searchTerm,
    onMerchantChange,
    onRegionChange,
    onMapCenter,
    onClearFilters,
}: TheatreFiltersProps) {
    const hasActiveFilters = selectedMerchant !== 'all' || selectedRegion !== 'all' || searchTerm;

    const handleRegionClick = (regionName: string) => {
        onRegionChange(regionName);
        onMapCenter(REGION_CENTERS[regionName] || REGION_CENTERS['all']);
    };

    const handleClear = () => {
        onClearFilters();
        onMapCenter(REGION_CENTERS['all']);
    };

    return (
        <Card>
            <CardContent className="px-4 py-3">
                <div className="flex flex-wrap items-center gap-4">
                    <div className="flex flex-col gap-2 flex-1">
                        {/* Chain Filter Row */}
                        <div className="flex items-center gap-2">
                            <label className="text-xs font-medium text-muted-foreground w-14">CHAIN</label>
                            <div className="flex flex-wrap gap-1.5">
                                <FilterPill
                                    label={`All (${totalCount})`}
                                    isSelected={selectedMerchant === 'all'}
                                    onClick={() => onMerchantChange('all')}
                                />
                                {merchantBreakdown.map((m) => {
                                    const color = CHAIN_COLORS[m.name as keyof typeof CHAIN_COLORS] || '#666';
                                    return (
                                        <FilterPill
                                            key={m.name}
                                            label={`${m.name} (${m.count})`}
                                            isSelected={selectedMerchant === m.name}
                                            color={color}
                                            onClick={() => onMerchantChange(m.name)}
                                        />
                                    );
                                })}
                            </div>
                        </div>

                        {/* Region Filter Row */}
                        <div className="flex items-center gap-2">
                            <label className="text-xs font-medium text-muted-foreground w-14">REGION</label>
                            <div className="flex flex-wrap gap-1.5">
                                <FilterPill
                                    label="All"
                                    isSelected={selectedRegion === 'all'}
                                    onClick={() => handleRegionClick('all')}
                                />
                                {regionBreakdown.map((r, i) => (
                                    <FilterPill
                                        key={r.name}
                                        label={`${r.name} (${r.count})`}
                                        isSelected={selectedRegion === r.name}
                                        color={REGION_COLORS[i]}
                                        onClick={() => handleRegionClick(r.name)}
                                    />
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Clear button */}
                    {hasActiveFilters && (
                        <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs gap-1 flex-shrink-0"
                            onClick={handleClear}
                        >
                            <X className="w-3 h-3" />
                            Clear
                        </Button>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}

// Helper component for filter pills
interface FilterPillProps {
    label: string;
    isSelected: boolean;
    color?: string;
    onClick: () => void;
}

function FilterPill({ label, isSelected, color, onClick }: FilterPillProps) {
    return (
        <span
            className="inline-flex items-center cursor-pointer text-xs px-3 py-1 rounded-md font-medium transition-colors"
            style={
                color
                    ? {
                        backgroundColor: isSelected ? color : 'transparent',
                        color: isSelected ? 'white' : 'inherit',
                        border: `1px solid ${color}`,
                    }
                    : undefined
            }
            onClick={onClick}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && onClick()}
        >
            {!color && (
                <span
                    className={`${isSelected ? 'bg-foreground text-background' : 'border hover:bg-muted'
                        }`}
                    style={{ display: 'contents' }}
                />
            )}
            {!color ? (
                <span
                    className={`inline-flex items-center px-3 py-1 rounded-md font-medium transition-colors ${isSelected ? 'bg-foreground text-background' : 'border hover:bg-muted'
                        }`}
                    style={{ margin: '-0.25rem -0.75rem' }}
                >
                    {label}
                </span>
            ) : (
                label
            )}
        </span>
    );
}
