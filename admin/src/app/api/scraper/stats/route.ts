
import { NextResponse } from 'next/server';
import { firestoreClient } from '@/lib/firebase';

// Known Firestore collections - excluded auth_tokens for security/timeout
const COLLECTIONS = ['theatres', 'scraper_runs', 'snapshots', 'seat_snapshots'];

interface CollectionStats {
    name: string;
    count: number;
    sample: Record<string, unknown> | null;
    fields: string[];
}

export async function GET() {
    try {
        // Fetch collection stats in parallel
        const collectionStats: CollectionStats[] = await Promise.all(
            COLLECTIONS.map(async (name) => {
                try {
                    // Note: getCollectionCount can be slow for large collections
                    const [count, sample] = await Promise.all([
                        firestoreClient.getCollectionCount(name),
                        firestoreClient.getSampleDocument(name),
                    ]);

                    // Extract field names from sample
                    const fields = sample ? Object.keys(sample).filter(k => k !== 'id') : [];

                    // Clean sample for display (truncate long values)
                    const cleanSample = sample ? cleanForDisplay(sample) : null;

                    return { name, count, sample: cleanSample, fields };
                } catch (error) {
                    console.error(`Error fetching stats for ${name}:`, error);
                    return { name, count: 0, sample: null, fields: [] };
                }
            })
        );

        return NextResponse.json({
            collections: collectionStats,
        });
    } catch (error) {
        console.error('Error fetching collection stats:', error);
        return NextResponse.json({ collections: [] }, { status: 500 });
    }
}

// Clean data for display (truncate long arrays/strings)
function cleanForDisplay(obj: Record<string, unknown>): Record<string, unknown> {
    const result: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(obj)) {
        if (Array.isArray(value)) {
            if (value.length > 3) {
                result[key] = [...value.slice(0, 3), `... +${value.length - 3} more`];
            } else {
                result[key] = value;
            }
        } else if (typeof value === 'string' && value.length > 100) {
            result[key] = value.substring(0, 100) + '...';
        } else if (typeof value === 'object' && value !== null) {
            result[key] = '[Object]';
        } else {
            result[key] = value;
        }
    }

    return result;
}
