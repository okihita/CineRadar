/**
 * Fetch specific showtime raw layout for audit
 * 
 * GET /api/performance/[metadataId]/days/[date]/showtimes/[showtimeId]
 */
import { NextResponse } from 'next/server';
import { firestoreRestClient } from '@/lib/firestore-rest';
import { auth } from '@/auth';

export async function GET(
    request: Request,
    { params }: { params: Promise<{ metadataId: string; date: string; showtimeId: string }> }
) {
    const session = await auth();
    if (!session) {
        return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { metadataId, date, showtimeId } = await params;

    try {
        // Standard REST client getDocument expects (collectionPath, documentId)
        const collectionPath = `movie_performance_v2/${metadataId}/days/${date}/showtimes`;
        const doc = await firestoreRestClient.getDocument(collectionPath, showtimeId);

        if (!doc) {
            return NextResponse.json({ success: false, error: 'Showtime not found' }, { status: 404 });
        }

        return NextResponse.json(doc);
    } catch (error) {
        console.error(`Error fetching showtime ${showtimeId}:`, error);
        return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
    }
}
