'use client';

import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useTheatres } from '@/hooks/useTheatres';
import { ShieldCheck, Zap, Activity } from 'lucide-react';

/**
 * Modernized Studio Coverage Dashboard
 * Focuses on V3.3 Atomic "Digital Twin" verification.
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
      <Card className="border-primary/10 shadow-sm animate-pulse bg-muted/5">
        <CardContent className="h-32" />
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {/* 1. National Twin Coverage */}
      <Card className="border-primary/10 shadow-sm bg-card/50 overflow-hidden relative group">
        <div className="absolute top-0 right-0 p-3 opacity-5 group-hover:opacity-10 transition-opacity">
          <Zap className="w-12 h-12 text-primary" />
        </div>
        <CardHeader className="pb-2">
          <CardTitle className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
            <Zap className="w-3 h-3 text-primary" />
            Digital Twin Coverage
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold tracking-tighter">{stats.promotedPercentage}%</span>
            <span className="text-xs text-muted-foreground font-medium uppercase">of National Chain</span>
          </div>
          <p className="text-[10px] text-muted-foreground mt-2 font-medium uppercase tracking-tight">
            {stats.promotedTheatres} of {stats.totalTheatres} theatres migrated to V3.3
          </p>
        </CardContent>
      </Card>

      {/* 2. Physical Asset Inventory */}
      <Card className="border-primary/10 shadow-sm bg-card/50 overflow-hidden relative group">
        <div className="absolute top-0 right-0 p-3 opacity-5 group-hover:opacity-10 transition-opacity">
          <Activity className="w-12 h-12 text-blue-500" />
        </div>
        <CardHeader className="pb-2">
          <CardTitle className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
            <Activity className="w-3 h-3 text-blue-500" />
            Verified Asset Registry
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold tracking-tighter">{stats.totalStudios.toLocaleString()}</span>
            <span className="text-xs text-muted-foreground font-medium uppercase">Active Studios</span>
          </div>
          <p className="text-[10px] text-muted-foreground mt-2 font-medium uppercase tracking-tight">
            Consensus-Driven Physical Ground Truth
          </p>
        </CardContent>
      </Card>

      {/* 3. National Capacity */}
      <Card className="border-primary/10 shadow-sm bg-card/50 overflow-hidden relative group">
        <div className="absolute top-0 right-0 p-3 opacity-5 group-hover:opacity-10 transition-opacity">
          <ShieldCheck className="w-12 h-12 text-green-500" />
        </div>
        <CardHeader className="pb-2">
          <CardTitle className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
            <ShieldCheck className="w-3 h-3 text-green-500" />
            Total Seating Capacity
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold tracking-tighter">{(stats.totalPhysicalSeats / 1000).toFixed(1)}k</span>
            <span className="text-xs text-muted-foreground font-medium uppercase">Seats Verified</span>
          </div>
          <p className="text-[10px] text-muted-foreground mt-2 font-medium uppercase tracking-tight">
            Across {stats.promotedTheatres} migrated locations
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
