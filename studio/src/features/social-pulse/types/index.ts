export interface SocialSignal {
    source: 'YouTube' | 'GoogleTrends' | 'TMDB' | 'Instagram' | 'TikTok';
    author: string;
    title: string;
    url: string;
    engagement_score: number; // 0-100
    sentiment: 'positive' | 'neutral' | 'negative';
    views?: string;
    timestamp: string;
}

export interface MovieBuzz {
    metadata_id: string;
    title: string;
    poster?: string;
    buzz_score: number; // 0-100 social gravity
    sales_score: number; // 0-100 performance gravity (normalized)
    momentum: 'rising' | 'stable' | 'falling';
    insight: 'synced' | 'pent-up' | 'fading' | 'over-hyped';
    top_keywords: string[];
    trends_7d: number[];
    ai_analysis: string; // One paragraph forensic summary
    history_14d: {
        date: string;
        buzz: number;
        sales: number;
    }[];
    telemetry: {
        google: {
            top_provinces: { name: string; pct: number }[];
            related_queries: string[];
        };
        youtube: {
            view_velocity: string; // e.g. "+12%"
            like_ratio: number;
            top_comment_sentiment: string;
        };
        tmdb: {
            global_rank: number;
            local_popularity_delta: string;
        };
    };
    metrics: {
        google_trends: number;
        youtube_velocity: number;
        ocr_pct: number;
        raw_sold: number;
        raw_seats: number;
        raw_shows: number;
    };
}

export interface IndustryPulse {
    date: string;
    narrative: string;
    top_signals: SocialSignal[];
    trending_topics: string[];
}
