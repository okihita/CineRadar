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

export const CHART_COLORS = [
    '#2563eb', // Indigo 600
    '#059669', // Emerald 600
    '#d97706', // Amber 600
    '#db2777', // Pink 600
    '#7c3aed', // Violet 600
    '#dc2626', // Red 600
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
