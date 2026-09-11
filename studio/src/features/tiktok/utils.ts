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

/**
 * Extracts a movie title from intelligence briefing text by checking against
 * known movie titles or parsing the subject clause.
 */
export function extractMovieTitleFromText(
    text?: string | null,
    knownMovies: Array<{ title?: string }> = []
): string | null {
    if (!text) return null;

    // 1. Check known titles in order of length descending (to match longer titles first)
    const sortedCandidates = [...knownMovies]
        .map((m) => m.title?.trim())
        .filter((t): t is string => Boolean(t && t.length > 2))
        .sort((a, b) => b.length - a.length);

    for (const candidate of sortedCandidates) {
        if (text.toLowerCase().includes(candidate.toLowerCase())) {
            return candidate;
        }
    }

    // 2. Fallback regex to match leading title prefix before action verb
    const match = text.match(/^([A-Za-z0-9\s:&\'-]{3,70}?)(?:\s+(?:with|commanding|dominates|leads|has|registers|exhibits|is\s+suffering)\b)/i);
    if (match && match[1]) {
        return match[1].trim();
    }

    return null;
}
