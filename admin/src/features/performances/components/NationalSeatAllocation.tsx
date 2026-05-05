"use client";
import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Map as MapIcon, Trophy } from "lucide-react";
import { ShowtimeSnapshot } from '../types/performance';
import { PERFORMANCE_TIERS } from "@/lib/constants";

import { useCityAggregation } from "../hooks/useCityAggregation";
import { CityPotentialRadar } from "./CityPotentialRadar";
import { PerformanceHeatmap } from "./PerformanceHeatmap";

interface NationalSeatAllocationProps {
  showtimes: ShowtimeSnapshot[];
}

export function NationalSeatAllocation({
  showtimes,
}: NationalSeatAllocationProps) {
  const { cityStats, provinceStats } = useCityAggregation(showtimes);

  if (showtimes.length === 0) return null;

  return (
    <Card className="mb-6 overflow-hidden border-border/50">
      <CardHeader className="pb-4 border-b bg-muted/5 py-2.5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <CardTitle className="text-xs font-bold uppercase tracking-wider flex items-center gap-2 text-muted-foreground">
                <MapIcon className="w-3.5 h-3.5 opacity-70" />
                National Allocation
            </CardTitle>
            
            <div className="hidden xl:flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">
                <Trophy className="w-3.5 h-3.5 text-amber-500 opacity-50" />
                Top 15 Core Markets
            </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="grid grid-cols-1 xl:grid-cols-2 divide-y xl:divide-y-0">
          {/* Map Component */}
          <div className="w-full flex flex-col gap-2 p-6 bg-background/50 xl:border-r">
            <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-tighter text-muted-foreground mb-1">
              <span>Choropleth Heatmap (Provincial)</span>
            </div>
            
            <PerformanceHeatmap provinceStats={provinceStats} />

            {/* Bottom Legend - Full Width with Ticks */}
            <div className="mt-4 space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-[9px] font-bold text-muted-foreground font-mono w-4">0%</span>
                <div className="flex-1 flex flex-col gap-1">
                  {/* Color Bar */}
                  <div className="h-2 flex gap-0.5">
                    {PERFORMANCE_TIERS.map((tier, idx) => (
                      <div 
                        key={idx} 
                        className={`flex-1 ${tier.twBg} rounded-sm`} 
                        title={`${idx === 0 ? 0 : PERFORMANCE_TIERS[idx-1].threshold}-${tier.threshold}%`} 
                      />
                    ))}
                  </div>
                  
                  {/* Ticks and Sub-labels */}
                  <div className="relative h-4 w-full">
                    {/* Tick Mark 10% */}
                    <div className="absolute left-[33.33%] -translate-x-1/2 flex flex-col items-center">
                        <div className="w-px h-1 bg-muted-foreground/30 mb-0.5" />
                        <span className="text-[8px] font-bold font-mono text-muted-foreground/60">10%</span>
                    </div>
                    {/* Tick Mark 20% */}
                    <div className="absolute left-[66.66%] -translate-x-1/2 flex flex-col items-center">
                        <div className="w-px h-1 bg-muted-foreground/30 mb-0.5" />
                        <span className="text-[8px] font-bold font-mono text-muted-foreground/60">20%</span>
                    </div>
                  </div>
                </div>
                <span className="text-[9px] font-bold text-muted-foreground font-mono w-6">30%+</span>
              </div>
              
              <div className="flex justify-between text-[8px] font-black uppercase tracking-widest text-muted-foreground/40 pt-1">
                <span>Low Occupancy</span>
                <span>Market Capacity Threshold</span>
                <span>Peak Performance</span>
              </div>
            </div>
          </div>

          {/* Radar Component */}
          <div className="w-full xl:p-6 bg-background/30">
            <CityPotentialRadar cityStats={cityStats} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
