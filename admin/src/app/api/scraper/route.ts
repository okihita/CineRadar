import { NextResponse } from 'next/server';
import { firestoreRestClient } from '@/lib/firestore-rest';
import { auth } from '@clerk/nextjs/server';


export async function GET() {
    const { userId } = await auth();
    if (!userId) {
        return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    try {
        // Fetch scraper logs directly from Firestore
        // Sorted by date descending (newest first)
        const docs = await firestoreRestClient.getCollectionWithQuery('scraper_logs', 'date', 30);

        return NextResponse.json({
            success: true,
            data: {
                runs: docs
            }
        });
    } catch (error) {
        console.error('Error fetching scraper logs:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to fetch scraper logs' },
            { status: 500 }
        );
    }
}
