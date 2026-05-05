/**
 * Content type detection for social posts.
 * Used by backfill pipeline to classify posts by title keywords + source category.
 */

export type ContentType = 'trailer' | 'short' | 'review' | 'promo' | 'community';

// Re-export SourceCategory for convenience
export type { SourceCategory } from '@/lib/firestore-social';

const TRAILER_KEYWORDS = ['trailer', 'official trailer', 'teaser', 'official teaser', 'preview'];
const SHORT_KEYWORDS = ['shorts', '#short', 'short'];
const REVIEW_KEYWORDS = ['review', 'review(', 'ulasan', 'resensi', 'rekomen', 'worth it'];

export function detectContentType(title: string, category: string): ContentType {
    const lower = title.toLowerCase();

    // Shorts detection (highest priority)
    if (SHORT_KEYWORDS.some(kw => lower.includes(kw))) return 'short';

    // Trailer detection
    if (TRAILER_KEYWORDS.some(kw => lower.includes(kw))) return 'trailer';

    // Review detection (typically from critics)
    if (category === 'critic' && REVIEW_KEYWORDS.some(kw => lower.includes(kw))) return 'review';

    // Category-based fallback
    if (category === 'critic') return 'review';
    if (category === 'community') return 'community';
    if (category === 'news') return 'community'; // news posts treated as community content
    return 'promo'; // distributor, streaming, cinema_chain all default to promo
}

export const CONTENT_TYPE_LABELS: Record<ContentType, { label: string; color: string; desc: string }> = {
    trailer: { label: 'Trailers', color: 'text-rose-500', desc: 'Official trailers & teasers' },
    review: { label: 'Reviews', color: 'text-amber-500', desc: 'Critics & audience reviews' },
    short: { label: 'Shorts', color: 'text-cyan-500', desc: 'Short-form content' },
    promo: { label: 'Promos', color: 'text-green-500', desc: 'Promotional & marketing content' },
    community: { label: 'Community', color: 'text-purple-500', desc: 'Fan discussions & reactions' },
};
