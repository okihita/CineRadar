export interface Movie {
    id: string;
    title: string;
    poster: string;
    is_showing_today?: boolean;
    last_updated?: string;
}

export interface TrendingMovie {
    id: string;
    title: string;
    poster: string;
    today?: {
        total_sold: number;
        total_showtimes: number;
    };
}

/** A single day's worth of compare data for one movie */
export interface CompareMovieDayData {
    admissions: number;
    showtimes: number;
    occupancy: number;
    total_seats: number;
}

/** A single row in the day-by-day chart data */
export interface CompareChartDataItem {
    date: string;
    [key: string]: string | number;
}

/** Compare API movies map entry */
export interface CompareMovieMeta {
    title: string;
    poster?: string;
}

/** Summary metrics for one movie in compare view */
export interface CompareSummaryMetrics {
    totalAdmissions: number;
    totalShowtimes: number;
    avgOccupancy: number;
    admissionsPerShowtime: number;
}

/** Recharts tooltip entry */
export interface RechartsTooltipEntry {
    stroke?: string;
    color?: string;
    name: string;
    value: number;
    dataKey: string;
}

export const CHART_COLORS = [
    '#2563eb', // Indigo 600
    '#059669', // Emerald 600
    '#d97706', // Amber 600
    '#db2777', // Pink 600
    '#7c3aed', // Violet 600
    '#dc2626', // Red 600
    '#0891b2', // Cyan 600
    '#ea580c', // Orange 600
];

/**
 * Abbreviate a movie title for chart legends and narrow displays.
 * - If it has a colon, use the part before it
 * - If no colon and > 20 chars, use initials
 * - Otherwise return as is
 */
export const abbreviateTitle = (title: string) => {
    if (title.includes(':')) {
        return title.split(':')[0].trim();
    }
    if (title.length > 20) {
        return title
            .split(/\s+/)
            .map(word => word.charAt(0))
            .join('')
            .toUpperCase();
    }
    return title;
};
