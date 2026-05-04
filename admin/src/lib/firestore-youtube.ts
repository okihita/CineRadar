/**
 * Firestore types for the beta YouTube feed collections.
 * 
 * Collections:
 *   beta_youtube_videos/{video_id}         — individual video documents
 *   beta_youtube_hourly_analysis/{date_hour} — per-hour AI summaries
 */

// ─── YouTube Video Document ────────────────────────────

export interface FirestoreYouTubeVideo {
    id: string;                    // YouTube video ID (document ID)
    title: string;
    description: string;
    thumbnail: string;
    video_url: string;
    channel_id: string;
    channel_title: string;
    channel_avatar: string;
    content_type: ContentType;
    published_at: string;          // ISO timestamp
    fetched_at: string;            // ISO timestamp
}

// ─── Hourly Analysis Document ──────────────────────────

export interface FirestoreHourlyAnalysis {
    id: string;                    // "2026-05-04_11" (date + zero-padded hour)
    date: string;                  // "2026-05-04"
    hour: number;                  // 0-23
    summary: string;               // Gemini-generated paragraph
    video_count: number;
    content_type_breakdown: Record<string, number>;
    channels_active: string[];     // channel titles
    generated_at: string;          // ISO timestamp
    model: string;                 // e.g. "gemini-2.0-flash"
}

// ─── Content types (synced with mockSocialFeed.ts) ─────

export type ContentType = 'trailer' | 'short' | 'review' | 'promo' | 'community';

// ─── Collection names ──────────────────────────────────

export const COLLECTIONS = {
    VIDEOS: 'beta_youtube_videos',
    HOURLY_ANALYSIS: 'beta_youtube_hourly_analysis',
} as const;

// ─── Helpers ───────────────────────────────────────────

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

/** Group videos by hour of day (0-23) based on published_at */
export function groupVideosByHour(videos: FirestoreYouTubeVideo[]): Map<number, FirestoreYouTubeVideo[]> {
    const groups = new Map<number, FirestoreYouTubeVideo[]>();
    for (const video of videos) {
        const hour = new Date(video.published_at).getHours();
        if (!groups.has(hour)) groups.set(hour, []);
        groups.get(hour)!.push(video);
    }
    // Sort each group by published_at descending
    for (const [, vids] of groups) {
        vids.sort((a, b) => new Date(b.published_at).getTime() - new Date(a.published_at).getTime());
    }
    return groups;
}
