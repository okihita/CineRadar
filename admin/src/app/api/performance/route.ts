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
        // Get all movie performance summaries using REST API
        const movies = await firestoreAdminClient.getCollectionWithQuery(
            'movie_performance',
            'avg_occupancy_pct',
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
