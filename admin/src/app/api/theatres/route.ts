/**
 * API Route: /api/theatres
 * Returns all theatres from Firestore
 * 
 * This runs on the SERVER side, so it has access to FIREBASE_SERVICE_ACCOUNT_BASE64
 */

import { NextResponse } from 'next/server';
import { firestoreRestClient } from '@/lib/firestore-rest';

export const dynamic = 'force-dynamic';
export const revalidate = 300; // 5 minutes

export async function GET() {
    try {
        const docs = await firestoreRestClient.getCollection('theatres');
        const theatres = docs.map(doc => ({
            theatre_id: doc.id as string,
            ...doc
        }));

        return NextResponse.json(theatres);
    } catch (error) {
        console.error('Error fetching theatres:', error);
        return NextResponse.json(
            { error: 'Failed to fetch theatres' },
            { status: 500 }
        );
    }
}
