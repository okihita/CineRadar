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

/**
 * Standard baseline Average Ticket Price (ATP) across Indonesian cinemas in IDR.
 */
export const DEFAULT_TICKET_PRICE = 45000;

/**
 * Formats full currency amount in Indonesian Rupiah.
 * Example: 45000 -> "Rp 45.000"
 */
export function formatRupiah(value: number | undefined | null): string {
    if (value === undefined || value === null || isNaN(value)) return 'Rp 0';
    return 'Rp ' + Math.round(value).toLocaleString('id-ID');
}

/**
 * Formats currency in compact notation for high-density financial metrics.
 * Examples:
 * 12500000000 -> "Rp 12.50B"
 * 450000000 -> "Rp 450.0M"
 * 3500000 -> "Rp 3.5M"
 * 45000 -> "Rp 45k"
 */
export function formatRupiahCompact(value: number | undefined | null): string {
    if (value === undefined || value === null || isNaN(value)) return 'Rp 0';
    if (value >= 1_000_000_000) {
        return 'Rp ' + (value / 1_000_000_000).toFixed(2) + 'B';
    }
    if (value >= 1_000_000) {
        return 'Rp ' + (value / 1_000_000).toFixed(1) + 'M';
    }
    if (value >= 1_000) {
        return 'Rp ' + (value / 1_000).toFixed(0) + 'k';
    }
    return 'Rp ' + Math.round(value).toLocaleString('id-ID');
}
