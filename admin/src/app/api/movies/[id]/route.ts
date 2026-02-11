/**
 * Movie Database API - Detail
 *
 * GET /api/movies/:id
 *   → Fetches a single movie document from Firestore /movies/{id}
 */
import { NextRequest, NextResponse } from 'next/server';
import { firestoreAdminClient } from '@/lib/firebase-admin';

export async function GET(
    _request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;

        const movie = await firestoreAdminClient.getDocument(`movies/${id}`);

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
