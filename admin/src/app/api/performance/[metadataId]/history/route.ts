import { NextResponse } from 'next/server';
import { firestoreRestClient } from '@/lib/firestore-rest';

export const revalidate = 300; // Cache for 5 minutes

interface DayRecord {
    date: string;
    [key: string]: unknown;
}

export async function GET(
    request: Request,
    { params }: { params: Promise<{ metadataId: string }> }
) {
    const { metadataId } = await params;

    try {
        // Get 'days' subcollection from V2
        // Path: movie_performance_v2/{metadataId}/days
        const allDays = await firestoreRestClient.getSubCollection(
            `movie_performance_v2/${metadataId}/days`
        ) as DayRecord[];

        // Filter out records missing a date field
        const days = allDays.filter(d => d && d.date && typeof d.date === 'string');

        // Sort locally by 'date' descending
        days.sort((a, b) => b.date.localeCompare(a.date));

        return NextResponse.json({
            success: true,
            movieId: metadataId,
            history: days
        });
    } catch (error) {
        console.error(`Error fetching history for ${metadataId} (V2):`, error);
        return NextResponse.json(
            { success: false, error: String(error) },
            { status: 500 }
        );
    }
}
