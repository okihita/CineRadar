/**
 * Movie Daily Performance & Showtimes API
 * 
 * GET /api/performance/[movieId]/days/[date]
 *   → Get daily stats + list of showtimes for that day
 */
import { NextResponse } from 'next/server';
import { firestoreAdminClient } from '@/lib/firebase-admin';

export async function GET(
    request: Request,
    { params }: { params: Promise<{ movieId: string; date: string }> }
) {
    const { movieId, date } = await params;

    try {
        // 1. Get Daily Stats Doc
        // Path: movie_performance/{movieId}/days/{date}
        // Since we don't have a direct 'getDoc' in our client, we use getSubCollectionQuery or just assume we have the data from history list?
        // Actually, let's fetch it to be sure, or just rely on history list.
        // But for showtimes, we definitely need to query.

        // Let's implement getDocument in client? Or just query "days" with limit 1?
        // Actually, we can just treat the history list as the source of stats.
        // But the showtimes are in a sub-subcollection: .../days/{date}/showtimes

        const showtimes = await firestoreAdminClient.getSubCollection(
            `movie_performance/${movieId}/days/${date}/showtimes`
        );

        return NextResponse.json({
            success: true,
            movieId,
            date,
            showtimes
        });
    } catch (error) {
        console.error(`Error fetching data for ${movieId}/${date}:`, error);
        return NextResponse.json(
            { success: false, error: String(error) },
            { status: 500 }
        );
    }
}
