export interface TrackedHashtag {
    id: string;
    tag: string;
    label: string;
    category: 'campaign' | 'competitor' | 'meme' | 'talent' | 'general';
    target_posts: number;
    cadence?: number; // Runs per day (1, 2, 3, 4) - default 1
    start_hour?: number; // Start hour in 24-hour WIB format (0-23) - default 18
    include_comments: boolean;
    active: boolean;
    created_at: string;
    updated_at: string;
}

export interface CustomHashtagsConfigDoc {
    id?: string;
    sources?: unknown[];
    overrides?: Record<string, string[]>;
    excluded_hashtags?: string[];
    tracked_hashtags?: TrackedHashtag[];
    updated_at?: string;
}

export interface HashtagPulseStats {
    total_posts: number;
    total_views: number;
    total_likes: number;
    total_comments: number;
    total_shares: number;
    sentiment?: {
        positive: number;
        mixed: number;
        negative: number;
        hype_score: number;
        praise_points?: string[];
        criticism_themes?: string[];
    };
    crawled_at?: string;
    top_video_url?: string;
}
