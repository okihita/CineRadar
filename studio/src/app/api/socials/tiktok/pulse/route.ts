import { NextResponse } from 'next/server';
import { firestoreRestClient } from '@/lib/firestore-rest';
import { getTodayJakarta } from '@/lib/timeUtils';
import type { DailyPulseDoc } from '@/features/tiktok/types';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date') || getTodayJakarta();
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
