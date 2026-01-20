import { NextResponse } from 'next/server';
import { firestoreRestClient } from '@/lib/firestore-rest';


export async function GET() {
    try {
        // Fetch scraper logs directly from Firestore
        // Sorted by date descending (newest first)
        const docs = await firestoreRestClient.getCollectionWithQuery('scraper_logs', 'date', 30);

        return NextResponse.json({
            logs: docs
        });
    } catch (error) {
        console.error('Error fetching scraper logs:', error);
        return NextResponse.json({ logs: [] }, { status: 500 });
    }
}
