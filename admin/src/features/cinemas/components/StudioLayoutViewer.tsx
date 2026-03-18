'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Code, Table } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

interface Seat {
    id: string;
    type: string;
    grade?: string;
}

interface LayoutRow {
    row_name: string;
    seats: Seat[];
}

interface StudioLayoutViewerProps {
    layout: LayoutRow[];
    totalSeats: number;
}

export function StudioLayoutViewer({ layout, totalSeats }: StudioLayoutViewerProps) {
    const [viewMode, setViewMode] = useState<'visual' | 'json'>('visual');

    if (!layout || layout.length === 0) {
        return (
            <div className="w-full h-full flex flex-col items-center justify-center p-4 min-h-[150px] bg-muted/20 border rounded-md mt-2">
                <p className="text-muted-foreground text-sm italic">No layout data available yet.</p>
                <p className="text-xs text-muted-foreground/70 mt-1">Wait for the bootstrap scraper to populate this studio.</p>
            </div>
        );
    }

    return (
        <Card className="w-full flex flex-col mt-3 border bg-card/50">
            <CardHeader className="py-2 px-3 border-b bg-muted/10 flex flex-row items-center justify-between">
                <CardTitle className="text-xs flex items-center gap-2 font-medium text-muted-foreground">
                    Physical Master Layout
                    <Badge variant="outline" className="text-[10px] h-4 bg-primary/5 text-primary border-primary/20">
                        {totalSeats} Seats
                    </Badge>
                </CardTitle>
                <div className="flex items-center gap-1 border rounded-md p-0.5 bg-background">
                    <Button
                        variant={viewMode === 'visual' ? 'secondary' : 'ghost'}
                        size="sm"
                        className="h-5 px-2 text-[10px]"
                        onClick={() => setViewMode('visual')}
                    >
                        <Table className="w-3 h-3 mr-1" />
                        Visual
                    </Button>
                    <Button
                        variant={viewMode === 'json' ? 'secondary' : 'ghost'}
                        size="sm"
                        className="h-5 px-2 text-[10px]"
                        onClick={() => setViewMode('json')}
                    >
                        <Code className="w-3 h-3 mr-1" />
                        JSON
                    </Button>
                </div>
            </CardHeader>
            <CardContent className="p-3 overflow-auto">
                {viewMode === 'json' ? (
                    <pre className="text-[10px] bg-muted/50 p-2 rounded-md overflow-auto max-h-[300px] border font-mono">
                        {JSON.stringify(layout, null, 2)}
                    </pre>
                ) : (
                    <div className="min-w-fit flex flex-col items-center py-2">
                        {/* Screen Indicator */}
                        <div className="w-[80%] max-w-sm h-1.5 bg-gradient-to-b from-primary/20 to-transparent border-t border-primary/40 rounded-t-[50%] mb-6 mx-auto" />
                        
                        {/* Seating Grid */}
                        <div className="flex flex-col gap-1">
                            {layout.map((row, i) => (
                                <div key={`row-${row.row_name}-${i}`} className="flex items-center gap-1 justify-center">
                                    <div className="w-4 text-[9px] font-mono font-medium text-muted-foreground/50 text-right pr-0.5">
                                        {row.row_name}
                                    </div>
                                    
                                    <div className="flex gap-0.5">
                                        {row.seats.map((seat, j) => {
                                            if (seat.type === 'aisle') {
                                                return <div key={`aisle-${i}-${j}`} className="w-3 h-3 md:w-4 md:h-4 invisible" />;
                                            }
                                            
                                            return (
                                                <div 
                                                    key={`seat-${seat.id || `${i}-${j}`}`}
                                                    className={cn(
                                                        'w-3 h-3 md:w-4 md:h-4 rounded-t-sm rounded-b-[2px] flex items-center justify-center',
                                                        'text-[6px] md:text-[7px] font-medium transition-colors cursor-default',
                                                        'bg-muted border border-border text-muted-foreground hover:bg-muted/80'
                                                    )}
                                                    title={`Seat ${seat.id}`}
                                                >
                                                    {/* Optional: extract seat number if needed, usually seat.id is like A1, A2 */}
                                                    {seat.id ? seat.id.replace(/^[A-Z]+/, '') : ''}
                                                </div>
                                            );
                                        })}
                                    </div>
                                    
                                    <div className="w-4 text-[9px] font-mono font-medium text-muted-foreground/50 pl-0.5">
                                        {row.row_name}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
