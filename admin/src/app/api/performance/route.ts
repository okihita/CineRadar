/**
 * Movie Performance API
 * 
 * GET /api/performance
 *   → List all movies with performance data
 * 
 * GET /api/performance/[movieId]
 *   → Get specific movie performance with all showtimes
 */
import { NextResponse } from 'next/server';
import { firestoreAdminClient } from '@/lib/firebase-admin';

export async function GET() {
    try {
        // Get all movie metadata (Root Collection)
        // Note: avg_occupancy_pct is no longer in root, so we sort by last_updated
        const movies = await firestoreAdminClient.getCollectionWithQuery(
            'movie_performance',
            'last_updated',
            100
        );

        return NextResponse.json({
            success: true,
            count: movies.length,
            movies
        });
    } catch (error) {
        console.error('Error fetching movie performance:', error);
        return NextResponse.json(
            { success: false, error: String(error) },
            { status: 500 }
        );
    }
}
