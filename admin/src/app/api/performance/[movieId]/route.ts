/**
 * Movie Performance Detail API
 * 
 * GET /api/performance/[movieId]
 *   → Get specific movie with all showtime snapshots
 */
import { NextRequest, NextResponse } from 'next/server';
import { initializeApp, cert, getApps, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

function getDB() {
    if (!getApps().length) {
        const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT;

        if (serviceAccountJson && serviceAccountJson !== '{}') {
            const serviceAccount = JSON.parse(serviceAccountJson);
            initializeApp({
                credential: cert(serviceAccount),
            });
        } else {
            initializeApp({
                credential: applicationDefault(),
                projectId: 'cineradar-481014',
            });
        }
    }
    return getFirestore();
}

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ movieId: string }> }
) {
    try {
        const { movieId } = await params;
        const db = getDB();

        // Get movie summary
        const summaryDoc = await db.collection('movie_performance').doc(movieId).get();

        if (!summaryDoc.exists) {
            return NextResponse.json(
                { success: false, error: 'Movie not found' },
                { status: 404 }
            );
        }

        const summary = { id: summaryDoc.id, ...summaryDoc.data() };

        // Get all showtime snapshots for this movie
        const showtimesSnap = await db
            .collection('movie_performance')
            .doc(movieId)
            .collection('showtimes')
            .orderBy('showtime', 'asc')
            .get();

        const showtimes = showtimesSnap.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

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
