/**
 * Movie Database API - Detail
 *
 * GET /api/movies/:id
 *   → Fetches a single movie document from Firestore /movies/{id}
 */
import { NextRequest, NextResponse } from 'next/server';
import { firestoreRestClient } from '@/lib/firestore-rest';
import { auth } from '@clerk/nextjs/server';

export async function GET(
    _request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { userId } = await auth();
    if (!userId) {
        return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    try {
        const { id } = await params;

        const movie = await firestoreRestClient.getDocument('movies', id);

        if (!movie) {
            return NextResponse.json(
                { success: false, error: 'Movie not found' },
                { status: 404 }
            );
        }

        return NextResponse.json({
            success: true,
            movie,
        });
    } catch (error) {
        console.error('Error fetching movie:', error);
        return NextResponse.json(
            { success: false, error: String(error) },
            { status: 500 }
        );
    }
}
