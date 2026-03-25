import { NextResponse } from 'next/server';
import { firestoreRestClient } from '@/lib/firestore-rest';

export const dynamic = 'force-dynamic';

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const [theatreDoc, studiosDocs] = await Promise.all([
            firestoreRestClient.getDocument('theatres', id),
            firestoreRestClient.getSubCollection(`theatres/${id}/studios`)
        ]);

        if (!theatreDoc) {
            return NextResponse.json({ error: 'Theatre not found' }, { status: 404 });
        }

        const stats = {
            count: studiosDocs.length,
            capacity: studiosDocs.reduce((acc, studio) => acc + ((studio.total_seats as number) || 0), 0)
        };

        const theatre = {
            theatre_id: id,
            ...theatreDoc,
            studio_count: stats.count,
            total_capacity: stats.capacity
        };

        return NextResponse.json(theatre);
    } catch (error) {
        console.error(`Error fetching theatre ${error}:`, error);
        return NextResponse.json(
            { error: 'Failed to fetch theatre' },
            { status: 500 }
        );
    }
}
