'use client';

import React, { useMemo } from 'react';
import { DonutChart, type DonutItem } from './DonutChart';
import { Building2 } from 'lucide-react';
import { CHAIN_COLORS } from '@/lib/constants';
import type { Theatre } from '../types';

interface ChainDistributionCardProps {
  theatres: Theatre[];
  regionBreakdown: { name: string; count: number }[];
}

export function ChainDistributionCard({ theatres }: ChainDistributionCardProps) {
  const { data, total } = useMemo(() => {
    const counts: Record<string, number> = {};
    theatres.forEach((t) => {
      counts[t.merchant] = (counts[t.merchant] || 0) + 1;
    });

    const items: DonutItem[] = Object.entries(counts)
      .map(([name, count]) => ({
        name,
        count,
        color: CHAIN_COLORS[name as keyof typeof CHAIN_COLORS] || '#666',
      }))
      .sort((a, b) => b.count - a.count);

    return { data: items, total: theatres.length };
  }, [theatres]);

  return (
    <div className="flex flex-col space-y-3 p-4">
      <div className="flex items-center gap-2 text-muted-foreground/80">
        <Building2 className="w-3 h-3" />
        <span className="text-[9px] font-black uppercase tracking-widest">Chain Distribution</span>
      </div>
      
      <div className="h-[160px] w-full flex items-center justify-center">
        <DonutChart data={data} total={total} size={150} />
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 pt-2 border-t border-border/20">
        {data.map((item) => (
          <div key={item.name} className="flex items-center justify-between group">
            <div className="flex items-center gap-1.5">
              <div 
                className="w-1.5 h-1.5 rounded-full" 
                style={{ backgroundColor: item.color }} 
              />
              <span className="text-[9px] font-bold text-foreground/70 uppercase truncate w-16">
                {item.name}
              </span>
            </div>
            <span className="text-[9px] font-mono text-muted-foreground/50">{item.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
