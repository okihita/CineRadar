import { NextResponse } from 'next/server';
import { firestoreRestClient } from '@/lib/firestore-rest';

interface MovieTrendDoc {
    movie_id: string;
    title: string;
    campaign_hashtags: string[];
    days_tracked: number;
    cumulative: Record<string, unknown>;
    daily_history: Array<{
        date: string;
        total_views: number;
        total_likes: number;
        total_comments: number;
        total_shares: number;
        posts_count: number;
        sentiment_score?: number;
    }>;
}

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    try {
        const doc = await firestoreRestClient.getDocument<MovieTrendDoc>('tiktok_movie_trends', id);
        if (doc) {
            return NextResponse.json({ success: true, data: doc });
        }
        return NextResponse.json({ success: false, message: 'Movie trend not found' }, { status: 404 });
    } catch (err: unknown) {
        return NextResponse.json({
            success: false,
            error: err instanceof Error ? err.message : 'Failed to fetch movie trend',
        }, { status: 500 });
    }
}
