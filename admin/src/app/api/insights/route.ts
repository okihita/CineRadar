import { NextResponse } from 'next/server';
import { firestoreRestClient } from '@/lib/firestore-rest';
import { auth } from '@/auth';

export const dynamic = 'force-dynamic';
export const revalidate = 3600; // Cache for 1 hour

export async function GET() {
    const session = await auth();
    if (!session) {
        return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const [theatresDocs, studiosDocs] = await Promise.all([
            firestoreRestClient.getCollection('theatres'),
            firestoreRestClient.getCollectionGroup('studios')
        ]);

        const theatreMap = new Map(theatresDocs.map(t => [t.id, t]));

        // 1. Format Capabilities (ATMOS vs 3D)
        const formatStats = { atmos: 0, threeD: 0, total: 0 };
        
        // 2. Regional Pricing (Average REGULAR mon_thu)
        const cityPricing = new Map<string, { total: number, count: number }>();

        // 3. Structural Rigidity (Collisions by Merchant)
        const merchantCollisions = new Map<string, { collisions: number, total: number }>();

        for (const studio of studiosDocs) {
            const theatreId = studio._parent_id as string;
            const theatre = theatreMap.get(theatreId);
            if (!theatre) continue;

            const merchant = (theatre.merchant as string) || 'UNKNOWN';
            
            // Stats init
            if (!merchantCollisions.has(merchant)) {
                merchantCollisions.set(merchant, { collisions: 0, total: 0 });
            }
            const mStats = merchantCollisions.get(merchant)!;
            mStats.total += 1;

            // Collision check (Quarantine logic)
            const studioData = studio as Record<string, unknown>;
            const evidence = (studioData.evidence as unknown[]) || [];
            if (studioData.version !== 3.3 && evidence.length > 0) {
                mStats.collisions += 1;
            }

            // Format check
            const categories = (studioData.all_categories as string[]) || [];
            const isAtmos = categories.some((c: string) => c.toUpperCase().includes('ATMOS'));
            const is3D = categories.some((c: string) => c.toUpperCase().includes('3D'));
            if (isAtmos) formatStats.atmos += 1;
            if (is3D) formatStats.threeD += 1;
            formatStats.total += 1;

            // Pricing check (Regular Mon-Thu)
            const priceGroups = (studioData.price_groups as Record<string, Record<string, Record<string, number>>>) || {};
            const pg = priceGroups['01'];
            const price = pg?.prices?.mon_thu;
            const roomCategory = (studioData.room_category as string) || '';
            const isRegular = roomCategory.toUpperCase().includes('REGULAR');
            
            if (isRegular && typeof price === 'number' && price > 0) {
                const city = (theatre.city as string) || 'UNKNOWN';
                if (!cityPricing.has(city)) {
                    cityPricing.set(city, { total: 0, count: 0 });
                }
                const cStats = cityPricing.get(city)!;
                cStats.total += price;
                cStats.count += 1;
            }
        }

        // Finalize Regional Pricing
        const regionalPricing = Array.from(cityPricing.entries())
            .map(([city, stats]) => ({
                city,
                avgPrice: Math.round(stats.total / stats.count)
            }))
            .sort((a, b) => b.avgPrice - a.avgPrice);

        // Finalize Merchant Rigidity
        const rigidityStats = Array.from(merchantCollisions.entries())
            .map(([merchant, stats]) => ({
                merchant,
                collisionRate: Number(((stats.collisions / stats.total) * 100).toFixed(1)),
                totalStudios: stats.total,
                quarantined: stats.collisions
            }))
            .sort((a, b) => a.collisionRate - b.collisionRate);

        return NextResponse.json({
            formatStats,
            regionalPricing,
            rigidityStats,
            metadata: {
                totalTheatres: theatresDocs.length,
                totalStudios: studiosDocs.length,
                timestamp: new Date().toISOString()
            }
        });
    } catch (error) {
        console.error('Error calculating insights:', error);
        return NextResponse.json({ error: 'Failed to calculate insights' }, { status: 500 });
    }
}
