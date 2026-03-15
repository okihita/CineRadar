/**
 * Movie Performance Detail API
 * 
 * GET /api/performance/[movieId]
 *   → Get specific movie with all showtime snapshots
 */
import { NextRequest, NextResponse } from 'next/server';
import { firestoreRestClient } from '@/lib/firestore-rest';

export const revalidate = 300; // Cache for 5 minutes

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ movieId: string }> }
) {
    try {
        const { movieId } = await params;

        // Get movie summary
        const summaryDoc = await firestoreRestClient.getDocument('movie_performance', movieId);

        if (!summaryDoc) {
            return NextResponse.json(
                { success: false, error: 'Movie not found' },
                { status: 404 }
            );
        }

        const summary = summaryDoc;

        // Get all showtime snapshots for this movie
        let showtimes = await firestoreRestClient.getSubCollection(
            `movie_performance/${movieId}/showtimes`
        );

        // Sort showtimes by 'showtime' field ascending since REST client doesn't sort by default in getSubCollection
        showtimes = showtimes.sort((a, b) => {
            const timeA = (a.showtime as string) || '';
            const timeB = (b.showtime as string) || '';
            return timeA.localeCompare(timeB);
        });

        return NextResponse.json({
            success: true,
            summary,
            showtimes,
            showtimes_count: showtimes.length
        });
    } catch (error) {
        console.error('Error fetching movie performance detail:', error);
        return NextResponse.json(
            { success: false, error: String(error) },
            { status: 500 }
        );
    }
}
