"use client";
import React, { useMemo, useState } from "react";
import { Trophy, ArrowUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { CityPerformance } from "../hooks/useCityAggregation";

interface CityPotentialRadarProps {
  cityStats: CityPerformance[];
}

type SortField =
  | "city"
  | "shows"
  | "theatres"
  | "potential"
  | "occupancy"
  | "sold";
type SortDirection = "asc" | "desc";

function SortIcon({ field, sortField }: { field: SortField, sortField: SortField }) {
  if (sortField !== field) return <ArrowUpDown className="w-3 h-3 ml-1 opacity-20 inline-block" />;
  return <ArrowUpDown className="w-3 h-3 ml-1 text-primary inline-block" />;
}

export function CityPotentialRadar({ cityStats }: CityPotentialRadarProps) {
  const [sortField, setSortField] = useState<SortField>("shows");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  const topCities = useMemo(() => {
    const sorted = [...cityStats].sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case "city": comparison = a.city.localeCompare(b.city); break;
        case "shows": comparison = a.totalShows - b.totalShows; break;
        case "theatres": comparison = a.totalTheatres - b.totalTheatres; break;
        case "potential": comparison = a.totalPotential - b.totalPotential; break;
        case "occupancy": comparison = a.occupancyPct - b.occupancyPct; break;
        case "sold": comparison = a.totalSold - b.totalSold; break;
      }
      return sortDirection === "asc" ? comparison : -comparison;
    });
    return sorted.slice(0, 15);
  }, [cityStats, sortField, sortDirection]);

  const handleSort = (field: SortField) => {
    if (sortField === field) setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    else { setSortField(field); setSortDirection("desc"); }
  };

  if (cityStats.length === 0) return null;

  return (
    <div className="h-full overflow-hidden flex flex-col">
        {/* Mobile Header (Only visible when not XL) */}
        <div className="xl:hidden p-4 border-b bg-muted/20 flex items-center gap-2 text-xs font-black uppercase tracking-widest">
            <Trophy className="w-3.5 h-3.5 text-amber-500" />
            Top 15 Core Markets
        </div>

        <div className="overflow-x-auto flex-1 rounded-lg border border-border/60 shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/30 text-left text-muted-foreground text-[9px] font-black uppercase tracking-widest">
                <th className="py-2 px-4 cursor-pointer hover:bg-muted/50" onClick={() => handleSort("city")}>City <SortIcon field="city" sortField={sortField} /></th>
                <th className="py-2 px-4 text-right cursor-pointer hover:bg-muted/50" onClick={() => handleSort("theatres")}>
                  <div className="flex items-center justify-end gap-1"><span>Theatres</span><SortIcon field="theatres" sortField={sortField} /></div>
                </th>
                <th className="py-2 px-4 text-right cursor-pointer hover:bg-muted/50" onClick={() => handleSort("shows")}>Shows <SortIcon field="shows" sortField={sortField} /></th>
                <th className="py-2 px-4 text-right cursor-pointer hover:bg-muted/50 hidden sm:table-cell" onClick={() => handleSort("potential")}>Capacity <SortIcon field="potential" sortField={sortField} /></th>
                <th className="py-2 px-4 w-28 cursor-pointer hover:bg-muted/50" onClick={() => handleSort("occupancy")}>OCR <SortIcon field="occupancy" sortField={sortField} /></th>
                <th className="py-2 px-4 text-right cursor-pointer hover:bg-muted/50" onClick={() => handleSort("sold")}>Sold <SortIcon field="sold" sortField={sortField} /></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {topCities.map((city, idx) => (
                <tr key={city.city} className="hover:bg-primary/[0.02] even:bg-muted/20 transition-colors">
                  <td className="py-1.5 px-4">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-muted-foreground font-black font-mono w-4 opacity-40">{idx + 1}.</span>
                      <span className="font-bold text-[11px] uppercase tracking-tight line-clamp-1">{city.city}</span>
                    </div>
                  </td>
                  <td className="py-1.5 px-4 text-right font-mono font-bold text-[10px] opacity-60">{city.totalTheatres}</td>
                  <td className="py-1.5 px-4 text-right font-mono font-bold text-[10px] opacity-60">{city.totalShows}</td>
                  <td className="py-1.5 px-4 text-right font-mono font-bold text-[10px] opacity-60 hidden sm:table-cell">{city.totalPotential.toLocaleString()}</td>
                  <td className="py-1.5 px-4">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1 bg-muted rounded-full overflow-hidden max-w-[40px]">
                        <div
                          className={cn(
                            "h-full rounded-full",
                            city.occupancyPct >= 10 ? "bg-green-500" : city.occupancyPct < 5 ? "bg-red-500" : "bg-amber-500",
                          )}
                          style={{ width: `${Math.min(city.occupancyPct, 100)}%` }}
                        />
                      </div>
                      <span className="text-[10px] font-black font-mono w-8 text-right opacity-80">{city.occupancyPct.toFixed(1)}%</span>
                    </div>
                  </td>
                  <td className="py-1.5 px-4 text-right font-mono font-black text-[11px] text-foreground tabular-nums">{city.totalSold.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
    </div>
  );
}
