'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { 
    Building2, 
    MapPin, 
    FilterX, 
    ChevronRight,
    Building,
    BarChart3
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CHAIN_COLORS } from '@/lib/constants';
import { REGION_CENTERS } from '@/lib/regions';
import type { MerchantBreakdown, RegionBreakdown } from '../types';
import { StudioCoverageCard } from './StudioCoverageCard';
import Link from 'next/link';

interface TheatreSidebarProps {
    totalCount: number;
    merchantBreakdown: MerchantBreakdown[];
    regionBreakdown: RegionBreakdown[];
    selectedMerchant: string;
    selectedRegion: string;
    onMerchantChange: (merchant: string) => void;
    onRegionChange: (region: string) => void;
    onMapCenter: (center: { lat: number; lng: number; zoom: number } | null) => void;
    onClearFilters: () => void;
}

export function TheatreSidebar({
    totalCount,
    merchantBreakdown,
    regionBreakdown,
    selectedMerchant,
    selectedRegion,
    onMerchantChange,
    onRegionChange,
    onMapCenter,
    onClearFilters
}: TheatreSidebarProps) {
    const hasFilters = selectedMerchant !== 'all' || selectedRegion !== 'all';

    const handleRegionClick = (regionName: string) => {
        onRegionChange(regionName);
        onMapCenter(REGION_CENTERS[regionName] || REGION_CENTERS['all']);
    };

    const handleClear = () => {
        onClearFilters();
        onMapCenter(REGION_CENTERS['all']);
    };

    return (
        <div className="flex flex-col h-full space-y-8 pr-4 border-r border-border/50 relative">
            {/* 1. SCROLLABLE CONTENT (Filters) */}
            <div className="flex-1 space-y-8 overflow-y-auto no-scrollbar pr-1 pb-4">
                
                {/* Global Actions (Top of Sidebar) */}
                <div className="space-y-3">
                    <Link href="/cinemas/insights" className="block w-full">
                        <Button 
                            variant="outline" 
                            className="w-full justify-start gap-3 h-10 px-3 text-[10px] font-black uppercase tracking-widest border-primary/20 bg-primary/[0.03] hover:bg-primary/5 text-primary shadow-sm group"
                        >
                            <BarChart3 className="w-4 h-4 transition-transform group-hover:scale-110" />
                            Market Insights
                        </Button>
                    </Link>
                </div>

                {/* Header / Clear All */}
                <div className="flex items-center justify-between sticky top-0 bg-background/95 backdrop-blur-sm z-10 py-2 border-b border-border/10">
                    <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60">Registry Filters</h2>
                    {hasFilters && (
                        <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={handleClear}
                            className="h-6 px-2 text-[9px] font-bold uppercase gap-1.5 text-primary hover:bg-primary/5"
                        >
                            <FilterX className="w-3 h-3" />
                            Clear
                        </Button>
                    )}
                </div>

                {/* Merchant Facets */}
                <div className="space-y-3">
                    <div className="flex items-center gap-2 text-muted-foreground">
                        <Building2 className="w-3.5 h-3.5" />
                        <span className="text-[10px] font-black uppercase tracking-widest">Cinema Chains</span>
                    </div>
                    <div className="space-y-1">
                        <button
                            onClick={() => onMerchantChange('all')}
                            className={cn(
                                "w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs transition-all",
                                selectedMerchant === 'all' 
                                    ? "bg-primary text-primary-foreground font-bold shadow-sm" 
                                    : "hover:bg-muted text-muted-foreground hover:text-foreground"
                            )}
                        >
                            <span>All Indonesia</span>
                            <span className="text-[10px] opacity-60">{totalCount}</span>
                        </button>
                        {merchantBreakdown.map((m) => {
                            const color = CHAIN_COLORS[m.name as keyof typeof CHAIN_COLORS];
                            const isSelected = selectedMerchant === m.name;
                            return (
                                <button
                                    key={m.name}
                                    onClick={() => onMerchantChange(m.name)}
                                    className={cn(
                                        "w-full group flex items-center justify-between px-3 py-2 rounded-lg text-xs transition-all border border-transparent",
                                        isSelected 
                                            ? "bg-card border-border/50 shadow-sm ring-1 ring-primary/20" 
                                            : "hover:bg-muted/50 text-muted-foreground hover:text-foreground"
                                    )}
                                >
                                    <div className="flex items-center gap-2">
                                        <div 
                                            className="w-1.5 h-1.5 rounded-full" 
                                            style={{ backgroundColor: color || '#666' }}
                                        />
                                        <span className={cn(isSelected && "font-bold text-foreground")}>{m.name}</span>
                                    </div>
                                    <span className="text-[10px] opacity-40 group-hover:opacity-100">{m.count}</span>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Region Facets */}
                <div className="space-y-3">
                    <div className="flex items-center gap-2 text-muted-foreground">
                        <MapPin className="w-3.5 h-3.5" />
                        <span className="text-[10px] font-black uppercase tracking-widest">Regions</span>
                    </div>
                    <div className="space-y-1">
                        <button
                            onClick={() => handleRegionClick('all')}
                            className={cn(
                                "w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs transition-all",
                                selectedRegion === 'all' 
                                    ? "bg-primary/10 text-primary font-bold border border-primary/20" 
                                    : "hover:bg-muted text-muted-foreground hover:text-foreground"
                            )}
                        >
                            <span>National Coverage</span>
                            <ChevronRight className={cn("w-3 h-3 transition-transform", selectedRegion === 'all' && "rotate-90")} />
                        </button>
                        {regionBreakdown.map((r) => {
                            const isSelected = selectedRegion === r.name;
                            return (
                                <button
                                    key={r.name}
                                    onClick={() => handleRegionClick(r.name)}
                                    className={cn(
                                        "w-full group flex items-center justify-between px-3 py-2 rounded-lg text-xs transition-all",
                                        isSelected 
                                            ? "bg-primary/5 text-primary font-bold border border-primary/10" 
                                            : "hover:bg-muted/50 text-muted-foreground hover:text-foreground"
                                    )}
                                >
                                    <span>{r.name}</span>
                                    <span className="text-[10px] opacity-40 group-hover:opacity-100">{r.count}</span>
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* 2. STICKY FOOTER (KPIs + Help) */}
            <div className="pt-4 space-y-6 bg-background/95 backdrop-blur-sm z-10 border-t border-border/50 mt-auto pb-4">
                <StudioCoverageCard />

                <div className="p-4 rounded-xl bg-primary/5 border border-primary/10 space-y-2">
                    <div className="flex items-center gap-2 text-primary">
                        <Building className="w-3.5 h-3.5" />
                        <span className="text-[9px] font-black uppercase tracking-wider">Asset Registry</span>
                    </div>
                    <p className="text-[9px] text-muted-foreground leading-relaxed uppercase font-bold tracking-tight">
                        Navigate the 502 national assets by chain or regional purchasing power.
                    </p>
                </div>
            </div>
        </div>
    );
}
