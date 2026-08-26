import { NextResponse } from 'next/server';
import { firestoreRestClient } from '@/lib/firestore-rest';

interface CircuitTimelineDoc {
    date: string;
    crawled_at: string;
    total_posts: number;
    chains: {
        cinema_21: { name: string; handle: string; posts: Array<Record<string, unknown>> };
        cgv_id: { name: string; handle: string; posts: Array<Record<string, unknown>> };
        cinepolis_id: { name: string; handle: string; posts: Array<Record<string, unknown>> };
        studios: { name: string; handle: string; posts: Array<Record<string, unknown>> };
    };
}

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date') || new Date().toISOString().split('T')[0];

    try {
        const doc = await firestoreRestClient.getDocument<CircuitTimelineDoc>('tiktok_circuit_timeline', date);
        if (doc) {
            return NextResponse.json({
                success: true,
                data: doc,
            });
        }
        return NextResponse.json({
            success: false,
            message: `No circuit timeline snapshot found for ${date}`,
        }, { status: 404 });
    } catch (err: unknown) {
        return NextResponse.json({
            success: false,
            error: err instanceof Error ? err.message : 'Failed to fetch circuit timeline',
        }, { status: 500 });
    }
}
