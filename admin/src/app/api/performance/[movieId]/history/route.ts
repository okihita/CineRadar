/**
 * Movie Performance History API
 * 
 * GET /api/performance/[movieId]/history
 *   → Get daily performance stats for a movie
 */
import { NextResponse } from 'next/server';
import { firestoreAdminClient } from '@/lib/firebase-admin';

export async function GET(
    request: Request,
    { params }: { params: Promise<{ movieId: string }> }
) {
    const { movieId } = await params;

    try {
        // Get 'days' subcollection
        // Path: movie_performance/{movieId}/days
        // We order by 'date' descending
        const days = await firestoreAdminClient.getSubCollection(
            `movie_performance/${movieId}/days`
        );

        // Sort locally if API doesn't support generic subcollection query with sort
        // Assuming getSubCollection returns all docs
        days.sort((a: any, b: any) => b.date.localeCompare(a.date));

        return NextResponse.json({
            success: true,
            movieId,
            history: days
        });
    } catch (error) {
        console.error(`Error fetching history for ${movieId}:`, error);
        return NextResponse.json(
            { success: false, error: String(error) },
            { status: 500 }
        );
    }
}
