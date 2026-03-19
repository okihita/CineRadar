"use client";

import React, { useMemo, useState, useRef } from "react";
import { geoMercator, geoPath } from "d3-geo";
import { ProvincePerformance } from "../hooks/useCityAggregation";

interface IndonesiaMapProps {
  provinceStats: ProvincePerformance[];
}

interface GeoJsonFeature {
  type: string;
  properties: {
    Propinsi: string;
    [key: string]: unknown;
  };
  geometry: unknown;
}

interface GeoJsonCollection {
  type: string;
  features: GeoJsonFeature[];
}

export function IndonesiaMap({ provinceStats }: IndonesiaMapProps) {
  const [geoJson, setGeoJson] = useState<GeoJsonCollection | null>(null);
  const [hoveredProvince, setHoveredProvince] =
    useState<ProvincePerformance | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  // Load GeoJSON on mount
  React.useEffect(() => {
    fetch("/indonesia-provinces.json")
      .then((res) => res.json())
      .then((data) => setGeoJson(data))
      .catch((err) => console.error("Failed to load map data:", err));
  }, []);

  // Create D3 Projection
  // Standard projection settings for Indonesia
  const projection = useMemo(() => {
    return geoMercator()
      .scale(1000)
      .center([118, -2]) // Center roughly on Indonesia
      .translate([400, 200]); // Translate to center of SVG container
  }, []);

  const pathGenerator = useMemo(
    () => geoPath().projection(projection),
    [projection],
  );

  if (!geoJson) {
    return (
      <div className="w-full h-[400px] flex items-center justify-center bg-muted/10 rounded-md border border-dashed">
        <span className="text-sm text-muted-foreground animate-pulse">
          Loading Map...
        </span>
      </div>
    );
  }

  // Helper to get color based on occupancy
  const getColor = (provName: string) => {
    const stat = provinceStats.find((p) => p.province === provName);
    if (!stat || stat.totalShows === 0) return "fill-muted/30 stroke-muted";

    const pct = stat.occupancyPct;
    const tierSize = 3.0; // 27% / 9 tiers

    // Tier 1-3: Red
    if (pct < tierSize) return "fill-red-300 hover:fill-red-200 stroke-background";
    if (pct < tierSize * 2) return "fill-red-500 hover:fill-red-400 stroke-background";
    if (pct < tierSize * 3) return "fill-red-700 hover:fill-red-600 stroke-background";

    // Tier 4-6: Amber
    if (pct < tierSize * 4) return "fill-amber-300 hover:fill-amber-200 stroke-background";
    if (pct < tierSize * 5) return "fill-amber-500 hover:fill-amber-400 stroke-background";
    if (pct < tierSize * 6) return "fill-amber-700 hover:fill-amber-600 stroke-background";

    // Tier 7-9: Green
    if (pct < tierSize * 7) return "fill-green-300 hover:fill-green-200 stroke-background";
    if (pct < tierSize * 8) return "fill-green-500 hover:fill-green-400 stroke-background";
    return "fill-green-700 hover:fill-green-600 stroke-background";
  };

  const handleMouseEnter = (e: React.MouseEvent, provName: string) => {
    const stat = provinceStats.find((p) => p.province === provName);
    if (stat) {
      setHoveredProvince(stat);
      if (tooltipRef.current) {
        tooltipRef.current.style.left = `${e.clientX + 15}px`;
        tooltipRef.current.style.top = `${e.clientY + 15}px`;
      }
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (hoveredProvince && tooltipRef.current) {
      tooltipRef.current.style.left = `${e.clientX + 15}px`;
      tooltipRef.current.style.top = `${e.clientY + 15}px`;
    }
  };

  const handleMouseLeave = () => {
    setHoveredProvince(null);
  };

  return (
    <div className="relative w-full overflow-hidden bg-[#f8fcfd] dark:bg-muted/5 rounded-md border">
      <svg
        viewBox="0 0 800 400"
        className="w-full h-auto cursor-crosshair drop-shadow-sm"
        onMouseMove={handleMouseMove}
      >
        <g>
          {geoJson.features.map((feature: GeoJsonFeature, i: number) => {
            const provName = feature.properties.Propinsi;
            return (
              <path
                key={`prov-${i}`}
                d={pathGenerator(feature as any /* eslint-disable-line @typescript-eslint/no-explicit-any */) || ""}
                className={`transition-colors duration-300 stroke-[0.5] ${getColor(provName)}`}
                onMouseEnter={(e) => handleMouseEnter(e, provName)}
                onMouseLeave={handleMouseLeave}
              />
            );
          })}
        </g>
      </svg>

      {/* Custom Tooltip */}
      <div
        ref={tooltipRef}
        className={`fixed z-50 pointer-events-none bg-popover/95 backdrop-blur-sm border shadow-lg rounded-lg p-3 w-48 transition-opacity duration-200 ${
          hoveredProvince ? "opacity-100" : "opacity-0"
        }`}
        style={{ left: "-9999px", top: "-9999px" }}
      >
        {hoveredProvince && (
          <>
            <h4 className="font-semibold text-sm border-b pb-1 mb-2 leading-tight">
              {hoveredProvince.province}
            </h4>
            <div className="space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Occupancy:</span>
                <span
                  className={`font-mono font-bold ${
                    hoveredProvince.occupancyPct >= 18.0
                      ? "text-green-500"
                      : hoveredProvince.occupancyPct < 9.0
                        ? "text-red-500"
                        : "text-amber-500"
                  }`}
                >
                  {" "}
                  {hoveredProvince.occupancyPct.toFixed(1)}%
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Sold / Pot:</span>
                <span className="font-mono">
                  {hoveredProvince.totalSold.toLocaleString()} /{" "}
                  {hoveredProvince.totalPotential.toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Shows:</span>
                <span className="font-mono">{hoveredProvince.totalShows}</span>
              </div>
              {hoveredProvince.topCity && (
                <div className="mt-2 pt-2 border-t border-dashed text-[10px]">
                  <span className="text-muted-foreground block mb-0.5">
                    Top City:
                  </span>
                  <span className="font-medium text-foreground">
                    {hoveredProvince.topCity.city} (
                    {hoveredProvince.topCity.occupancyPct.toFixed(0)}%)
                  </span>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
