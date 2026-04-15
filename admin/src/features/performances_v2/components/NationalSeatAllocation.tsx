"use client";
import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Map as MapIcon } from "lucide-react";
import { ShowtimeSnapshot } from '../types/performance';

import { useCityAggregation } from "../hooks/useCityAggregation";
import { CityPotentialRadar } from "./CityPotentialRadar";
import { IndonesiaMap } from "./IndonesiaMap";

interface NationalSeatAllocationProps {
  showtimes: ShowtimeSnapshot[];
}

export function NationalSeatAllocation({
  showtimes,
}: NationalSeatAllocationProps) {
  const { cityStats, provinceStats } = useCityAggregation(showtimes);

  if (showtimes.length === 0) return null;

  return (
    <Card className="mb-6">
      <CardHeader className="pb-4">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <MapIcon className="w-5 h-5 text-primary" />
          National Allocation & Core Markets
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {/* Map Component */}
          <div className="w-full flex flex-col gap-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
              <span>Choropleth Heatmap (Provincial)</span>
              <div className="flex items-center gap-2">
                <span className="text-[9px] text-muted-foreground font-mono">0%</span>
                <div className="flex items-center gap-0.5">
                  <div className="w-2.5 h-2.5 bg-red-700 rounded-sm" title="0-3%" />
                  <div className="w-2.5 h-2.5 bg-red-500 rounded-sm" title="3-6%" />
                  <div className="w-2.5 h-2.5 bg-red-300 rounded-sm" title="6-9%" />
                  <div className="w-2.5 h-2.5 bg-orange-400 rounded-sm" title="9-12%" />
                  <div className="w-2.5 h-2.5 bg-amber-400 rounded-sm" title="12-15%" />
                  <div className="w-2.5 h-2.5 bg-yellow-400 rounded-sm" title="15-18%" />
                  <div className="w-2.5 h-2.5 bg-lime-400 rounded-sm" title="18-21%" />
                  <div className="w-2.5 h-2.5 bg-green-500 rounded-sm" title="21-24%" />
                  <div className="w-2.5 h-2.5 bg-green-700 rounded-sm" title="24%+" />
                </div>
                <span className="text-[9px] text-muted-foreground font-mono">27%+</span>
              </div>
            </div>
            <IndonesiaMap provinceStats={provinceStats} />
          </div>

          {/* Radar Component */}
          <div className="w-full">
            <CityPotentialRadar cityStats={cityStats} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
