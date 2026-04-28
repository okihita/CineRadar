/**
 * Shared seat layout types used across the seat map visualization system.
 *
 * Canonical definitions — import from here instead of declaring inline.
 */

/** A single seat in an object-based layout */
export interface Seat {
    id: string;
    status: number;
}

/**
 * A flexible row object that may come from multiple data sources.
 * Normalization code should handle all alias variants.
 */
export interface SeatRow {
    row_name?: string;
    rowName?: string;
    row?: string;
    seats?: (Seat | null)[];
    seat?: (Seat | null)[];
}

/** Object-based layout grid (array of row objects) */
export type ObjectLayoutGrid = SeatRow[];

/** Simple (tuple-based) layout grid — used by compressed layouts and master layout */
export type SimpleLayoutGrid = [string, number[]][];

/** Union type accepting either layout format */
export type LayoutGrid = ObjectLayoutGrid | SimpleLayoutGrid;

/** Visual seat status for rendering */
export type VisSeatStatus = 'available' | 'blocked' | 'sold' | 'gap' | 'master';

/** Raw showtime forensic data returned by /api/showtimes/[showtimeId]/raw */
export interface RawShowtimeData {
    initialLayout: unknown;
    finalLayout: unknown;
    masterLayout: unknown;
    isInferred?: boolean;
    inferredStudioId?: string;
}
