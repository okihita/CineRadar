import { useMemo } from 'react';
import { MovieWithStats } from '@/features/performances/types/performance';
import { MovieBuzz, SocialSignal } from '../types';
import { MOCK_SOCIAL_DB, DEFAULT_MOCK } from '../data/mockSocialDb';

/**
 * Deterministic pseudo-random based on a seed.
 * Uses a simple linear congruential generator so history_14d
 * is stable across re-renders (unlike Math.random).
 */
function seededRandom(seed: number): number {
    const x = Math.sin(seed * 9301 + 49297) * 233280;
    return x - Math.floor(x);
}

function generateHistory14d(buzzScore: number, salesScore: number, seed: number) {
    return Array.from({ length: 14 }, (_, i) => {
        const day = 14 - i;
        const jitterBuzz = seededRandom(seed + i * 7) * 10;
        const jitterSales = seededRandom(seed + i * 13) * 5;
        return {
            date: `D-${day}`,
            buzz: Math.max(10, buzzScore - day * 2 + jitterBuzz),
            sales: Math.max(5, salesScore - day * 1.5 + jitterSales),
        };
    });
}

function computeInsight(buzzScore: number, salesScore: number): MovieBuzz['insight'] {
    if (buzzScore - salesScore > 15) return 'pent-up';
    if (salesScore - buzzScore > 15) return 'over-hyped';
    if (buzzScore < 30 && salesScore < 30) return 'fading';
    return 'synced';
}

function computeMomentum(trend: number[]): MovieBuzz['momentum'] {
    if (trend[6] > trend[5] * 1.1) return 'rising';
    if (trend[6] < trend[5] * 0.9) return 'falling';
    return 'stable';
}

export function useMovieEnrichment(rawMovies: MovieWithStats[]) {
    const maxSales = useMemo(
        () => Math.max(...rawMovies.map(m => m.today?.total_sold || 1)),
        [rawMovies]
    );

    const enrichedMovies: MovieBuzz[] = useMemo(() => {
        return rawMovies.slice(0, 15).map((m, idx) => {
            const mock = MOCK_SOCIAL_DB[m.title.toUpperCase()] || DEFAULT_MOCK;
            const trend = mock.google_trends_7d;

            const salesScore = Math.round(((m.today?.total_sold || 0) / maxSales) * 100);
            const buzzScore = Math.round((trend[6] * 0.6) + (mock.youtube_velocity_score * 0.4));
            const insight = computeInsight(buzzScore, salesScore);

            // Use metadata_id hash as seed for deterministic randomness
            const seed = m.id.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0) + idx;

            return {
                metadata_id: m.id,
                title: m.title,
                poster: m.poster,
                buzz_score: buzzScore,
                sales_score: salesScore,
                momentum: computeMomentum(trend),
                insight,
                top_keywords: mock.top_keywords,
                trends_7d: trend,
                ai_analysis: mock.ai_template[insight],
                history_14d: generateHistory14d(buzzScore, salesScore, seed),
                telemetry: mock.telemetry,
                metrics: {
                    google_trends: trend[6],
                    youtube_velocity: mock.youtube_velocity_score,
                    ocr_pct: m.today?.avg_occupancy_pct || 0,
                    raw_sold: m.today?.total_sold || 0,
                    raw_seats: m.today?.total_seats || 0,
                    raw_shows: m.today?.total_showtimes || 0,
                },
            } satisfies MovieBuzz;
        }).sort((a, b) => b.buzz_score - a.buzz_score);
    }, [rawMovies, maxSales]);

    return { enrichedMovies };
}

export function useNarrative(enrichedMovies: MovieBuzz[]) {
    return useMemo(() => {
        const topPentUp = enrichedMovies.find(m => m.insight === 'pent-up');
        const topSynced = enrichedMovies.find(m => m.insight === 'synced');

        if (topPentUp && topSynced) {
            return `Demand for '${topPentUp.title}' is spiking significantly in search, while '${topSynced.title}' remains the current market leader with stable conversion.`;
        }
        return "Market signals are stabilizing. Local horror content is currently driving the highest search-to-sales velocity.";
    }, [enrichedMovies]);
}

export function useSignals(enrichedMovies: MovieBuzz[]): SocialSignal[] {
    return useMemo(() => {
        const topMovie = enrichedMovies[0];
        const mock = MOCK_SOCIAL_DB[topMovie?.title.toUpperCase()] || DEFAULT_MOCK;

        return [
            {
                source: 'YouTube',
                author: 'Cine Crib',
                title: `${topMovie?.title} REVIEW - Forensic Breakdown`,
                url: 'https://youtube.com',
                engagement_score: 95,
                sentiment: 'positive',
                views: `${mock.youtube_daily_views} Views Today`,
                timestamp: new Date().toISOString()
            },
            {
                source: 'GoogleTrends',
                author: 'Trending ID',
                title: `Breakout Search: ${topMovie?.top_keywords[0]}`,
                url: 'https://trends.google.com',
                engagement_score: topMovie?.buzz_score || 80,
                sentiment: 'neutral',
                views: 'High Velocity',
                timestamp: new Date().toISOString()
            }
        ];
    }, [enrichedMovies]);
}
