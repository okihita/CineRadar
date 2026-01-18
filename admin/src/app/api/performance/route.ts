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
import { initializeApp, cert, getApps, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Initialize Firebase Admin
function getDB() {
    if (!getApps().length) {
        const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT;

        if (serviceAccountJson && serviceAccountJson !== '{}') {
            // Production: use service account from env var
            const serviceAccount = JSON.parse(serviceAccountJson);
            initializeApp({
                credential: cert(serviceAccount),
            });
        } else {
            // Local dev: use application default credentials
            initializeApp({
                credential: applicationDefault(),
                projectId: 'cineradar-481014',
            });
        }
    }
    return getFirestore();
}

export async function GET() {
    try {
        const db = getDB();

        // Get all movie performance summaries
        const snapshot = await db.collection('movie_performance').limit(100).get();

        const movies: Array<{ id: string; avg_occupancy_pct?: number;[key: string]: unknown }> = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        // Sort by avg occupancy descending
        movies.sort((a, b) => (b.avg_occupancy_pct || 0) - (a.avg_occupancy_pct || 0));

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
