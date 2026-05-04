/**
 * Mock social feed data — YouTube-only for MVP.
 * 
 * Account data for the sidebar. Real post data comes from the YouTube API.
 */

export type AccountCategory = 'critic' | 'cinema_chain' | 'distributor' | 'streaming' | 'community' | 'news';

export interface SocialAccount {
    id: string;
    handle: string;
    display_name: string;
    category: AccountCategory;
    follower_count: string;
    verified: boolean;
    avatar_url?: string; // Populated from YouTube API
}

// ─── Accounts (matched to youtubeChannels.ts) ──────────

export const ACCOUNTS: SocialAccount[] = [
    // Critics / Reviewers
    {
        id: 'cine-crib',
        handle: '@CineCrib',
        display_name: 'Cine Crib',
        category: 'critic',
        follower_count: '—',
        verified: true,
    },
    {
        id: 'joker-review',
        handle: '@NgelanturIndonesia',
        display_name: 'Ngelantur Indonesia',
        category: 'critic',
        follower_count: '—',
        verified: false,
    },
    // Cinema Chains
    {
        id: 'cgv-id',
        handle: '@CGVKreasi',
        display_name: 'CGV Kreasi',
        category: 'cinema_chain',
        follower_count: '—',
        verified: true,
    },
    {
        id: 'xxi-official',
        handle: '@CINEMA21',
        display_name: 'CINEMA 21',
        category: 'cinema_chain',
        follower_count: '—',
        verified: true,
    },
    // Distributors
    {
        id: 'md-pictures',
        handle: '@MDPictures',
        display_name: 'MD Pictures',
        category: 'distributor',
        follower_count: '—',
        verified: true,
    },
    {
        id: 'riva-pictures',
        handle: '@RapiFilms',
        display_name: 'Rapi Films',
        category: 'distributor',
        follower_count: '—',
        verified: true,
    },
    {
        id: 'star-movies',
        handle: '@DisneyPlusID',
        display_name: 'Disney+ Indonesia',
        category: 'distributor',
        follower_count: '—',
        verified: true,
    },
    // Community
    {
        id: 'bioskopmania',
        handle: '@BioskopMania',
        display_name: 'Bioskop Mania',
        category: 'community',
        follower_count: '—',
        verified: false,
    },
];

// ─── Content type detection ───────────────────────────

export type ContentType = 'trailer' | 'short' | 'review' | 'promo' | 'community';

const TRAILER_KEYWORDS = ['trailer', 'official trailer', 'teaser', 'official teaser', 'preview'];
const SHORT_KEYWORDS = ['shorts', '#short', 'short'];
const REVIEW_KEYWORDS = ['review', 'review(', 'ulasan', 'resensi', 'rekomen', 'worth it'];

export function detectContentType(title: string, category: AccountCategory): ContentType {
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
