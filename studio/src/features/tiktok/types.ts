/**
 * Shared TikTok Intelligence Types & Interfaces
 *
 * Defines core domain models for TikTok crawling, daily social pulse,
 * exhibitor channels, and theatrical audience telemetry.
 */

export interface PostMetrics {
    views?: number;
    likes?: number;
    comments?: number;
    shares?: number;
    bookmarks?: number;
}

export interface ExplorerPost {
    id: string;
    movieTitle: string;
    hashtag: string;
    title: string;
    text: string;
    url: string;
    published_at: string;
    source_name: string;
    source_handle: string;
    source_avatar: string;
    thumbnail: string;
    metrics?: PostMetrics;
    sentiment: 'positive' | 'mixed' | 'negative';
    tiktok_sound?: string;
    platform_data?: {
        tiktok_sound?: string;
        campaign_hashtag?: string;
    };
}

export interface ExplorerComment {
    id: string;
    movieTitle: string;
    text: string;
    diggCount: number;
    authorName: string;
    sentiment: 'positive' | 'mixed' | 'negative';
    topic: string;
}

export interface SentimentData {
    positive: number;
    mixed: number;
    negative: number;
    hype_score?: number;
    praise_points?: string[];
    criticism_themes?: string[];
}

export interface ViralPost {
    id: string;
    url: string;
    author_name: string;
    author_handle: string;
    caption: string;
    hashtags: string[];
    views: number;
    likes: number;
    comments: number;
    shares: number;
    published_at: string;
}

export interface PulseLeaderboardItem {
    rank: number;
    movie_id: string;
    title: string;
    tier: string;
    total_views: number;
    total_likes: number;
    total_comments: number;
    total_shares: number;
    posts_count: number;
    sentiment?: SentimentData;
    top_viral_post?: {
        id: string;
        url: string;
        author: string;
        views: number;
        likes: number;
        snippet: string;
    };
}

export interface PulseAiInsights {
    share_of_voice_leader?: string;
    organic_wom_ratio?: string;
    virality_velocity_leader?: string;
    critical_friction_alert?: string;
    morning_briefing?: string;
    night_briefing?: string;
}

export interface DailyPulseDoc {
    date: string;
    updated_at: string;
    total_movies_tracked: number;
    leaderboard: PulseLeaderboardItem[];
    ai_insights?: PulseAiInsights;
    gemini_model?: string;
}

export interface MoviePulseResponse {
    success: boolean;
    data?: {
        movie_id: string;
        title: string;
        date: string;
        tier: string;
        total_posts: number;
        total_views: number;
        total_likes: number;
        total_comments: number;
        total_shares: number;
        campaign_hashtags: string[];
        sentiment?: SentimentData;
        posts: ViralPost[];
    };
}

export interface ActionableInsights {
    totalViews: number;
    totalShares: number;
    sovLeader: {
        title: string;
        insight: string;
        metricValue?: string;
        metricLabel?: string;
    };
    womWinner: {
        title: string;
        positivePct: number;
        insight: string;
        metricValue?: string;
        metricLabel?: string;
    };
    viralityLeader: {
        title: string;
        shares: number;
        insight: string;
        metricValue?: string;
        metricLabel?: string;
    };
    frictionTarget: {
        title: string;
        topComplaint: string;
        metricValue?: string;
        metricLabel?: string;
    };
    morningBriefing: string;
    nightBriefing: string;
}

export interface MovieSentimentItem {
    id: string;
    title: string;
    hashtag: string | null;
    discoveredTags: string[];
    showtimes_count: number;
    merchants: string[];
    genres: string[];
    age_category: string;
    views: number;
    likes: number;
    shares: number;
    hasSocialCrawl: boolean;
    postsCount: number;
    positivePct: number;
    mixedPct: number;
    negativePct: number;
    topPraise: string;
    topComplaint: string;
}

export interface TikTokSourcesResponse {
    success: boolean;
    sources: Array<{ id: string; handle: string; name: string; category: string; active: boolean }>;
    overrides: Record<string, string[]>;
    excluded_hashtags?: string[];
}

export interface TikTokDiscoveryResponse {
    success: boolean;
    data?: {
        movies: Record<string, {
            title: string;
            discovered_hashtags: string[];
        }>;
    };
}
