import { NextResponse } from 'next/server';
import { firestoreRestClient } from '@/lib/firestore-rest';

// Revalidate every hour
export const revalidate = 3600;
export const dynamic = 'force-dynamic'; // or 'force-static' with revalidate

export async function GET() {
    try {
        // Get all theatres for names
        const theatresDocs = await firestoreRestClient.getCollection('theatres');
        const theatreNames = new Map<string, string>();
        for (const doc of theatresDocs) {
            theatreNames.set(doc.id as string, (doc.name as string) || 'Unknown');
        }

        // Get all studios
        const studios = await firestoreRestClient.getCollectionGroup('studios');

        let totalStudios = 0;
        let scrapedStudios = 0;
        let v3Count = 0;
        let v2Count = 0;
        let confirmedCount = 0;
        let pendingCount = 0;
        
        const theatreStats = new Map<string, {
            id: string;
            name: string;
            total: number;
            scraped: number;
            missingStudios: string[];
        }>();

        for (const studio of studios) {
            const theatreId = studio._parent_id as string;
            const studioId = studio.id as string;
            const totalSeats = (studio.total_seats as number) || 0;
            const version = (studio.version as number) || 0;
            const audit = (studio.audit as { source?: string; is_confirmed?: boolean }) || {};
            const isLocked = (studio.is_locked as boolean) || false;

            if (!theatreStats.has(theatreId)) {
                theatreStats.set(theatreId, {
                    id: theatreId,
                    name: theatreNames.get(theatreId) || `Unknown (${theatreId})`,
                    total: 0,
                    scraped: 0,
                    missingStudios: []
                });
            }

            const stats = theatreStats.get(theatreId)!;
            stats.total += 1;
            totalStudios += 1;

            if (totalSeats > 0) {
                stats.scraped += 1;
                scrapedStudios += 1;

                // Audit Stats
                const isV3 = version === 3 || audit.source === 'raw_initial_layout';
                const isConfirmed = audit.is_confirmed === true || isLocked === true;

                if (isV3) v3Count += 1;
                else v2Count += 1;

                if (isConfirmed) confirmedCount += 1;
                else pendingCount += 1;
            } else {
                stats.missingStudios.push(studioId);
            }
        }

        let fullyScrapedTheatres = 0;
        let partiallyScrapedTheatres = 0;
        let totallyMissingTheatres = 0;
        const missingList: Array<{
            theatre_id: string;
            name: string;
            missing_studios: string[];
            total: number;
            scraped: number;
        }> = [];

        for (const stats of theatreStats.values()) {
            if (stats.scraped === stats.total && stats.total > 0) {
                fullyScrapedTheatres += 1;
            } else if (stats.scraped > 0 && stats.scraped < stats.total) {
                partiallyScrapedTheatres += 1;
                missingList.push({
                    theatre_id: stats.id,
                    name: stats.name,
                    missing_studios: stats.missingStudios,
                    total: stats.total,
                    scraped: stats.scraped
                });
            } else if (stats.scraped === 0) {
                totallyMissingTheatres += 1;
                missingList.push({
                    theatre_id: stats.id,
                    name: stats.name,
                    missing_studios: stats.missingStudios,
                    total: stats.total,
                    scraped: stats.scraped
                });
            }
        }

        const totalTheatres = theatreStats.size;

        return NextResponse.json({
            studio_progress: {
                total: totalStudios,
                scraped: scrapedStudios,
                percentage: totalStudios > 0 ? (scrapedStudios / totalStudios) * 100 : 0,
                v3_count: v3Count,
                v2_count: v2Count,
                confirmed_count: confirmedCount,
                pending_count: pendingCount
            },
            theatre_progress: {
                total: totalTheatres,
                fully_scraped: fullyScrapedTheatres,
                partially_scraped: partiallyScrapedTheatres,
                totally_missing: totallyMissingTheatres,
                percentage: totalTheatres > 0 ? (fullyScrapedTheatres / totalTheatres) * 100 : 0
            },
            missing_list: missingList.sort((a, b) => a.name.localeCompare(b.name))
        });

    } catch (error) {
        console.error('Error calculating studio coverage:', error);
        return NextResponse.json({ error: 'Failed to calculate coverage' }, { status: 500 });
    }
}
