import { NextRequest, NextResponse } from 'next/server';
import { firestoreRestClient } from '@/lib/firestore-rest';

/**
 * Schedules V2 API Route
 * 
 * Fetches from schedules_v2 collection which uses metadata_id as document ID.
 * This provides immutable movie entity identification across cinema chains.
 * 
 * V2 Document Structure:
 * - metadata_id: Immutable movie entity ID (document ID)
 * - schedule_ids: Array of associated schedule_ids across cinema chains
 * - title, poster, genres, etc.
 */

interface MovieScheduleV2 {
    metadata_id: string;
    schedule_ids: string[];
    title: string;
    poster?: string;
    genres?: string[];
    age_category?: string;
    merchants?: string[];
    is_presale?: boolean;
    cities?: Record<string, unknown[]>;
    date: string;
    uploaded_at: string;
    source: string;
}

interface ScheduleV2Response {
    success: boolean;
    date: string;
    count: number;
    movies: MovieScheduleV2[];
    v1_count?: number;
    comparison?: {
        v2_only: number;
        v1_only: number;
        both: number;
    };
}

// Get today's date in Jakarta timezone (YYYY-MM-DD)
function getTodayJakarta(): string {
    return new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Jakarta' });
}

export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams;
        const date = searchParams.get('date') || getTodayJakarta();
        const includeComparison = searchParams.get('compare') === 'true';

        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
            return NextResponse.json(
                { success: false, error: 'Invalid date format. Use YYYY-MM-DD' },
                { status: 400 }
            );
        }

        // Collection path: schedules_v2/{date}/movies
        const v2Path = `schedules_v2/${date}/movies`;

        // Fetch V2 movies
        const moviesV2 = await firestoreRestClient.getSubCollection(v2Path) as unknown as MovieScheduleV2[];

        let comparisonData: ScheduleV2Response['comparison'] | undefined;
        let v1Count: number | undefined;

        // Optionally fetch V1 for comparison
        if (includeComparison) {
            const v1Path = `schedules/${date}/movies`;
            const moviesV1 = await firestoreRestClient.getSubCollection(v1Path) as unknown as { movie_id: string }[];
            v1Count = moviesV1.length;

            // Calculate comparison metrics
            const v2MetadataIds = new Set(moviesV2.map(m => m.metadata_id));
            const v1ScheduleIds = new Set(moviesV1.map(m => m.movie_id));
            
            // Get all schedule_ids from V2 documents
            const v2ScheduleIds = new Set(
                moviesV2.flatMap(m => m.schedule_ids || [])
            );

            comparisonData = {
                v2_only: v2MetadataIds.size,
                v1_only: v1ScheduleIds.size - v2ScheduleIds.size,
                both: v2ScheduleIds.size
            };
        }

        return NextResponse.json({
            success: true,
            date,
            count: moviesV2.length,
            v1_count: v1Count,
            comparison: comparisonData,
            movies: moviesV2
        } as ScheduleV2Response);

    } catch (error) {
        console.error('Error fetching schedules_v2:', error);
        return NextResponse.json(
            { success: false, error: String(error) },
            { status: 500 }
        );
    }
}
