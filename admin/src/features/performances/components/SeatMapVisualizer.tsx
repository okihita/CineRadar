'use client';

import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Code, Table } from 'lucide-react';
import { cn } from '@/lib/utils';

// Snapshot types (Legacy/Incremental)
type SimpleLayoutGrid = [string, number[]][];

interface Seat {
    id: string;
    status: number;
}

interface SeatRow {
    row_name?: string;
    rowName?: string;
    row?: string;
    seats?: (Seat | null)[];
    seat?: (Seat | null)[];
}

type ObjectLayoutGrid = SeatRow[];
type LayoutGrid = SimpleLayoutGrid | ObjectLayoutGrid;

// Master Layout types (Physical Baseline)
export interface MasterSeat {
    id: string;
    type: 'seat' | 'aisle';
    grade?: string;
}

export interface MasterRow {
    row_name: string;
    seats: MasterSeat[];
}

export type MasterLayout = MasterRow[];

interface SeatMapVisualizerProps {
    initialLayout: LayoutGrid | null;
    finalLayout: LayoutGrid | null;
    masterLayout?: MasterLayout | null;
    isInferred?: boolean;
    inferredStudioId?: string;
}

type VisSeatStatus = 'available' | 'blocked' | 'sold' | 'unknown' | 'gap';

// Normalization Helpers
function isSimpleFormat(layout: LayoutGrid | null): layout is SimpleLayoutGrid {
    if (!layout || layout.length === 0) return false;
    const firstItem = layout[0];
    return Array.isArray(firstItem) && (typeof firstItem[0] === 'string');
}

interface NormalizedRow {
    rowName: string;
    seats: { index: number; status: number; id: string }[];
}

function normalizeLayout(layout: LayoutGrid | null): NormalizedRow[] {
    if (!layout || layout.length === 0) return [];

    if (isSimpleFormat(layout)) {
        return layout.map(([rowName, statuses]) => {
            let seatCounter = 0;
            return {
                rowName,
                seats: statuses.map((status) => {
                    const isAisle = status === -1;
                    const seatInfo = {
                        index: isAisle ? -1 : seatCounter,
                        status,
                        id: isAisle ? `aisle_${rowName}` : `${rowName}${seatCounter + 1}`
                    };
                    if (!isAisle) seatCounter++;
                    return seatInfo;
                })
            };
        });
    } else {
        return (layout as ObjectLayoutGrid).map((row, rowIndex) => {
            const rowName = row.row_name || row.rowName || row.row || String.fromCharCode(65 + rowIndex);
            const seatsArray = (row.seats || row.seat || []) as (Seat | null)[];
            let seatCounter = 0;
            return {
                rowName,
                seats: seatsArray
                    .filter(seat => seat !== null)
                    .map((seat) => {
                        const isAisle = seat?.status === -1;
                        const seatInfo = {
                            index: isAisle ? -1 : seatCounter,
                            status: seat?.status ?? 0,
                            id: seat?.id || (isAisle ? `aisle_${rowName}` : `${rowName}${seatCounter + 1}`)
                        };
                        if (!isAisle) seatCounter++;
                        return seatInfo;
                    })
            };
        });
    }
}

export function SeatMapVisualizer({ initialLayout, finalLayout, masterLayout, isInferred, inferredStudioId }: SeatMapVisualizerProps) {
    const [viewMode, setViewMode] = useState<'visual' | 'json'>('visual');
    
    const hasBaseline = initialLayout !== null && initialLayout.length > 0;
    const hasMaster = !!masterLayout && masterLayout.length > 0;

    const normalizedInitial = useMemo(() => normalizeLayout(initialLayout), [initialLayout]);
    const normalizedFinal = useMemo(() => normalizeLayout(finalLayout), [finalLayout]);

    // Build lookup maps using ID as primary key, fallback to coordinate
    const initialSeatMap = useMemo(() => {
        const map = new Map<string, number>();
        normalizedInitial.forEach(row => {
            row.seats.forEach(seat => {
                map.set(seat.id, seat.status);
                map.set(`${row.rowName}_${seat.index}`, seat.status);
            });
        });
        return map;
    }, [normalizedInitial]);

    const finalSeatMap = useMemo(() => {
        const map = new Map<string, number>();
        normalizedFinal.forEach(row => {
            row.seats.forEach(seat => {
                map.set(seat.id, seat.status);
                map.set(`${row.rowName}_${seat.index}`, seat.status);
            });
        });
        return map;
    }, [normalizedFinal]);

    const determineStatus = (rowName: string, seatIndex: number, seatId?: string): VisSeatStatus => {
        // Try lookup by ID first, then fallback to coordinate
        const finalStatus = (seatId ? finalSeatMap.get(seatId) : undefined) ?? finalSeatMap.get(`${rowName}_${seatIndex}`);
        const initialStatus = (seatId ? initialSeatMap.get(seatId) : undefined) ?? initialSeatMap.get(`${rowName}_${seatIndex}`);

        // 0. Physical Aisle
        if (finalStatus === -1) return 'gap';

        // 1. If it's available in the latest scrape, it's available
        if (finalStatus === 1) return 'available';

        // 2. TIX ID specific occupied statuses (5, 6)
        if (finalStatus === 5 || finalStatus === 6) return 'sold';

        // 3. If it's unavailable in latest scrape (0 or other)
        if (finalStatus === 0 || finalStatus !== undefined) {
            // Check if it was already unavailable in the morning
            if (initialStatus === 0) return 'blocked';
            // It was available in the morning but not now -> Sold
            if (initialStatus === 1) return 'sold';
            
            // If there's no baseline, we must assume that any unavailable seat is SOLD.
            if (initialStatus === undefined) return 'sold';
            
            return 'unknown';
        }

        // Default if no data for this seat coordinate
        return 'available'; 
    };

    if (!hasMaster && normalizedFinal.length === 0 && normalizedInitial.length === 0) {
        return (
            <Card className="w-full h-full flex items-center justify-center min-h-[200px] bg-muted/20">
                <p className="text-muted-foreground text-sm italic">No layout data available for this showtime.</p>
            </Card>
        );
    }

    return (
        <Card className="w-full flex flex-col h-full border bg-card">
            <CardHeader className="py-3 px-4 border-b bg-muted/5 flex flex-row items-center justify-between">
                <CardTitle className="text-sm flex items-center gap-2 font-medium">
                    {hasMaster ? 'Physical Room Layout' : 'Snapshot Seating Grid'}
                    {(hasMaster && !isInferred) && (
                        <Badge variant="outline" className="text-[10px] h-5 bg-purple-500/5 text-purple-600 border-purple-500/20">
                            Master Template
                        </Badge>
                    )}
                    {isInferred && (
                        <Badge variant="outline" className="text-[10px] h-5 bg-amber-500/5 text-amber-600 border-amber-500/20" title={`Inferred studio ID: ${inferredStudioId}`}>
                            Historical Guess (Std {inferredStudioId})
                        </Badge>
                    )}
                    {!hasBaseline && (
                        <Badge variant="outline" className="text-[10px] h-5 bg-amber-500/5 text-amber-600 border-amber-500/20">
                            No Baseline
                        </Badge>
                    )}
                </CardTitle>
                <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1 border rounded-md p-0.5 bg-background mr-2">
                        <Button variant={viewMode === 'visual' ? 'secondary' : 'ghost'} size="sm" className="h-6 px-2 text-[10px]" onClick={() => setViewMode('visual')}>
                            <Table className="w-3 h-3 mr-1" /> Visual
                        </Button>
                        <Button variant={viewMode === 'json' ? 'secondary' : 'ghost'} size="sm" className="h-6 px-2 text-[10px]" onClick={() => setViewMode('json')}>
                            <Code className="w-3 h-3 mr-1" /> JSON
                        </Button>
                    </div>
                    {viewMode === 'visual' && (
                        <div className="hidden sm:flex items-center gap-3 text-[10px]">
                            <div className="flex items-center gap-1"><div className="w-2.5 h-2.5 rounded-sm bg-muted border" /><span className="text-muted-foreground">Available</span></div>
                            <div className="flex items-center gap-1"><div className="w-2.5 h-2.5 rounded-sm bg-green-500" /><span className="text-muted-foreground">Sold</span></div>
                            <div className="flex items-center gap-1"><div className="w-2.5 h-2.5 rounded-sm bg-red-500/20 border border-red-500/30" /><span className="text-muted-foreground">Blocked</span></div>
                        </div>
                    )}
                </div>
            </CardHeader>
            <CardContent className="p-4 flex-1 overflow-auto">
                {viewMode === 'json' ? (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <h4 className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Snapshots</h4>
                            <pre className="text-[10px] bg-muted/30 p-2 rounded-md border font-mono max-h-[400px] overflow-auto">
                                {JSON.stringify({ initialLayout, finalLayout }, null, 2)}
                            </pre>
                        </div>
                        <div className="space-y-2">
                            <h4 className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Master Layout</h4>
                            <pre className="text-[10px] bg-muted/30 p-2 rounded-md border font-mono max-h-[400px] overflow-auto">
                                {JSON.stringify(masterLayout, null, 2)}
                            </pre>
                        </div>
                    </div>
                ) : (
                    <div className="min-w-fit flex flex-col items-center py-4">
                        <div className="w-[70%] max-w-md h-1.5 bg-gradient-to-b from-primary/30 to-transparent border-t-2 border-primary/40 rounded-t-[50%] mb-10 mx-auto" />
                        
                        <div className="flex flex-col gap-1.5">
                            {hasMaster ? (
                                masterLayout!.map((row, i) => {
                                    let seatCounter = 0;
                                    return (
                                        <div key={`row-${row.row_name}-${i}`} className="flex items-center gap-2 justify-center">
                                            <div className="w-6 text-[10px] font-mono font-bold text-muted-foreground/40 text-right">{row.row_name}</div>
                                            <div className="flex gap-0.5">
                                                {row.seats.map((seat, j) => {
                                                    if (seat.type === 'aisle') return <div key={`a-${i}-${j}`} className="w-4 h-4 md:w-5 md:h-5" />;
                                                    
                                                    const status = determineStatus(row.row_name, seatCounter, seat.id);
                                                    seatCounter++;

                                                    const colors = {
                                                        available: 'bg-muted border border-border text-muted-foreground/30 hover:bg-muted/80',
                                                        blocked: 'bg-red-500/10 border border-red-500/20 text-red-500/30',
                                                        sold: 'bg-green-500 border border-green-600 text-white shadow-sm',
                                                        unknown: 'bg-amber-500 border border-amber-600 text-white shadow-sm',
                                                        gap: 'invisible'
                                                    }[status];

                                                    return (
                                                        <div key={`s-${seat.id}-${i}-${j}`} className={cn('w-4 h-4 md:w-5 md:h-5 rounded-t-md rounded-b-sm flex items-center justify-center text-[8px] font-medium transition-colors', colors)} title={`Seat ${seat.id} (${status})`}>
                                                            {seat.id ? seat.id.replace(row.row_name, '') : ''}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                            <div className="w-6 text-[10px] font-mono font-bold text-muted-foreground/40 text-left">{row.row_name}</div>
                                        </div>
                                    );
                                })
                            ) : (
                                (normalizedFinal.length > 0 ? normalizedFinal : normalizedInitial).map((row, i) => {
                                    // Skip padding rows (no name and no real seats)
                                    const isPaddingRow = !row.rowName.trim() && !row.seats.some(s => s.status !== -1);
                                    if (isPaddingRow) return null;

                                    return (
                                        <div key={`row-snap-${row.rowName}-${i}`} className="flex items-center gap-2 justify-center">
                                            <div className="w-6 text-[10px] font-mono font-bold text-muted-foreground/40 text-right">{row.rowName}</div>
                                            <div className="flex gap-0.5">
                                                {row.seats.map((seat) => {
                                                    const status = determineStatus(row.rowName, seat.index);
                                                    const colors = {
                                                        available: 'bg-muted border border-border text-muted-foreground/30 hover:bg-muted/80',
                                                        blocked: 'bg-red-500/10 border border-red-500/20 text-red-500/30',
                                                        sold: 'bg-green-500 border border-green-600 text-white shadow-sm',
                                                        unknown: 'bg-amber-500 border border-amber-600 text-white shadow-sm',
                                                        gap: 'invisible'
                                                    }[seat.status === -1 ? 'gap' : status];
                                                    
                                                    if (seat.status === -1) {
                                                        return <div key={`s-${row.rowName}-${seat.index}`} className="w-4 h-4 md:w-5 md:h-5 invisible" />;
                                                    }

                                                    return (
                                                        <div key={`s-${row.rowName}-${seat.index}`} className={cn('w-4 h-4 md:w-5 md:h-5 rounded-t-md rounded-b-sm flex items-center justify-center text-[8px] font-medium transition-colors', colors)}>
                                                            {seat.index + 1}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                            <div className="w-6 text-[10px] font-mono font-bold text-muted-foreground/40 text-left">{row.rowName}</div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
