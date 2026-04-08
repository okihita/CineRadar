'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Code, Table } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { JsonViewer, sortObjectKeys } from '@/components/JsonViewer';
import type { Studio } from '../hooks/useTheatreStudios';

interface StudioLayoutViewerProps {
    studio: Studio;
}

export function StudioLayoutViewer({ studio }: StudioLayoutViewerProps) {
    const [viewMode, setViewMode] = useState<'visual' | 'json'>('visual');
    const [jsonMode, setJsonMode] = useState<'unified' | 'raw'>('unified');
    const layout = studio.layout || [];
    const totalSeats = studio.total_seats || 0;

    const hasLayout = layout.length > 0;
    const hasRawLayout = !!studio.raw_initial_layout;

    const displayJson = jsonMode === 'unified' ? studio : studio.raw_initial_layout;
    const sortedJson = sortObjectKeys(displayJson);

    return (
        <div className="w-full flex flex-col mt-2">
            {/* Control Toolbar */}
            <div className="flex items-center justify-between mb-4 px-1">
                <div className="flex items-center gap-3">
                    <Badge variant="outline" className="text-[10px] h-5 bg-primary/5 text-primary border-primary/20 font-mono">
                        {totalSeats} Seats
                    </Badge>
                    
                    {viewMode === 'json' && (
                        <div className="flex items-center gap-1 bg-muted/30 p-0.5 rounded-md border border-border/50">
                            <Button
                                variant={jsonMode === 'unified' ? 'secondary' : 'ghost'}
                                size="sm"
                                className="h-5 px-2 text-[9px] font-bold"
                                onClick={() => setJsonMode('unified')}
                            >
                                Unified
                            </Button>
                            <Button
                                variant={jsonMode === 'raw' ? 'secondary' : 'ghost'}
                                size="sm"
                                className="h-5 px-2 text-[9px] font-bold"
                                onClick={() => setJsonMode('raw')}
                                disabled={!hasRawLayout}
                            >
                                Raw API
                            </Button>
                        </div>
                    )}
                </div>
                
                <div className="flex items-center gap-1 border rounded-lg p-0.5 bg-background shadow-sm">
                    <Button
                        variant={viewMode === 'visual' ? 'secondary' : 'ghost'}
                        size="sm"
                        className="h-6 px-2.5 text-[10px] font-medium"
                        onClick={() => setViewMode('visual')}
                        disabled={!hasLayout}
                    >
                        <Table className="w-3.5 h-3.5 mr-1.5" />
                        Visual
                    </Button>
                    <Button
                        variant={viewMode === 'json' ? 'secondary' : 'ghost'}
                        size="sm"
                        className="h-6 px-2.5 text-[10px] font-medium"
                        onClick={() => setViewMode('json')}
                    >
                        <Code className="w-3.5 h-3.5 mr-1.5" />
                        JSON
                    </Button>
                </div>
            </div>

            {/* Content Area */}
            <div className="relative">
                {viewMode === 'json' ? (
                    <div className="bg-muted/50 p-3 rounded-xl overflow-auto max-h-[500px] border border-border/40 font-mono">
                        <JsonViewer data={sortedJson} />
                    </div>
                ) : !hasLayout ? (
                    <div className="w-full flex flex-col items-center justify-center p-8 min-h-[200px] bg-muted/10 border border-dashed rounded-xl">
                        <p className="text-muted-foreground text-sm italic">No visual layout available yet.</p>
                        <p className="text-xs text-muted-foreground/60 mt-1">Switch to JSON mode to inspect raw data.</p>
                    </div>
                ) : (
                    <div className="min-w-fit flex flex-col items-center py-4 bg-muted/5 rounded-xl border border-border/30">
                        {/* Screen Indicator */}
                        <div className="w-[70%] max-w-[280px] h-1.5 bg-gradient-to-b from-primary/30 to-transparent border-t border-primary/40 rounded-t-[50%] mb-8 mx-auto opacity-80" />

                        {/* Seating Grid */}
                        <div className="flex flex-col gap-1.5">
                            {layout.map((row, i) => {
                                // Skip rendering padding rows (no name and no real seats)
                                const isPaddingRow = !row.row_name.trim() && !row.seats.some(s => s.type === 'seat');
                                if (isPaddingRow) return null;

                                return (
                                    <div key={`row-${row.row_name}-${i}`} className="flex items-center gap-1.5 justify-center">
                                        <div className="w-5 text-[9px] font-mono font-bold text-muted-foreground/40 text-right pr-1">
                                            {row.row_name}
                                        </div>
                                        
                                        <div className="flex gap-1">
                                            {row.seats.map((seat, j) => {
                                                if (seat.type === 'aisle') {
                                                    return <div key={`aisle-${i}-${j}`} className="w-3.5 h-3.5 md:w-4 md:h-4 invisible" />;
                                                }
                                                
                                                return (
                                                    <div 
                                                        key={`seat-${i}-${j}-${seat.id || 'void'}`}
                                                        className={cn(
                                                            'w-3.5 h-3.5 md:w-4 md:h-4 rounded-t-sm rounded-b-[2px] flex items-center justify-center',
                                                            'text-[7px] font-bold transition-all cursor-default select-none',
                                                            'bg-background border border-border text-muted-foreground/70 hover:border-primary/40 hover:text-primary'
                                                        )}
                                                        title={`Seat ${seat.id}`}
                                                    >
                                                        {seat.id ? seat.id.replace(/^[A-Z]+/, '') : ''}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                        
                                        <div className="w-5 text-[9px] font-mono font-bold text-muted-foreground/40 pl-1">
                                            {row.row_name}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
