/**
 * Firestore types for the multi-platform social feed collections.
 * 
 * Collections:
 *   beta_social_sources/{source_id}     — monitored accounts (YouTube, Twitter, etc.)
 *   beta_social_posts/{post_id}         — individual posts (videos, tweets, reels, etc.)
 *   beta_social_analysis/{date_hour}    — per-hour AI summaries across ALL platforms
 */

// ─── Platform & Category Types ──────────────────────────

export type Platform = 'youtube' | 'twitter' | 'instagram' | 'tiktok' | 'web';

export type SourceCategory = 'critic' | 'cinema_chain' | 'distributor' | 'streaming' | 'community' | 'news';

export type ContentType = 'trailer' | 'short' | 'review' | 'promo' | 'community';

/** Source categories in display order with labels */
export const SOURCE_CATEGORIES: { value: SourceCategory; label: string }[] = [
    { value: 'distributor', label: 'Distributors & Studios' },
    { value: 'streaming', label: 'Streaming Platforms' },
    { value: 'cinema_chain', label: 'Cinema Chains' },
    { value: 'critic', label: 'Critics & Reviewers' },
    { value: 'community', label: 'Community & Fandom' },
    { value: 'news', label: 'News & Trade' },
];

export const SOURCE_CATEGORY_ORDER = Object.fromEntries(
    SOURCE_CATEGORIES.map((c, i) => [c.value, i]),
) as Record<SourceCategory, number>;

// ─── Collection names ──────────────────────────────────

export const COLLECTIONS = {
    SOURCES: 'beta_social_sources',
    POSTS: 'beta_social_posts',
    ANALYSIS: 'beta_social_analysis',
} as const;

// ─── Source Document ────────────────────────────────────

export interface FirestoreSocialSource {
    id: string;                    // Format: "{platform}_{platform_id}" e.g. "youtube_UCQExjzw5..."
    platform: Platform;
    display_name: string;
    handle: string;                // @NetflixIndonesia
    category: SourceCategory;
    verified: boolean;
    avatar_url: string;
    url: string;                   // Link to account on platform
    active: boolean;               // false = paused/removed
    notes: string;                 // admin notes
    sort_order: number;            // display order within category (0 = first)

    metadata: {
        subscriber_count?: number;
        followers_count?: number;
        posts_count?: number;
        apify_actor_id?: string;
        apify_last_run_id?: string;
    };

    fetch_config: {
        frequency: string;         // "hourly" | "daily" | "manual"
        max_items_per_fetch: number;
    };

    added_at: string;              // ISO timestamp
    last_fetched_at: string;       // ISO timestamp of last successful fetch
}

// ─── Post Media / Metrics / Platform Data ───────────────

export interface PostMedia {
    type: 'image' | 'video' | 'animated_gif';
    url: string;
    width?: number;
    height?: number;
    duration_ms?: number;
}

export interface PostMetrics {
    views?: number;
    likes?: number;
    comments?: number;
    shares?: number;
}

export interface PostPlatformData {
    // YouTube
    video_id?: string;
    duration?: string;             // PT15M30S
    tags?: string[];
    // Twitter
    tweet_id?: string;
    is_retweet?: boolean;
    hashtags?: string[];
    mentions?: string[];
    // Instagram
    ig_media_type?: string;        // "IMAGE" | "VIDEO" | "CAROUSEL" | "REEL"
    // TikTok
    tiktok_sound?: string;
    // Web scrape
    scrape_source?: string;
}

// ─── Post Document ──────────────────────────────────────

export interface FirestoreSocialPost {
    id: string;                    // Format: "{platform}_{content_id}" e.g. "youtube_dQw4w9WgXcQ"
    platform: Platform;

    // Core content (ALL platforms)
    title: string;
    text: string;                  // Full text content (description, tweet body, etc.)
    url: string;                   // Link to original post
    published_at: string;          // ISO timestamp (UTC)
    fetched_at: string;            // ISO timestamp

    // Source info (denormalized for query perf + historical integrity)
    source_id: string;             // Links to beta_social_sources/{source_id}
    source_name: string;           // Denormalized display_name
    source_handle: string;         // Denormalized @handle
    source_avatar: string;         // Denormalized avatar_url
    source_category: string;       // Denormalized category

    // Classification
    content_type: ContentType;

    // Media
    thumbnail: string;
    media: PostMedia[];
    metrics: PostMetrics;
    platform_data: PostPlatformData;
}

// ─── Hourly Analysis Document ───────────────────────────

export interface FirestoreSocialAnalysis {
    id: string;                    // "2026-05-04_11" (date + zero-padded hour)
    date: string;                  // "2026-05-04"
    hour: number;                  // 0-23

    // AI-generated summary (covers ALL platforms)
    summary: string;

    // Post counts
    total_posts: number;
    posts_by_platform: Record<string, number>;
    posts_by_content_type: Record<string, number>;

    // Source tracking
    sources_active: string[];      // Source IDs with posts this hour
    sources_fetched: string[];     // All source IDs that were fetched (even if 0 posts)

    // Extracted hashtags from post descriptions
    hashtags: string[];            // e.g. ["#Dilan1991", "#FilmIndonesia", "#PengabdiSetan"]

    // Pre-extracted signals (future: populated by Gemini)
    top_trailers: { title: string; source: string; url: string }[];
    trending_topics: string[];
    sentiment_hint: string;        // "positive" | "mixed" | "controversial" | "neutral"

    // AI metadata
    generated_at: string;          // ISO timestamp
    model: string;                 // e.g. "gemini-3.1-flash-lite-preview"
    backfill_duration_ms: number;  // how long the entire backfill took
}

// ─── Helpers ────────────────────────────────────────────

/** Generate a date_hour document ID like "2026-05-04_11" */
export function makeHourId(date: string, hour: number): string {
    return `${date}_${String(hour).padStart(2, '0')}`;
}

/** Extract date and hour from a date_hour ID */
export function parseHourId(id: string): { date: string; hour: number } {
    const [date, hourStr] = id.split('_');
    return { date, hour: parseInt(hourStr, 10) };
}

/** Format an hour for display: 0 → "00:00", 14 → "14:00" */
export function formatHour(hour: number): string {
    return `${String(hour).padStart(2, '0')}:00`;
}

/** Group posts by hour of day (0-23) in Jakarta timezone */
export function groupPostsByHour(posts: FirestoreSocialPost[]): Map<number, FirestoreSocialPost[]> {
    const groups = new Map<number, FirestoreSocialPost[]>();
    for (const post of posts) {
        const hour = parseInt(
            new Date(post.published_at).toLocaleString('en-US', { timeZone: 'Asia/Jakarta', hour: 'numeric', hour12: false }),
            10,
        ) % 24;
        if (!groups.has(hour)) groups.set(hour, []);
        groups.get(hour)!.push(post);
    }
    // Sort each group by published_at descending
    for (const [, p] of groups) {
        p.sort((a, b) => new Date(b.published_at).getTime() - new Date(a.published_at).getTime());
    }
    return groups;
}
