/**
 * API Route: /api/theatres
 * Returns all theatres from Firestore, augmented with studio count and total capacity
 * 
 * This runs on the SERVER side, so it has access to FIREBASE_SERVICE_ACCOUNT_BASE64
 */

import { NextResponse } from 'next/server';
import { firestoreRestClient } from '@/lib/firestore-rest';
import { auth } from '@clerk/nextjs/server';

export const dynamic = 'force-dynamic';
// Cache for 1 hour to prevent heavy join on every request
export const revalidate = 3600;

export async function GET() {
    const { userId } = await auth();
    if (!userId) {
        return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
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
            
            // Atomic V3.3+ Support: check physical_layout.total_capacity
            // Legacy V1/V2 Fallback: check total_seats
            const studioData = studio as Record<string, unknown>;
            const physLayout = studioData.physical_layout as Record<string, unknown> | undefined;
            const capacity = (physLayout?.total_capacity as number) || (studio.total_seats as number) || 0;
            stats.capacity += capacity;
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

        return NextResponse.json({
            success: true,
            data: theatres
        });
    } catch (error) {
        console.error('Error fetching augmented theatres:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to fetch theatres' },
            { status: 500 }
        );
    }
}
