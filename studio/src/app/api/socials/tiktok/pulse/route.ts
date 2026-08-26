import { NextResponse } from 'next/server';
import { firestoreRestClient } from '@/lib/firestore-rest';

interface DailyPulseDoc {
    date: string;
    updated_at: string;
    total_movies_tracked: number;
    leaderboard: Array<{
        rank: number;
        movie_id: string;
        title: string;
        tier: string;
        total_views: number;
        total_likes: number;
        total_comments: number;
        total_shares: number;
        posts_count: number;
        sentiment?: {
            positive: number;
            mixed: number;
            negative: number;
            hype_score?: number;
            praise_points?: string[];
            criticism_themes?: string[];
        };
        top_viral_post?: {
            id: string;
            url: string;
            author: string;
            views: number;
            likes: number;
            snippet: string;
        };
    }>;
}

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date') || new Date().toISOString().split('T')[0];
    const movieId = searchParams.get('movie_id');

    try {
        // If specific movie_id is requested, fetch from subcollection
        if (movieId) {
            const subDoc = await firestoreRestClient.getDocument<Record<string, unknown>>(
                `tiktok_daily_pulse/${date}/movies`,
                movieId
            );
            if (subDoc) {
                return NextResponse.json({ success: true, data: subDoc });
            }
            return NextResponse.json({ success: false, message: 'Movie pulse data not found' }, { status: 404 });
        }

        // Otherwise fetch main daily pulse leaderboard
        const doc = await firestoreRestClient.getDocument<DailyPulseDoc>('tiktok_daily_pulse', date);
        if (doc) {
            return NextResponse.json({
                success: true,
                data: doc,
            });
        }
        return NextResponse.json({
            success: false,
            message: `No social pulse snapshot found for ${date}`,
        }, { status: 404 });
    } catch (err: unknown) {
        return NextResponse.json({
            success: false,
            error: err instanceof Error ? err.message : 'Failed to fetch daily pulse',
        }, { status: 500 });
    }
}
