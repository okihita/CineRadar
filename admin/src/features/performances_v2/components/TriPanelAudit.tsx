'use client';

import { useMemo } from 'react';
import { BaseSeatMap } from './BaseSeatMap';
import type { MasterLayout } from './SeatMapVisualizer';

// Unified Layout Types
type SimpleLayoutGrid = [string, number[]][];

interface SeatObject {
    id: string;
    status: number;
}

interface RowObject {
    row_name?: string;
    rowName?: string;
    row?: string;
    seats?: (SeatObject | null)[];
    seat?: (SeatObject | null)[];
}

type ObjectLayoutGrid = RowObject[];
type LayoutGrid = SimpleLayoutGrid | ObjectLayoutGrid;

interface TriPanelAuditProps {
    initialLayout: unknown;
    finalLayout: unknown;
    masterLayout?: MasterLayout | null;
}

type VisSeatStatus = 'available' | 'blocked' | 'sold' | 'gap' | 'master';

/**
 * Forensic Seating Auditor
 * Renders 3 side-by-side maps to debug delta calculation.
 */
export function TriPanelAudit({ initialLayout, finalLayout, masterLayout }: TriPanelAuditProps) {
    
    // 1. Data Lookups
    const initialMap = useMemo(() => buildStatusMap(initialLayout as LayoutGrid), [initialLayout]);
    const finalMap = useMemo(() => buildStatusMap(finalLayout as LayoutGrid), [finalLayout]);

    // 2. Transform into renderable rows for each panel
    
    // Panel A: Baseline (2 AM)
    const baselineRows = useMemo(() => {
        return normalizeToAuditRows((initialLayout || finalLayout) as LayoutGrid, (id, coord) => {
            const status = initialMap.get(id) ?? initialMap.get(coord);
            if (status === -1) return 'gap';
            return (status === 5 || status === 6 || status === 0) ? 'blocked' : 'available';
        });
    }, [initialLayout, finalLayout, initialMap]);

    // Panel B: Showtime (JIT)
    const showtimeRows = useMemo(() => {
        return normalizeToAuditRows((finalLayout || initialLayout) as LayoutGrid, (id, coord) => {
            const fStatus = finalMap.get(id) ?? finalMap.get(coord);
            const iStatus = initialMap.get(id) ?? initialMap.get(coord);
            
            if (fStatus === -1) return 'gap';
            if (fStatus === 1) return 'available';
            
            // The Delta Logic: If it was available at 2AM but blocked now -> Sold
            if ((fStatus === 5 || fStatus === 6 || fStatus === 0) && (iStatus === 1)) return 'sold';
            
            // If it was already blocked at 2AM
            if (iStatus === 5 || iStatus === 6 || iStatus === 0) return 'blocked';
            
            // Fallback for missing baseline
            if (fStatus === 5 || fStatus === 6) return 'sold';
            
            return 'available';
        });
    }, [initialLayout, finalLayout, initialMap, finalMap]);

    // Panel C: Master (Registry)
    const masterRows = useMemo(() => {
        if (!masterLayout) return [];
        return masterLayout.map(row => ({
            rowName: row.row_name,
            seats: row.seats.map(s => ({
                id: s.id,
                status: (s.type === 'aisle' ? 'gap' : 'master') as VisSeatStatus,
                label: s.type === 'aisle' ? '' : s.id.replace(row.row_name, '')
            }))
        }));
    }, [masterLayout]);

    return (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 w-full min-h-[500px]">
            <BaseSeatMap 
                type="baseline"
                title="2 AM Baseline"
                subtitle="Presale state before mall opens"
                rows={baselineRows}
            />
            <BaseSeatMap 
                type="showtime"
                title="Final Showtime"
                subtitle="JIT Snapshot (T-30 mins)"
                rows={showtimeRows}
            />
            <BaseSeatMap 
                type="master"
                title="Digital Twin"
                subtitle="Physical Registry Template"
                rows={masterRows || []}
            />
        </div>
    );
}

// Helper: Build coordinate/ID map
function buildStatusMap(layout: LayoutGrid | null) {
    const map = new Map<string, number>();
    if (!layout) return map;

    layout.forEach((row, i) => {
        const rowName = Array.isArray(row) ? row[0] : (row.row_name || row.rowName || String.fromCharCode(65+i));
        const seats = Array.isArray(row) ? row[1] : (row.seats || row.seat || []);
        
        if (Array.isArray(seats)) {
            seats.forEach((s, j) => {
                if (s === null) return;
                const status = typeof s === 'number' ? s : s.status;
                const id = (typeof s === 'object' && 'id' in s) ? s.id : `${rowName}${j+1}`;
                map.set(id, status);
                map.set(`${rowName}_${j}`, status);
            });
        }
    });
    return map;
}

// Helper: Normalize any layout format into Audit rows
function normalizeToAuditRows(layout: LayoutGrid | null, statusResolver: (id: string, coord: string) => VisSeatStatus) {
    if (!layout) return [];
    
    return layout.map((row, i) => {
        const rowName = Array.isArray(row) ? row[0] : (row.row_name || row.rowName || String.fromCharCode(65+i));
        const seats = (Array.isArray(row) ? row[1] : (row.seats || row.seat || [])) as unknown[];
        
        return {
            rowName,
            seats: seats.map((s, j) => {
                const id = (s && typeof s === 'object' && 'id' in s) ? (s as { id: string }).id : `${rowName}${j+1}`;
                const coord = `${rowName}_${j}`;
                return {
                    id,
                    status: statusResolver(id, coord),
                    label: String(j + 1)
                };
            })
        };
    });
}
