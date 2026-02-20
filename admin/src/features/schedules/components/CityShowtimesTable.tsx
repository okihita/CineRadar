"use client";

import { useMemo } from "react";
import { CitySchedule, countTheatreShowtimes } from "../types";

interface CityShowtimesTableProps {
    cityData: CitySchedule;
}

export function CityShowtimesTable({ cityData }: CityShowtimesTableProps) {
    const rows = useMemo(() => {
        return Object.entries(cityData || {})
            .map(([city, theatres]) => {
                let showtimes = 0;
                let available = 0;
                theatres.forEach(t => {
                    showtimes += countTheatreShowtimes(t);
                    available += (t.rooms || []).reduce((sum, room) => sum + (room.all_showtimes || []).filter(s => s.is_available).length, 0);
                });
                return { city, showtimes, available, theatres: theatres.length };
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
                        <th className="text-right py-1.5 px-2 text-xs font-medium text-muted-foreground">Theatres</th>
                        <th className="text-right py-1.5 px-2 text-xs font-medium text-muted-foreground">Showtimes</th>
                    </tr>
                </thead>
                <tbody>
                    {rows.map(row => (
                        <tr key={row.city} className="border-b border-border/50 even:bg-muted/5 hover:bg-muted/20 transition-colors">
                            <td className="py-2 px-2 text-xs">{row.city}</td>
                            <td className="py-2 px-2 text-xs text-right tabular-nums text-muted-foreground">{row.theatres}</td>
                            <td className="py-2 px-2 text-xs text-right tabular-nums">
                                <span className="font-medium text-foreground">{row.available}</span>
                                <span className="text-muted-foreground/60"> / {row.showtimes}</span>
                                <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-muted/50 text-muted-foreground">
                                    {row.showtimes > 0 ? ((row.available / row.showtimes) * 100).toFixed(0) : 0}%
                                </span>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
