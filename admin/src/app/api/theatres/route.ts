/**
 * API Route: /api/theatres
 * Returns all theatres from Firestore, augmented with studio count and total capacity
 * 
 * This runs on the SERVER side, so it has access to FIREBASE_SERVICE_ACCOUNT_BASE64
 */

import { NextResponse } from 'next/server';
import { firestoreRestClient } from '@/lib/firestore-rest';

export const dynamic = 'force-dynamic';
// Cache for 1 hour to prevent heavy join on every request
export const revalidate = 3600;

export async function GET() {
    try {
        // Fetch all theatres and all studios in parallel
        const [theatresDocs, studiosDocs] = await Promise.all([
            firestoreRestClient.getCollection('theatres'),
            firestoreRestClient.getCollectionGroup('studios')
        ]);

        // Aggregate studio stats by theatre ID
        const theatreStats = new Map<string, { count: number, capacity: number }>();
        for (const studio of studiosDocs) {
            const theatreId = studio._parent_id as string;
            if (!theatreId) continue;

            if (!theatreStats.has(theatreId)) {
                theatreStats.set(theatreId, { count: 0, capacity: 0 });
            }

            const stats = theatreStats.get(theatreId)!;
            stats.count += 1;
            stats.capacity += (studio.total_seats as number) || 0;
        }

        // Augment theatre docs with stats
        const theatres = theatresDocs.map(doc => {
            const theatreId = doc.id as string;
            const stats = theatreStats.get(theatreId);
            
            return {
                theatre_id: theatreId,
                ...doc,
                studio_count: stats?.count || 0,
                total_capacity: stats?.capacity || 0
            };
        });

        return NextResponse.json(theatres);
    } catch (error) {
        console.error('Error fetching augmented theatres:', error);
        return NextResponse.json(
            { error: 'Failed to fetch theatres' },
            { status: 500 }
        );
    }
}
