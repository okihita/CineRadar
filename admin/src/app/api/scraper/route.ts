import { NextResponse } from 'next/server';
import { firestoreRestClient } from '@/lib/firestore-rest';

// Helper to get date string in WIB timezone
function getWIBDateString(date: Date): string {
    return date.toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' }); // en-CA gives YYYY-MM-DD format
}

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
