'use client';

import { useMemo } from 'react';
import { BaseSeatMap } from './BaseSeatMap';

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

type LayoutGrid = SimpleLayoutGrid | ObjectLayoutGrid;
type ObjectLayoutGrid = RowObject[];

interface TriPanelAuditProps {
    initialLayout: unknown;
    finalLayout: unknown;
    masterLayout?: unknown; 
    theatreId?: string;
}

type VisSeatStatus = 'available' | 'blocked' | 'sold' | 'gap' | 'master';

interface SkeletonSeat {
    id: string;
    coord: string;
    isAisle: boolean;
    label: string;
}

interface SkeletonRow {
    rowName: string;
    seats: SkeletonSeat[];
}

/**
 * Forensic Seating Auditor (Master-Driven Projection)
 * Uses the Digital Twin as the definitive skeleton for all 3 panels.
 */
export function TriPanelAudit({ initialLayout, finalLayout, masterLayout, theatreId }: TriPanelAuditProps) {
    
    // 1. Build high-speed lookup maps for the snapshots
    const initialMap = useMemo(() => buildStatusMap(initialLayout as LayoutGrid), [initialLayout]);
    const finalMap = useMemo(() => buildStatusMap(finalLayout as LayoutGrid), [finalLayout]);

    // 2. Define the definitive "Physical Skeleton" (from Master or fallback to Final)
    const skeleton = useMemo(() => {
        if (!masterLayout) {
            return normalizeToSkeleton(finalLayout as LayoutGrid);
        }
        return normalizeMasterToSkeleton(masterLayout);
    }, [masterLayout, finalLayout]);

    // 3. PROJECT Snapshot data onto the Physical Skeleton
    
    // Panel A: Baseline (Projected)
    const baselineRows = useMemo(() => {
        return skeleton.map(row => ({
            rowName: row.rowName,
            seats: row.seats.map(s => {
                if (s.isAisle) return { id: s.id, status: 'gap' as const, label: '' };
                const status = initialMap.get(s.id) ?? initialMap.get(s.coord);
                return {
                    id: s.id,
                    status: (status === 5 || status === 6 || status === 0) ? 'blocked' as const : 'available' as const,
                    label: s.label
                };
            })
        }));
    }, [skeleton, initialMap]);

    // Panel B: Showtime (Projected)
    const showtimeRows = useMemo(() => {
        return skeleton.map(row => ({
            rowName: row.rowName,
            seats: row.seats.map(s => {
                if (s.isAisle) return { id: s.id, status: 'gap' as const, label: '' };
                const fStatus = finalMap.get(s.id) ?? finalMap.get(s.coord);
                const iStatus = initialMap.get(s.id) ?? initialMap.get(s.coord);
                
                let status: VisSeatStatus = 'available';
                if (fStatus === 1) status = 'available';
                else if ((fStatus === 5 || fStatus === 6 || fStatus === 0) && (iStatus === 1)) status = 'sold';
                else if (iStatus === 5 || iStatus === 6 || iStatus === 0) status = 'blocked';
                else if (fStatus === 5 || fStatus === 6) status = 'sold';

                return { id: s.id, status, label: s.label };
            })
        }));
    }, [skeleton, initialMap, finalMap]);

    // Panel C: Master (Registry Reality)
    const masterRows = useMemo(() => {
        return skeleton.map(row => ({
            rowName: row.rowName,
            seats: row.seats.map(s => ({
                id: s.id,
                status: s.isAisle ? 'gap' as const : 'master' as const,
                label: s.label
            }))
        }));
    }, [skeleton]);

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
                subtitle={masterLayout ? "Physical Registry Template" : "No Physical Template (Fallback)"}
                rows={masterRows}
                href={theatreId ? `/cinemas/${theatreId}` : undefined}
            />
        </div>
    );
}

/** 
 * HELPER: Normalizes the V3.3 Master Layout into a definitive projection skeleton.
 */
function normalizeMasterToSkeleton(masterLayout: unknown): SkeletonRow[] {
    let rows: Array<{ row_name?: string; rowName?: string; seats?: unknown[] }> = [];
    if (Array.isArray(masterLayout)) {
        rows = masterLayout;
    } else if (typeof masterLayout === 'object' && masterLayout !== null) {
        rows = Object.entries(masterLayout as Record<string, unknown[]>).map(([name, seats]) => ({ row_name: name, seats }));
    }

    return rows.map((row, i) => {
        const rowName = row.row_name || row.rowName || String.fromCharCode(65 + i);
        const seats = Array.isArray(row.seats) ? row.seats : [];
        let seatCounter = 0;

        return {
            rowName,
            seats: seats.map((s) => {
                const isAisle = !!((s && typeof s === 'object' && 'type' in s && s.type === 'aisle') || s === -1);
                const seatId = (s && typeof s === 'object' && 'id' in s) ? (s as { id: string }).id : (typeof s === 'string' ? s : `${rowName}${seatCounter + 1}`);
                const coord = `${rowName}_${seatCounter}`;
                
                if (!isAisle) seatCounter++;

                return {
                    id: seatId,
                    coord,
                    isAisle,
                    label: isAisle ? '' : seatId.replace(rowName, '')
                };
            })
        };
    });
}

/**
 * HELPER: Fallback skeleton from snapshot data (if master is missing)
 */
function normalizeToSkeleton(layout: LayoutGrid | null): SkeletonRow[] {
    if (!layout) return [];
    return layout.map((row, i) => {
        const rowName = Array.isArray(row) ? row[0] : (row.row_name || row.rowName || String.fromCharCode(65 + i));
        const seats = Array.isArray(row) ? row[1] : (row.seats || row.seat || []);
        return {
            rowName,
            seats: (seats as unknown[]).map((_, j) => ({
                id: `${rowName}${j + 1}`,
                coord: `${rowName}_${j}`,
                isAisle: false,
                label: String(j + 1)
            }))
        };
    });
}

/**
 * HELPER: Build coordinate/ID map for projection lookups
 */
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
                const id = (typeof s === 'object' && s !== null && 'id' in s) ? (s as {id: string}).id : `${rowName}${j+1}`;
                map.set(id, status);
                map.set(`${rowName}_${j}`, status);
            });
        }
    });
    return map;
}
