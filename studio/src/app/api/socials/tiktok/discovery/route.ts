import { NextResponse } from 'next/server';
import { firestoreRestClient } from '@/lib/firestore-rest';

interface DiscoveryDoc {
    date: string;
    discovered_at: string;
    total_theatrical_titles: number;
    resolved_count: number;
    movies: Record<string, {
        title: string;
        movie_id: string;
        age_category: string;
        discovered_hashtags: string[];
        contributing_sources: string[];
        verified: boolean;
    }>;
}

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date') || new Date().toISOString().split('T')[0];

    try {
        const doc = await firestoreRestClient.getDocument<DiscoveryDoc>('tiktok_hashtag_discovery', date);
        if (doc) {
            return NextResponse.json({
                success: true,
                data: doc,
            });
        }
        return NextResponse.json({
            success: false,
            message: `No discovery snapshot found for ${date}`,
        }, { status: 404 });
    } catch (err: unknown) {
        return NextResponse.json({
            success: false,
            error: err instanceof Error ? err.message : 'Failed to fetch discovery data',
        }, { status: 500 });
    }
}
