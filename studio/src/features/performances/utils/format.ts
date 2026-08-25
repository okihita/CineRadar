/**
 * Performance Stat Formatting Utilities
 */

/**
 * Formats a number to a human-readable "k" or "M" format.
 * Examples: 1200 -> 1.2k, 1200000 -> 1.2M
 */
export function formatCompactNumber(value: number | undefined | null): string {
    if (value === undefined || value === null) return '0';
    
    if (value >= 1000000) {
        return (value / 1000000).toFixed(1) + 'M';
    }
    if (value >= 1000) {
        return (value / 1000).toFixed(1) + 'k';
    }
    return value.toLocaleString();
}

/**
 * Formats occupancy percentage with fixed precision.
 */
export function formatOccupancy(value: number | undefined | null): string {
    if (value === undefined || value === null) return '0.0';
    return value.toFixed(1);
}
