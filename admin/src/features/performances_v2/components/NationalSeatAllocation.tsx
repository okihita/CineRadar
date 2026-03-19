"use client";
import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Map as MapIcon } from "lucide-react";
import { ShowtimeSnapshot } from "./ShowtimeTable";
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
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1">
                  <div className="w-2 h-2 bg-red-500 rounded-full" /> &lt;5%
                </span>
                <span className="flex items-center gap-1">
                  <div className="w-2 h-2 bg-amber-500 rounded-full" /> 5-10%
                </span>
                <span className="flex items-center gap-1">
                  <div className="w-2 h-2 bg-green-500 rounded-full" /> &gt;10%
                </span>
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
