"use client";

import { Card } from "@/components/ui/card";
import { CHAIN_TAILWIND } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { ChainStats } from "../utils/schedule-helpers";
import { MapPin, Film, Clock } from "lucide-react";

interface ChainDistributionProps {
    chainDistribution: ChainStats[];
}

export function ChainDistribution({ chainDistribution }: ChainDistributionProps) {
    if (chainDistribution.length === 0) return null;

    const totalShowtimes = chainDistribution.reduce((sum, c) => sum + c.showtimeCount, 0);

    return (
        <Card className="border-border/60 shadow-sm p-4">
            <div className="flex items-center gap-2 mb-3">
                <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Chain Distribution</h3>
                <span className="text-[9px] font-mono text-muted-foreground/40">{totalShowtimes.toLocaleString()} total showtimes</span>
            </div>

            <div className="space-y-2">
                {chainDistribution.map((chain) => {
                    const tw = CHAIN_TAILWIND[chain.chain];
                    const pct = totalShowtimes > 0 ? (chain.showtimeCount / totalShowtimes) * 100 : 0;

                    return (
                        <div key={chain.chain} className="flex items-center gap-3">
                            <span className={cn(
                                "text-[10px] font-black uppercase tracking-wider min-w-[4.5rem] flex-shrink-0 px-1.5 py-0.5 rounded text-white text-center",
                                tw?.bg || "bg-gray-500"
                            )}>
                                {chain.chain}
                            </span>

                            <div className="flex-1">
                                <div className="h-1.5 bg-muted/50 rounded-full overflow-hidden">
                                    <div
                                        className={cn("h-full rounded-full transition-all", tw?.bg || "bg-gray-500")}
                                        style={{ width: `${pct}%` }}
                                    />
                                </div>
                            </div>

                            <div className="flex items-center gap-3 text-[10px] text-muted-foreground flex-shrink-0">
                                <span className="flex items-center gap-1" title={`${chain.movieCount} movies`}>
                                    <Film className="h-2.5 w-2.5" />
                                    {chain.movieCount}
                                </span>
                                <span className="flex items-center gap-1" title={`${chain.theatreCount} theatres`}>
                                    <MapPin className="h-2.5 w-2.5" />
                                    {chain.theatreCount}
                                </span>
                                <span className="flex items-center gap-1 font-mono tabular-nums font-bold text-foreground" title={`${chain.showtimeCount} showtimes`}>
                                    <Clock className="h-2.5 w-2.5" />
                                    {chain.showtimeCount.toLocaleString()}
                                </span>
                            </div>
                        </div>
                    );
                })}
            </div>
        </Card>
    );
}
