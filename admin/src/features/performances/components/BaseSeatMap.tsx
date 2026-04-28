'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { ExternalLink } from 'lucide-react';
import Link from 'next/link';

// Shared types from the existing visualizer logic
type VisSeatStatus = 'available' | 'blocked' | 'sold' | 'gap' | 'master';

interface BaseSeatMapProps {
    title: string;
    subtitle: string;
    rows: Array<{
        rowName: string;
        seats: Array<{
            id: string;
            status: VisSeatStatus;
            label: string;
        }>;
    }>;
    type: 'baseline' | 'showtime' | 'master';
    href?: string;
    studioId?: string;
}

/**
 * Low-level seat map renderer for side-by-side auditing.
 */
export function BaseSeatMap({ title, subtitle, rows, type, href, studioId }: BaseSeatMapProps) {
    const getSeatStyles = (status: VisSeatStatus) => {
        switch (status) {
            case 'available':
                return 'bg-muted border border-border text-muted-foreground/30';
            case 'sold':
                return 'bg-green-500 border border-green-600 text-white shadow-sm font-bold';
            case 'blocked':
                return 'bg-red-500/20 border border-red-500/30 text-red-500/40';
            case 'master':
                return 'bg-purple-500/10 border border-purple-500/30 text-purple-600/50';
            case 'gap':
                return 'invisible';
            default:
                return 'bg-zinc-100';
        }
    };

    return (
        <div className="flex flex-col h-full border rounded-xl bg-card overflow-hidden shadow-sm animate-in fade-in duration-500">
            {/* Header */}
            <div className="p-3 border-b bg-muted/10">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <h3 className={cn(
                            "text-[10px] font-black uppercase tracking-widest",
                            type === 'baseline' && "text-orange-600",
                            type === 'showtime' && "text-green-600",
                            type === 'master' && "text-purple-600"
                        )}>
                            {title}
                        </h3>
                    </div>
                    <div className={cn(
                        "w-2 h-2 rounded-full",
                        type === 'baseline' && "bg-orange-500 animate-pulse",
                        type === 'showtime' && "bg-green-500 animate-pulse",
                        type === 'master' && "bg-purple-500"
                    )} />
                </div>
                <p className="text-[9px] text-muted-foreground font-bold uppercase tracking-tight mt-0.5">
                    {subtitle}
                </p>
            </div>

            {/* Map Grid */}
            <div className="flex-1 overflow-auto p-6 bg-zinc-50/50 dark:bg-zinc-950/50">
                <div className="min-w-fit flex flex-col items-center">
                    {/* Screen Indicator */}
                    <div className="w-[60%] h-1 bg-zinc-300 dark:bg-zinc-800 rounded-full mb-10 shadow-[0_-4px_12px_rgba(0,0,0,0.05)]" />
                    
                    <div className="flex flex-col gap-1">
                        {rows.map((row, i) => (
                            <div key={`${type}-row-${row.rowName}-${i}`} className="flex items-center gap-2 justify-center">
                                <div className="w-5 text-[8px] font-mono font-black text-muted-foreground/30 text-right uppercase">
                                    {row.rowName}
                                </div>
                                <div className="flex gap-0.5">
                                    {row.seats.map((seat, j) => (
                                        <div 
                                            key={`${type}-s-${seat.id}-${i}-${j}`} 
                                            className={cn(
                                                'w-3.5 h-3.5 md:w-4 md:h-4 rounded-t-sm rounded-b-[1px] flex items-center justify-center text-[7px] font-medium transition-all duration-300',
                                                getSeatStyles(seat.status)
                                            )}
                                            title={`Seat ${seat.id} (${seat.status})`}
                                        >
                                            {seat.label}
                                        </div>
                                    ))}
                                </div>
                                <div className="w-5 text-[8px] font-mono font-black text-muted-foreground/30 text-left uppercase">
                                    {row.rowName}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Footer Legend */}
            <div className="p-2 border-t bg-muted/5 flex justify-center gap-4">
                <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-sm bg-muted border" />
                    <span className="text-[8px] font-bold text-muted-foreground uppercase">Available</span>
                </div>
                {type === 'baseline' ? (
                    <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-sm bg-red-500/20 border border-red-500/30" />
                        <span className="text-[8px] font-bold text-muted-foreground uppercase">Blocked @ 2AM</span>
                    </div>
                ) : type === 'showtime' ? (
                    <>
                        <div className="flex items-center gap-1.5">
                            <div className="w-2 h-2 rounded-sm bg-green-500 shadow-sm" />
                            <span className="text-[8px] font-bold text-muted-foreground uppercase">Delta Sold</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <div className="w-2 h-2 rounded-sm bg-red-500/20 border border-red-500/30" />
                            <span className="text-[8px] font-bold text-muted-foreground uppercase">Static Block</span>
                        </div>
                    </>
                ) : (
                    <>
                        <div className="flex items-center gap-1.5">
                            <div className="w-2 h-2 rounded-sm bg-purple-500/10 border border-purple-500/30" />
                            <span className="text-[8px] font-bold text-muted-foreground uppercase">Physical Slot</span>
                        </div>
                        <div className="flex items-center gap-2 ml-2 pl-2 border-l border-border/50">
                            {studioId && (
                                <span className="text-[8px] font-black uppercase tracking-tighter text-purple-500/70 bg-purple-500/5 border border-purple-500/10 px-1.5 py-0.5 rounded">
                                    Studio {studioId}
                                </span>
                            )}
                            {href && (
                                <Link 
                                    href={href} 
                                    target="_blank"
                                    className="inline-flex items-center gap-1 text-[8px] font-black uppercase tracking-widest text-purple-600 bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/20 px-2 py-0.5 rounded transition-all"
                                >
                                    <ExternalLink className="w-2.5 h-2.5" />
                                    Asset Registry
                                </Link>
                            )}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
