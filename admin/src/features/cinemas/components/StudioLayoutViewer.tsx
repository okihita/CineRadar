'use client';

import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';
import type { Studio, LayoutRow, PriceGroups } from '../hooks/useTheatreStudios';
import { parseAnyToLayout, type TixRawPayload, type AuditSeat } from '../utils/layout-parser';

interface StudioLayoutViewerProps {
    studio: Studio;
    showLegend?: boolean;
    proofData?: TixRawPayload;
    isLoading?: boolean; // NEW: Parent-controlled loading state
}

/**
 * Sub-component for individual seat rendering
 */
function StudioSeat({ 
    seat, 
    priceGroups, 
    isProofMode 
}: { 
    seat: AuditSeat; 
    priceGroups?: PriceGroups; 
    isProofMode: boolean 
}) {
    const metadata = seat.grade ? priceGroups?.[seat.grade] : null;
    const seatColor = (isProofMode && seat.visualColor) ? seat.visualColor : (metadata?.color || seat.color);
    
    const customStyle = seatColor ? {
        backgroundColor: `${seatColor}${isProofMode ? '35' : '15'}`,
        borderColor: `${seatColor}${isProofMode ? '90' : '60'}`,
        color: seatColor
    } : {};

    return (
        <div 
            className={cn(
                'w-3.5 h-3.5 md:w-4 md:h-4 rounded-t-sm rounded-b-[2px] flex items-center justify-center transition-all border',
                seat.type === 'aisle' ? 'invisible' : 'bg-background border-border text-[7px] font-bold'
            )}
            style={seat.type === 'seat' ? customStyle : {}}
            title={`Seat ${seat.id}${isProofMode ? ` (${seat.statusLabel || `Raw Status: ${seat.rawStatus}`})` : ''}`}
        >
            {seat.type === 'seat' && seat.id ? seat.id.replace(/^[A-Z]+/, '') : ''}
        </div>
    );
}

/**
 * Zen Visualizer (Solid State): Never unmounts. Handles its own loading overlays.
 */
export function StudioLayoutViewer({ studio, showLegend = false, proofData, isLoading = false }: StudioLayoutViewerProps) {
    const isProofMode = !!proofData;
    
    // Stable Visual Layout Engine
    const visualLayout = useMemo(() => {
        if (proofData) {
            return parseAnyToLayout(proofData, []);
        }
        if (studio.physical_layout?.grid) return studio.physical_layout.grid;
        if (studio.layout) return studio.layout;
        return [];
    }, [studio.physical_layout, studio.layout, proofData]);

    const hasLayout = visualLayout.length > 0;

    return (
        <div className="w-full flex flex-col relative">
            {/* High-Precision Loading Overlay (Subtle) */}
            {isLoading && (
                <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/40 backdrop-blur-[1px] rounded-xl transition-all animate-in fade-in duration-200">
                    <div className="bg-background/80 px-3 py-1.5 rounded-full border shadow-sm flex items-center gap-2">
                        <Loader2 className="w-3 h-3 animate-spin text-primary" />
                        <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Fetching Specimen...</span>
                    </div>
                </div>
            )}

            <div className={cn("relative transition-opacity duration-300", isLoading ? "opacity-40 grayscale-[0.5]" : "opacity-100")}>
                {!hasLayout ? (
                    <div className="w-full flex flex-col items-center justify-center p-8 min-h-[200px] bg-muted/10 border border-dashed rounded-xl text-center">
                        <p className="text-muted-foreground text-sm italic font-medium">No visual layout available.</p>
                    </div>
                ) : (
                    <div className="w-full overflow-x-auto custom-scrollbar bg-muted/5 rounded-xl border border-border/30">
                        <div className="min-w-fit flex flex-col items-center py-4 px-6">
                            {/* Screen Indicator */}
                            <div className="w-[70%] max-w-[280px] h-1.5 bg-gradient-to-b from-primary/30 to-transparent border-t border-primary/40 rounded-t-[50%] mb-8 mx-auto opacity-80" />
                            
                            <div className="flex flex-col gap-1.5">
                                {visualLayout.map((row: LayoutRow, i: number) => {
                                    if (!row.seats.some(s => s.type === 'seat')) return null;
                                    return (
                                        <div key={i} className="flex items-center gap-1.5 justify-center">
                                            <div className="w-5 text-[9px] font-mono font-bold text-muted-foreground/40 text-right pr-1">{row.row_name}</div>
                                            <div className="flex gap-1">
                                                {row.seats.map((seat: AuditSeat, j: number) => (
                                                    <StudioSeat 
                                                        key={j} 
                                                        seat={seat} 
                                                        priceGroups={studio.price_groups} 
                                                        isProofMode={isProofMode} 
                                                    />
                                                ))}
                                            </div>
                                            <div className="w-5 text-[9px] font-mono font-bold text-muted-foreground/40 pl-1">{row.row_name}</div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Visual Legend */}
            {showLegend && isProofMode && (
                <div className="mt-4 flex items-center gap-4 px-1 py-1 border-b border-border/30 pb-2">
                    <div className="flex items-center gap-1.5">
                        <div className="w-2.5 h-2.5 rounded-sm bg-green-500 border border-green-600/20" />
                        <span className="text-[9px] font-bold uppercase text-green-700/70">Available</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <div className="w-2.5 h-2.5 rounded-sm bg-[#f59e0b] border border-amber-600/20" />
                        <span className="text-[9px] font-bold uppercase text-amber-700/70">Booked (Status Code 5)</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <div className="w-2.5 h-2.5 rounded-sm bg-red-500 border border-red-600/20" />
                        <span className="text-[9px] font-bold uppercase text-red-700/70">Sold/Dead (Status Code 6)</span>
                    </div>
                </div>
            )}
        </div>
    );
}
