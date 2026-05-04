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
    metrics: {
        google_trends: number;
        youtube_velocity: number;
        ocr_pct: number; // Actual occupancy from performance data
    };
}

export interface IndustryPulse {
    date: string;
    narrative: string;
    top_signals: SocialSignal[];
    trending_topics: string[];
}
