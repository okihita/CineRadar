export interface ScrapeExecutionLog {
    timestamp: string;
    source: 'live_manual' | 'scheduled_pulse' | 'simulated';
    depth: number;
    posts_scraped: number;
    cost_usd: number;
    cost_idr: number;
    status: 'success' | 'failed';
}

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
    last_scraped_at?: string;
    scrape_count?: number; // Total number of times scraping has been triggered
    total_cost_usd?: number; // Cumulative scraping cost in USD
    scrape_history?: ScrapeExecutionLog[]; // Recent execution audit trail
    latest_stats?: HashtagPulseStats | null;
}

export interface HashtagCostTelemetry {
    unitCost: {
        apifyPostsUsd: number;
        apifyCommentsUsd: number;
        apifyTotalUsd: number;
        geminiSentimentUsd: number;
        totalPerCrawlUsd: number;
        dailyCostUsd: number;
        monthlyCostUsd: number;
        dailyCostIdr: number;
        monthlyCostIdr: number;
        estimatedItemsPerCrawl: number;
    };
    deepCost: {
        apifyPostsUsd: number;
        apifyCommentsUsd: number;
        apifyTotalUsd: number;
        geminiSentimentUsd: number;
        totalPerCrawlUsd: number;
        dailyCostUsd: number;
        monthlyCostUsd: number;
        dailyCostIdr: number;
        monthlyCostIdr: number;
        estimatedItemsPerCrawl: number;
    };
    scrape_count: number;
    total_cost_usd: number;
    total_cost_idr: number;
    scrape_history: ScrapeExecutionLog[];
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
    cadence?: number;
    start_hour?: number;
    crawled_at?: string;
    top_video_url?: string;
}

export interface TikTokPostItem {
    id: string;
    url: string;
    author_handle: string;
    author_name?: string;
    caption: string;
    hashtags?: string[];
    views: number;
    likes: number;
    comments: number;
    shares: number;
    published_at: string;
}

export interface TikTokHashtagDetailSnapshot {
    tag: string;
    label: string;
    category: string;
    date: string;
    crawled_at: string;
    source: 'live_manual' | 'scheduled_pulse' | 'simulated';
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
    posts: TikTokPostItem[];
}
