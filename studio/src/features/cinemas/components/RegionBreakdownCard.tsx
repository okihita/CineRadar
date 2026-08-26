'use client';

import React from 'react';
import { MapPin } from 'lucide-react';

interface RegionBreakdownProps {
  regionBreakdown: { name: string; count: number }[];
  totalTheatres: number;
}

export function RegionBreakdownCard({ regionBreakdown }: RegionBreakdownProps) {
  return (
    <div className="flex flex-col h-full space-y-3 p-4">
      <div className="flex items-center gap-2 text-muted-foreground/80">
        <MapPin className="w-3 h-3" />
        <span className="text-sm font-black uppercase tracking-widest">Regional Density</span>
      </div>
      
      <div className="space-y-2 overflow-y-auto no-scrollbar max-h-[240px] pr-1">
        {regionBreakdown.map((region) => (
          <div key={region.name} className="space-y-1 group">
            <div className="flex justify-between items-end text-sm">
              <span className="font-bold text-foreground/80 group-hover:text-primary transition-colors">
                {region.name}
              </span>
              <span className="font-mono text-muted-foreground/60">{region.count}</span>
            </div>
            <div className="h-1 w-full bg-muted/30 rounded-full overflow-hidden">
              <div 
                className="h-full bg-primary/40 rounded-full group-hover:bg-primary/60 transition-all"
                style={{ width: `${(region.count / regionBreakdown[0].count) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
