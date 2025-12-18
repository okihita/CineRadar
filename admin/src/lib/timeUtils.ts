/**
 * Time utilities for displaying times in WIB (Jakarta time)
 * 
 * CONVENTION:
 * - All dates in database/backend are stored as UTC
 * - All dates displayed in UI are shown in WIB (Asia/Jakarta)
 */

const WIB_TIMEZONE = 'Asia/Jakarta';

/**
 * Format a date to WIB time string
 * e.g., "Dec 18, 2025, 2:30 PM WIB"
 */
export function formatWIB(date: Date | string | null | undefined): string {
    if (!date) return 'N/A';

    const d = typeof date === 'string' ? new Date(date) : date;
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
 * e.g., "Dec 18, 2:30 PM"
 */
export function formatWIBShort(date: Date | string | null | undefined): string {
    if (!date) return 'N/A';

    const d = typeof date === 'string' ? new Date(date) : date;
    if (isNaN(d.getTime())) return 'Invalid date';

    return d.toLocaleString('en-US', {
        timeZone: WIB_TIMEZONE,
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
    });
}

/**
 * Format a date to WIB date only
 * e.g., "Dec 18, 2025"
 */
export function formatWIBDate(date: Date | string | null | undefined): string {
    if (!date) return 'N/A';

    const d = typeof date === 'string' ? new Date(date) : date;
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

    const d = typeof date === 'string' ? new Date(date) : date;
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
 * e.g., "Just now", "5 min ago", "2 hours ago", "Dec 18"
 */
export function formatRelativeWIB(date: Date | string | null | undefined): string {
    if (!date) return 'N/A';

    const d = typeof date === 'string' ? new Date(date) : date;
    if (isNaN(d.getTime())) return 'Invalid date';

    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;

    return formatWIBDate(d);
}
