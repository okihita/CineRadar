/**
 * Time utilities for displaying times in WIB (Jakarta time)
 * 
 * CONVENTION:
 * - All dates in database/backend are stored as UTC (no timezone suffix)
 * - GitHub Actions runs in UTC, so datetime.now() produces UTC
 * - When parsing, we append Z to treat them as UTC
 * - All dates displayed in UI are shown in WIB (Asia/Jakarta)
 */

const WIB_TIMEZONE = 'Asia/Jakarta';

/**
 * Parse a date string that's stored as UTC (without timezone suffix)
 * Appends Z so JavaScript interprets it as UTC
 */
function parseAsUTC(date: Date | string): Date {
    if (date instanceof Date) return date;

    // If already has timezone info, parse directly
    if (date.includes('Z') || date.includes('+') || date.includes('-', 10)) {
        return new Date(date);
    }

    // Append Z to treat as UTC
    return new Date(date + 'Z');
}

/**
 * Format a date to WIB time string
 * e.g., "Dec 18, 2025, 2:30 PM WIB"
 */
export function formatWIB(date: Date | string | null | undefined): string {
    if (!date) return 'N/A';

    const d = parseAsUTC(date);
    if (isNaN(d.getTime())) return 'Invalid date';

    return d.toLocaleString('en-US', {
        timeZone: WIB_TIMEZONE,
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
    }) + ' WIB';
}

/**
 * Format a date to short WIB time (without year)
 * e.g., "Dec 23, 07:35 Jakarta"
 */
export function formatWIBShort(date: Date | string | null | undefined): string {
    if (!date) return 'N/A';

    const d = parseAsUTC(date);
    if (isNaN(d.getTime())) return 'Invalid date';

    return d.toLocaleString('en-US', {
        timeZone: WIB_TIMEZONE,
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
    }) + ' Jakarta';
}

/**
 * Format a date to WIB date only
 * e.g., "Dec 18, 2025"
 */
export function formatWIBDate(date: Date | string | null | undefined): string {
    if (!date) return 'N/A';

    const d = parseAsUTC(date);
    if (isNaN(d.getTime())) return 'Invalid date';

    return d.toLocaleDateString('en-US', {
        timeZone: WIB_TIMEZONE,
        month: 'short',
        day: 'numeric',
        year: 'numeric',
    });
}

/**
 * Format a date to WIB time only
 * e.g., "2:30 PM"
 */
export function formatWIBTime(date: Date | string | null | undefined): string {
    if (!date) return 'N/A';

    const d = parseAsUTC(date);
    if (isNaN(d.getTime())) return 'Invalid date';

    return d.toLocaleTimeString('en-US', {
        timeZone: WIB_TIMEZONE,
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
    });
}

/**
 * Format relative time in WIB context
 * e.g., "just now", "5 min ago", "2 hours ago", "Dec 18"
 */
export function formatRelativeWIB(date: Date | string | null | undefined): string {
    if (!date) return 'N/A';

    const d = parseAsUTC(date);
    if (isNaN(d.getTime())) return 'Invalid date';

    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'just now';
    if (diffMins === 1) return '1 min ago';
    if (diffMins < 60) return `${diffMins} min ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours === 1) return '1 hour ago';
    if (diffHours < 24) return `${diffHours} hours ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays === 1) return 'yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;

    return formatWIBDate(d);
}

/**
 * Format a date with both absolute time and relative time
 * e.g., "Dec 23, 07:35 Jakarta (5 min ago)"
 */
export function formatWIBWithRelative(date: Date | string | null | undefined): string {
    if (!date) return 'N/A';

    const d = parseAsUTC(date);
    if (isNaN(d.getTime())) return 'Invalid date';

    const absolute = formatWIBShort(d);
    const relative = formatRelativeWIB(d);

    return `${absolute} (${relative})`;
}

