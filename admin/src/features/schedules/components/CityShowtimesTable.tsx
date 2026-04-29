"use client";

import { useMemo } from "react";
import { CitySchedule, countTheatreShowtimes } from "../types";
import { CHAIN_TAILWIND } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { computeCityChains } from "../utils/schedule-helpers";

interface CityShowtimesTableProps {
    cityData: CitySchedule;
}

export function CityShowtimesTable({ cityData }: CityShowtimesTableProps) {
    const rows = useMemo(() => {
        return Object.entries(cityData)
            .map(([city, theatres]) => {
                let showtimes = 0;
                let available = 0;
                theatres.forEach(t => {
                    showtimes += countTheatreShowtimes(t);
                    available += t.rooms.reduce((sum, room) => sum + room.all_showtimes.filter(s => s.is_available).length, 0);
                });
                const chains = computeCityChains(theatres);
                return { city, showtimes, available, theatres: theatres.length, chains };
            })
            .sort((a, b) => b.showtimes - a.showtimes);
    }, [cityData]);

    if (rows.length === 0) return null;

    return (
        <div>
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                By City
            </h4>
            <table className="w-full text-sm">
                <thead>
                    <tr className="border-b border-border">
                        <th className="text-left py-1.5 px-2 text-xs font-medium text-muted-foreground">City</th>
                        <th className="text-left py-1.5 px-2 text-xs font-medium text-muted-foreground">Chains</th>
                        <th className="text-center py-1.5 px-2 text-xs font-medium text-muted-foreground">Availability</th>
                        <th className="text-right py-1.5 px-2 text-xs font-medium text-muted-foreground">Theatres</th>
                        <th className="text-right py-1.5 px-2 text-xs font-medium text-muted-foreground">Showtimes</th>
                    </tr>
                </thead>
                <tbody>
                    {rows.map(row => {
                        const bookablePct = row.showtimes > 0 ? (row.available / row.showtimes) * 100 : 0;

                        return (
                            <tr key={row.city} className="border-b border-border/50 even:bg-muted/5 hover:bg-muted/20 transition-colors">
                                <td className="py-2 px-2 text-xs font-medium">{row.city}</td>
                                <td className="py-2 px-2">
                                    <div className="flex gap-1">
                                        {row.chains.map((c) => {
                                            const tw = CHAIN_TAILWIND[c.chain];
                                            return (
                                                <span key={c.chain} className={cn(
                                                    "text-[8px] font-bold uppercase px-1 py-0.5 rounded text-white",
                                                    tw?.bg || "bg-gray-500"
                                                )}>
                                                    {c.chain}
                                                </span>
                                            );
                                        })}
                                    </div>
                                </td>
                                <td className="py-2 px-2">
                                    <div className="flex items-center gap-2">
                                        <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden min-w-[60px]">
                                            <div
                                                className={cn(
                                                    "h-full rounded-full",
                                                    bookablePct > 50 ? "bg-emerald-500" : bookablePct > 20 ? "bg-amber-500" : "bg-red-500"
                                                )}
                                                style={{ width: `${Math.min(bookablePct, 100)}%` }}
                                            />
                                        </div>
                                        <span className="text-[10px] font-mono tabular-nums text-muted-foreground w-8 text-right">
                                            {bookablePct.toFixed(0)}%
                                        </span>
                                    </div>
                                </td>
                                <td className="py-2 px-2 text-xs text-right tabular-nums text-muted-foreground">{row.theatres}</td>
                                <td className="py-2 px-2 text-xs text-right tabular-nums">
                                    <span className="font-mono font-medium text-foreground">{row.available}</span>
                                    <span className="text-muted-foreground/60"> / {row.showtimes}</span>
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}
