'use client';

import React, { useMemo } from 'react';
import { useTheatres } from '@/hooks/useTheatres';
import { ShieldCheck, Zap, Activity } from 'lucide-react';

/**
 * Compact Sidebar KPIs
 * Provides national stats within the Faceted Side-Rail.
 */
export function StudioCoverageCard() {
  const { theatres, loading: loadingTheatres } = useTheatres();
  
  const stats = useMemo(() => {
    if (loadingTheatres || !theatres.length) return null;

    const totalTheatres = theatres.length;
    const promotedTheatres = theatres.filter(t => (t.version || 0) >= 3.3).length;
    const totalPhysicalSeats = theatres.reduce((acc, t) => acc + (t.total_capacity || 0), 0);
    const totalStudios = theatres.reduce((acc, t) => acc + (t.studio_count || 0), 0);

    return {
      totalTheatres,
      promotedTheatres,
      promotedPercentage: Math.round((promotedTheatres / totalTheatres) * 100),
      totalPhysicalSeats,
      totalStudios
    };
  }, [theatres, loadingTheatres]);

  if (loadingTheatres || !stats) {
    return (
      <div className="space-y-3 animate-pulse opacity-50">
        <div className="h-12 bg-muted/20 rounded-lg" />
        <div className="h-12 bg-muted/20 rounded-lg" />
        <div className="h-12 bg-muted/20 rounded-lg" />
      </div>
    );
  }

  return (
    <div className="space-y-4 pt-4 border-t border-border/50">
      <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60">Market Performance</h2>
      
      <div className="space-y-3">
        {/* 1. National Twin Coverage */}
        <div className="flex items-center gap-3 group">
          <div className="p-2 bg-primary/10 rounded-lg group-hover:bg-primary/20 transition-colors">
            <Zap className="w-3.5 h-3.5 text-primary" />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-black tracking-tight">{stats.promotedPercentage}%</span>
            <span className="text-[9px] font-bold uppercase tracking-tighter text-muted-foreground">Digital Twin Coverage</span>
          </div>
        </div>

        {/* 2. Physical Asset Inventory */}
        <div className="flex items-center gap-3 group">
          <div className="p-2 bg-blue-500/10 rounded-lg group-hover:bg-blue-500/20 transition-colors">
            <Activity className="w-3.5 h-3.5 text-blue-500" />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-black tracking-tight">{stats.totalStudios.toLocaleString()}</span>
            <span className="text-[9px] font-bold uppercase tracking-tighter text-muted-foreground">Verified Studios</span>
          </div>
        </div>

        {/* 3. National Capacity */}
        <div className="flex items-center gap-3 group">
          <div className="p-2 bg-green-500/10 rounded-lg group-hover:bg-green-500/20 transition-colors">
            <ShieldCheck className="w-3.5 h-3.5 text-green-500" />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-black tracking-tight">{(stats.totalPhysicalSeats / 1000).toFixed(1)}k</span>
            <span className="text-[9px] font-bold uppercase tracking-tighter text-muted-foreground">Seating Capacity</span>
          </div>
        </div>
      </div>
    </div>
  );
}
