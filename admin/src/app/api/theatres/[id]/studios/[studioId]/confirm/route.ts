import { NextResponse } from 'next/server';
import { firestoreRestClient } from '@/lib/firestore-rest';

export const dynamic = 'force-dynamic';

export async function POST(
    request: Request,
    { params }: { params: Promise<{ id: string; studioId: string }> }
) {
    try {
        const { id: theatreId, studioId } = await params;
        
        // Update the studio document
        const success = await firestoreRestClient.updateDocument(
            `theatres/${theatreId}/studios`,
            studioId,
            {
                is_locked: true,
                'audit.is_confirmed': true,
                'audit.confirmed_at': new Date().toISOString(),
                'audit.confirmed_by': 'admin_ui'
            }
        );

        if (!success) {
            return NextResponse.json({ error: 'Failed to update studio' }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error(`Error confirming studio:`, error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
