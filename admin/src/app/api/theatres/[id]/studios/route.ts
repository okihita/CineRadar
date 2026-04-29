import { NextResponse } from 'next/server';
import { firestoreRestClient } from '@/lib/firestore-rest';
import { auth } from '@clerk/nextjs/server';

export const dynamic = 'force-dynamic';

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { userId } = await auth();
    if (!userId) {
        return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    try {
        const { id } = await params;
        const docs = await firestoreRestClient.getCollection(`theatres/${id}/studios`);
        const studios = docs.map(doc => ({
            studio_id: doc.id as string,
            ...doc
        }));

        // Sort by ID naturally
        studios.sort((a, b) => {
            const aNum = parseInt(a.studio_id);
            const bNum = parseInt(b.studio_id);
            if (!isNaN(aNum) && !isNaN(bNum)) {
                return aNum - bNum;
            }
            return a.studio_id.localeCompare(b.studio_id);
        });

        return NextResponse.json(studios);
    } catch (error) {
        console.error(`Error fetching studios for theatre:`, error);
        return NextResponse.json(
            { error: 'Failed to fetch studios' },
            { status: 500 }
        );
    }
}
