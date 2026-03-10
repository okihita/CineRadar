'use client';

import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertCircle, Code, Table } from 'lucide-react';
import { cn } from '@/lib/utils';

// The layout from the scraper is a simple array format:
// [[row_name, [status1, status2, ...]], ...]
// where 1 = available, 0 = sold/blocked
type SimpleLayoutGrid = [string, number[]][];

// Alternative object format (for future compatibility)
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

// Union type for both formats
type LayoutGrid = SimpleLayoutGrid | ObjectLayoutGrid;

interface SeatMapVisualizerProps {
    initialLayout: LayoutGrid | null;
    finalLayout: LayoutGrid | null;
}

// Seat status definition for visualization
type VisSeatStatus = 'available' | 'blocked' | 'sold' | 'unknown' | 'gap';

// Type guard to check if layout is in simple array format
function isSimpleFormat(layout: LayoutGrid | null): layout is SimpleLayoutGrid {
    if (!layout || layout.length === 0) return false;
    const firstItem = layout[0];
    return Array.isArray(firstItem) && (typeof firstItem[0] === 'string' || firstItem.length === 2);
}

// Normalize layout to a common format for processing
interface NormalizedRow {
    rowName: string;
    seats: { index: number; status: number }[];
}

function normalizeLayout(layout: LayoutGrid | null): NormalizedRow[] {
    if (!layout || layout.length === 0) return [];

    if (isSimpleFormat(layout)) {
        // Simple format: [[row_name, [status1, status2, ...]], ...]
        return layout.map(([rowName, statuses]) => ({
            rowName,
            seats: statuses.map((status, index) => ({ index, status }))
        }));
    } else {
        // Object format: [{ row_name: "A", seats: [{ id: "A1", status: 0 }, ...] }]
        return (layout as ObjectLayoutGrid).map((row, rowIndex) => {
            const rowName = row.row_name || row.rowName || row.row || String.fromCharCode(65 + rowIndex);
            const seatsArray = (row.seats || row.seat || []) as (Seat | null)[];
            
            return {
                rowName,
                seats: seatsArray
                    .filter(seat => seat !== null)
                    .map((seat, index) => ({
                        index,
                        status: seat?.status ?? 0
                    }))
            };
        });
    }
}

export function SeatMapVisualizer({ initialLayout, finalLayout }: SeatMapVisualizerProps) {
    const [viewMode, setViewMode] = useState<'visual' | 'json'>('visual');
    
    const hasBaseline = initialLayout !== null && initialLayout.length > 0;

    // Normalize both layouts
    const normalizedInitial = useMemo(() => normalizeLayout(initialLayout), [initialLayout]);
    const normalizedFinal = useMemo(() => normalizeLayout(finalLayout), [finalLayout]);

    // Build a map of initial seat states for O(1) lookup
    // key: rowName_seatIndex -> status
    const initialSeatMap = useMemo(() => {
        const map = new Map<string, number>();
        if (!hasBaseline) return map;
        
        normalizedInitial.forEach(row => {
            row.seats.forEach(seat => {
                map.set(`${row.rowName}_${seat.index}`, seat.status);
            });
        });
        return map;
    }, [normalizedInitial, hasBaseline]);

    // Check if we have final data to visualize at all
    if (!finalLayout || finalLayout.length === 0) {
        return (
            <Card className="w-full h-full flex items-center justify-center min-h-[200px] bg-muted/20">
                <p className="text-muted-foreground text-sm italic">No layout data available for this showtime.</p>
            </Card>
        );
    }

    // Process the final layout to determine the true visual status of each seat
    const determineSeatStatus = (rowName: string, seatIndex: number, finalStatus: number): VisSeatStatus => {
        // Status: 1 = available, 0 = sold/blocked
        const isFinalAvailable = finalStatus === 1;
        
        // If it's available now, it's just available
        if (isFinalAvailable) return 'available';

        // Seat is unavailable in final layout. We need to check the baseline.
        if (!hasBaseline) {
            // We don't have morning data, so we can't tell if it was blocked or actually sold.
            return 'unknown';
        }

        const initialStatus = initialSeatMap.get(`${rowName}_${seatIndex}`);
        
        // If it was already unavailable in the morning, it's a blocked seat.
        if (initialStatus === 0) {
            return 'blocked';
        }

        // It was available in the morning, but unavailable now -> True Audience (Sold)
        return 'sold';
    };

    return (
        <Card className="w-full flex flex-col h-full border">
            <CardHeader className="py-3 px-4 border-b bg-muted/10">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-sm flex items-center gap-2">
                        Seat Layout Map
                        {!hasBaseline && (
                            <Badge variant="outline" className="text-[10px] h-5 bg-amber-500/10 text-amber-600 border-amber-500/20 ml-2">
                                Baseline Missing
                            </Badge>
                        )}
                    </CardTitle>
                    <div className="flex items-center gap-4">
                        {/* View mode toggle */}
                        <div className="flex items-center gap-1 border rounded-md p-0.5">
                            <Button
                                variant={viewMode === 'visual' ? 'secondary' : 'ghost'}
                                size="sm"
                                className="h-6 px-2 text-xs"
                                onClick={() => setViewMode('visual')}
                            >
                                <Table className="w-3 h-3 mr-1" />
                                Visual
                            </Button>
                            <Button
                                variant={viewMode === 'json' ? 'secondary' : 'ghost'}
                                size="sm"
                                className="h-6 px-2 text-xs"
                                onClick={() => setViewMode('json')}
                            >
                                <Code className="w-3 h-3 mr-1" />
                                JSON
                            </Button>
                        </div>
                        
                        {/* Legend - only show in visual mode */}
                        {viewMode === 'visual' && (
                            <div className="flex items-center gap-4 text-xs">
                                <div className="flex items-center gap-1.5">
                                    <div className="w-3 h-3 rounded-sm bg-muted border border-border" />
                                    <span className="text-muted-foreground">Available</span>
                                </div>
                                {hasBaseline ? (
                                    <>
                                        <div className="flex items-center gap-1.5">
                                            <div className="w-3 h-3 rounded-sm bg-green-500 border border-green-600" />
                                            <span className="text-muted-foreground">Sold (Delta)</span>
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                            <div className="w-3 h-3 rounded-sm bg-red-500/20 border border-red-500/30" />
                                            <span className="text-muted-foreground">Blocked</span>
                                        </div>
                                    </>
                                ) : (
                                    <div className="flex items-center gap-1.5">
                                        <div className="w-3 h-3 rounded-sm bg-amber-500 border border-amber-600" />
                                        <span className="text-muted-foreground">Unavailable</span>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </CardHeader>
            <CardContent className="p-4 flex-1 overflow-auto">
                {!hasBaseline && viewMode === 'visual' && (
                    <div className="mb-4 bg-amber-500/10 border border-amber-500/20 rounded-md p-2 flex items-start gap-2 text-amber-700 text-xs">
                        <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                        <p>Missing 1:45 AM baseline data. We cannot visually differentiate between seats blocked by the cinema and actual tickets sold.</p>
                    </div>
                )}
                
                {viewMode === 'json' ? (
                    /* JSON Debug View */
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        <div>
                            <h4 className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-2">
                                Initial Layout (1:45 AM Baseline)
                                {hasBaseline ? (
                                    <Badge variant="outline" className="text-[10px] h-4 bg-green-500/10 text-green-600">Available</Badge>
                                ) : (
                                    <Badge variant="outline" className="text-[10px] h-4 bg-red-500/10 text-red-600">Missing</Badge>
                                )}
                            </h4>
                            <pre className="text-[10px] bg-muted/50 p-2 rounded-md overflow-auto max-h-[400px] border font-mono">
                                {initialLayout ? JSON.stringify(initialLayout, null, 2) : 'null'}
                            </pre>
                        </div>
                        <div>
                            <h4 className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-2">
                                Final Layout (Latest Scrape)
                                <Badge variant="outline" className="text-[10px] h-4 bg-blue-500/10 text-blue-600">Available</Badge>
                            </h4>
                            <pre className="text-[10px] bg-muted/50 p-2 rounded-md overflow-auto max-h-[400px] border font-mono">
                                {JSON.stringify(finalLayout, null, 2)}
                            </pre>
                        </div>
                    </div>
                ) : (
                    /* Visual Grid View */
                    <div className="min-w-fit flex flex-col items-center">
                        {/* Screen Indicator */}
                        <div className="w-[80%] max-w-lg h-2 bg-gradient-to-b from-primary/20 to-transparent border-t-2 border-primary/40 rounded-t-[50%] mb-8 mx-auto mt-2" />
                        
                        {/* Seating Grid */}
                        <div className="flex flex-col gap-1.5 pb-4">
                            {normalizedFinal.map((row, i) => {
                                return (
                                    <div key={`row-${row.rowName}-${i}`} className="flex items-center gap-1.5 justify-center">
                                        {/* Row Label Left */}
                                        <div className="w-5 text-[10px] font-mono font-medium text-muted-foreground/50 text-right pr-1">
                                            {row.rowName}
                                        </div>
                                        
                                        {/* Seats */}
                                        <div className="flex gap-0.5">
                                            {row.seats.map((seat) => {
                                                const status = determineSeatStatus(row.rowName, seat.index, seat.status);
                                                
                                                // Colors mapped to status
                                                const statusClasses: Record<VisSeatStatus, string> = {
                                                    'available': 'bg-muted border border-border text-muted-foreground/30 hover:bg-muted/80',
                                                    'blocked': 'bg-red-500/20 border border-red-500/30 text-red-500/40 cursor-not-allowed',
                                                    'sold': 'bg-green-500 border border-green-600 text-white shadow-sm',
                                                    'unknown': 'bg-amber-500 border border-amber-600 text-white shadow-sm',
                                                    'gap': 'invisible pointer-events-none',
                                                };
                                                
                                                return (
                                                    <div 
                                                        key={`seat-${row.rowName}-${seat.index}`}
                                                        className={cn(
                                                            'w-4 h-4 md:w-5 md:h-5 rounded-t-md rounded-b-sm flex items-center justify-center',
                                                            'text-[7px] md:text-[8px] font-medium transition-colors cursor-default',
                                                            statusClasses[status]
                                                        )}
                                                        title={`Row ${row.rowName}, Seat ${seat.index + 1} - ${status.charAt(0).toUpperCase() + status.slice(1)}`}
                                                    >
                                                        {seat.index + 1}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                        
                                        {/* Row Label Right */}
                                        <div className="w-5 text-[10px] font-mono font-medium text-muted-foreground/50 pl-1">
                                            {row.rowName}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
