/**
 * Shared TikTok Utility Functions
 *
 * Text normalization and numerical presentation helpers for TikTok social intelligence.
 */

/**
 * Normalizes movie titles for reliable fuzzy/hashtag matching.
 * Converts to lowercase and removes all non-alphanumeric characters.
 */
export function normalizeTitleForMatching(title?: string | null): string {
    if (!title) return '';
    return title.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Formats large view or engagement counts into compact human-readable strings.
 * e.g., 1000000 -> "1.0M", 25000 -> "25.0K", 500 -> "500"
 */
export function formatCompactNumber(value: number): string {
    if (value >= 1_000_000) {
        return `${(value / 1_000_000).toFixed(1)}M`;
    }
    if (value >= 1_000) {
        return `${(value / 1_000).toFixed(1)}K`;
    }
    return value.toLocaleString();
}
