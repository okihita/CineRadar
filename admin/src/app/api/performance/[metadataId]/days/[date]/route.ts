/**
 * Movie Daily Performance & Showtimes API
 * 
 * GET /api/performance/[metadataId]/days/[date]
 *   → Get daily list of showtimes for that day (V2)
 */
import { NextResponse } from 'next/server';
import { firestoreRestClient } from '@/lib/firestore-rest';
import { auth } from '@clerk/nextjs/server';

export const revalidate = 300; // Cache for 5 minutes

export async function GET(
    request: Request,
    { params }: { params: Promise<{ metadataId: string; date: string }> }
) {
    const { userId } = await auth();
    if (!userId) {
        return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    const { metadataId, date } = await params;

    try {
        // Fetch showtimes from V2 sub-subcollection: 
        // movie_performance_v2/{metadataId}/days/{date}/showtimes
        const showtimes = await firestoreRestClient.getSubCollection(
            `movie_performance_v2/${metadataId}/days/${date}/showtimes`
        );

        return NextResponse.json({
            success: true,
            movieId: metadataId,
            date,
            showtimes
        });
    } catch (error) {
        console.error(`Error fetching V2 data for ${metadataId}/${date}:`, error);
        return NextResponse.json(
            { success: false, error: String(error) },
            { status: 500 }
        );
    }
}
