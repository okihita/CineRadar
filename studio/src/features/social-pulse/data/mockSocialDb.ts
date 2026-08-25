import { MovieBuzz } from '../types';

export interface MockSocialEntry {
    google_trends_7d: number[];
    youtube_daily_views: string;
    youtube_velocity_score: number;
    top_keywords: string[];
    narrative_snippet: string;
    ai_template: Record<MovieBuzz['insight'], string>;
    telemetry: MovieBuzz['telemetry'];
}

export const MOCK_SOCIAL_DB: Record<string, MockSocialEntry> = {
    "DILAN 1997": {
        google_trends_7d: [20, 35, 45, 60, 85, 100, 95],
        youtube_daily_views: "120K",
        youtube_velocity_score: 95,
        top_keywords: ["nostalgia", "milea", "90an"],
        narrative_snippet: "Massive nostalgia-driven search intent. Dominating Gen Z TikTok trends.",
        ai_template: {
            synced: "The market leader is demonstrating textbook synchronization between social gravity and box office conversion. High organic search volume is translating directly into seat occupancy, suggesting that the nostalgia-based marketing campaign has reached its peak efficiency with minimal demographic leakage.",
            'pent-up': "Search velocity is currently outpacing ticket supply in Tier 2 cities. Social sentiment remains overwhelmingly positive, indicating a significant volume of untapped demand that is likely to manifest as a weekend spike if additional showtimes are allocated.",
            'over-hyped': "While search volume remains high, we are observing a significant drop-off in actual ticket conversion. This suggests that the initial buzz was driven by curiosity rather than intent to purchase, or that negative word-of-mouth is beginning to outpace the marketing momentum.",
            fading: "Both social signals and sales velocity are entering a terminal decline phase. Post-peak fatigue is evident as discussion shifts from plot points to digital availability."
        },
        telemetry: {
            google: {
                top_provinces: [{ name: 'Jawa Barat', pct: 45 }, { name: 'Jakarta', pct: 30 }, { name: 'Banten', pct: 15 }],
                related_queries: ['Pemeran Dilan baru', 'Dilan 1997 novel vs film', 'Bioskop Bandung']
            },
            youtube: { view_velocity: '+12%', like_ratio: 0.98, top_comment_sentiment: 'Extremely Positive' },
            tmdb: { global_rank: 14, local_popularity_delta: '+400%' }
        }
    },
    "VINA: SEBELUM 7 HARI": {
        google_trends_7d: [10, 15, 40, 70, 90, 85, 80],
        youtube_daily_views: "250K",
        youtube_velocity_score: 98,
        top_keywords: ["horror", "kisah nyata", "viral"],
        narrative_snippet: "True story angle is creating high word-of-mouth velocity. Strongest social-to-sales conversion candidate.",
        ai_template: {
            'pent-up': "Viral social momentum is creating a 'bottleneck effect' in primary city clusters. View velocity on review content suggests that the audience is actively seeking showtimes that are currently at 95%+ occupancy. The data strongly recommends increasing screen allocation to capture this unfulfilled demand.",
            synced: "Horizontal growth is stabilizing as the viral buzz transforms into steady box office dominance. The conversion rate from search-to-seat remains the highest in the current catalog.",
            'over-hyped': "Social buzz is largely concentrated in non-paying demographics or 'reaction' content that doesn't drive theater traffic. The discrepancy between YT views and actual sales points to a potential reach-vs-resonance failure.",
            fading: "Word-of-mouth has peaked and is now rapidly cooling. Search volume for 'ending explained' has surpassed 'tickets near me,' indicating the theatrical cycle is concluding."
        },
        telemetry: {
            google: {
                top_provinces: [{ name: 'Jawa Tengah', pct: 40 }, { name: 'Jawa Timur', pct: 35 }, { name: 'Jakarta', pct: 15 }],
                related_queries: ['Vina Cirebon asli', 'Kasus Vina 2016', 'Nonton film Vina']
            },
            youtube: { view_velocity: '+35%', like_ratio: 0.92, top_comment_sentiment: 'Controversial/Viral' },
            tmdb: { global_rank: 8, local_popularity_delta: '+1200%' }
        }
    }
};

export const DEFAULT_MOCK: MockSocialEntry = {
    google_trends_7d: [10, 12, 11, 14, 13, 15, 12],
    youtube_daily_views: "1.2K",
    youtube_velocity_score: 20,
    top_keywords: ["bioskop", "review", "film"],
    narrative_snippet: "Baseline organic interest.",
    ai_template: {
        synced: "Steady baseline performance with zero significant social or sales outliers. The title is performing exactly within its projected target demographic with minimal viral potential.",
        'pent-up': "Emerging search signals indicate a potential sleeper hit. Small but high-intent communities are starting to drive local search volume.",
        'over-hyped': "Low-impact social mentions are failing to move the needle on theater occupancy.",
        fading: "Final phase of the theatrical run. Organic interest has reached exhaustion levels."
    },
    telemetry: {
        google: { top_provinces: [{ name: 'Jakarta', pct: 50 }], related_queries: ['Review film', 'Tiket bioskop'] },
        youtube: { view_velocity: '+2%', like_ratio: 0.85, top_comment_sentiment: 'Neutral' },
        tmdb: { global_rank: 150, local_popularity_delta: '0%' }
    }
};
