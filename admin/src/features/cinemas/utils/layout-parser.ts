import type { LayoutRow, Seat } from '../hooks/useTheatreStudios';

export interface TixRawSeat {
    seat_row?: string;
    seat_code?: string;
    seat_no?: string;
    seat_yn?: string;
    seat_rows?: TixRawSeat[];
    row_name?: string;
    seat_grd_cd?: string;
    status?: number;
    seat_status?: number;
}

export interface TixVerticalLane {
    before_seat_column: number;
}

export interface TixRawData {
    seat_map?: TixRawSeat[];
    max_horizontal_seat?: number;
    seat_rules?: {
        vertical_lane?: TixVerticalLane[];
    };
    price?: number;
}

export interface TixRawPayload {
    data?: TixRawData | TixRawSeat[];
    initial_raw_layout?: TixRawPayload;
    raw_api_response?: TixRawPayload;
}

export interface AuditSeat extends Seat {
    rawStatus?: number;
    visualColor?: string;
    statusLabel?: string;
}

/**
 * Normalizes different TIX ID raw response patterns into a unified LayoutRow array.
 * Upgraded to be "Status-Aware" for forensic auditing.
 */
export function parseAnyToLayout(raw: TixRawPayload | null | undefined, fallback: LayoutRow[]): LayoutRow[] {
    if (!raw) return fallback;
    
    // --- Step 1: Automatic Wrapper Detection ---
    // Dig through Firestore performance document wrappers if they exist
    let core: TixRawPayload = raw;
    if (raw.initial_raw_layout) core = raw.initial_raw_layout;
    else if (raw.raw_api_response) core = raw.raw_api_response;
    
    // Standard TIX .data wrapper
    const rawDataOrList = (core.data || core) as TixRawData | TixRawSeat[];
    const isArray = Array.isArray(rawDataOrList);
    
    let seatMap: TixRawSeat[] = [];
    if (isArray) {
        seatMap = rawDataOrList as TixRawSeat[];
    } else {
        const rawData = rawDataOrList as TixRawData;
        seatMap = rawData.seat_map || (Array.isArray(rawData) ? (rawData as TixRawSeat[]) : []);
    }
    
    if (!Array.isArray(seatMap) || seatMap.length === 0) return fallback;

    // --- Helper: Resolve Seat Status & Color ---
    const resolveSeatProps = (s: TixRawSeat) => {
        const status = s.status ?? s.seat_status;
        let visualColor = '';
        let statusLabel = '';

        if (status === 1) {
            visualColor = '#22c55e'; // Available
            statusLabel = 'Available';
        } else if (status === 5) {
            visualColor = '#f59e0b'; // Booked
            statusLabel = 'Booked (Status Code 5)';
        } else if (status === 6 || status === 0) {
            visualColor = '#ef4444'; // Sold/Dead
            statusLabel = 'Sold/Dead (Status Code 6)';
        }
        return { status, visualColor, statusLabel };
    };

    // --- Pattern A: Nested (XXI) ---
    if (seatMap[0] && seatMap[0].seat_rows) {
        const rawData = rawDataOrList as TixRawData;
        const verticalLanes = rawData.seat_rules?.vertical_lane || [];
        const laneIndices = new Set(verticalLanes.map((l: TixVerticalLane) => l.before_seat_column - 1));
        
        return seatMap.map((row: TixRawSeat) => {
            const seats: AuditSeat[] = [];
            (row.seat_rows || []).forEach((s: TixRawSeat, j: number) => {
                if (laneIndices.has(j)) seats.push({ id: '', type: 'aisle' });
                const { status, visualColor, statusLabel } = resolveSeatProps(s);
                const isAisle = !s.seat_row && status === undefined;
                
                seats.push({ 
                    id: s.seat_row || '', 
                    type: isAisle ? 'aisle' : 'seat',
                    rawStatus: status,
                    visualColor,
                    statusLabel
                });
            });
            return { row_name: row.seat_code || row.row_name || '', seats };
        });
    }
    
    // --- Pattern B: Flat (Cinépolis/CGV) ---
    const rawData = rawDataOrList as TixRawData;
    const maxCols = rawData.max_horizontal_seat || 10;
    const layout: LayoutRow[] = [];
    
    for (let i = 0; i < seatMap.length; i += maxCols) {
        const chunk = seatMap.slice(i, i + maxCols);
        const rowLabel = chunk.find((x: TixRawSeat) => x.row_name)?.row_name || '';
        layout.push({
            row_name: rowLabel,
            seats: chunk.map((item: TixRawSeat) => {
                const { status, visualColor, statusLabel } = resolveSeatProps(item);
                const isPhysical = item.seat_yn === '1' || status !== undefined;
                return {
                    id: isPhysical ? `${item.row_name || rowLabel}${item.seat_no || ''}` : '',
                    type: isPhysical ? 'seat' : 'aisle',
                    rawStatus: status,
                    visualColor,
                    statusLabel
                } as AuditSeat;
            })
        });
    }
    return layout;
}
