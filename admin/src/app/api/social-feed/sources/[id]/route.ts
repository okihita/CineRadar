/**
 * DELETE /api/social-feed/sources/[id]
 *
 * Admin-only: delete a source document.
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { firestoreRestClient } from '@/lib/firestore-rest';
import { COLLECTIONS } from '@/lib/firestore-social';

function isAdmin(session: unknown): boolean {
    return (session as { user?: { role?: string } })?.user?.role === 'admin';
}

export async function DELETE(
    _request: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) {
    const session = await auth();
    if (!session) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    if (!isAdmin(session)) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });

    const { id } = await params;

    try {
        const ok = await firestoreRestClient.deleteDocument(COLLECTIONS.SOURCES, id);
        if (!ok) {
            return NextResponse.json({ success: false, error: 'Failed to delete source' }, { status: 500 });
        }

        return NextResponse.json({ success: true, data: { id } });
    } catch (error) {
        console.error('[Source Delete Error]', error);
        return NextResponse.json({ success: false, error: 'Failed to delete source' }, { status: 500 });
    }
}
