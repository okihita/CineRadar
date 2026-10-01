import { NextResponse } from 'next/server';
import { firestoreRestClient } from '@/lib/firestore-rest';
import { DEFAULT_TICKET_PRICE } from '@/features/performances/utils/format';
import { auth } from '@/auth';

export const revalidate = 300; // Cache for 5 minutes

interface DayRecord {
    date: string;
    total_sold?: number;
    gross_revenue?: number;
    [key: string]: unknown;
}

export async function GET(
    request: Request,
    { params }: { params: Promise<{ metadataId: string }> }
) {
    const session = await auth();
    if (!session) {
        return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { metadataId } = await params;

    try {
        // Get 'days' subcollection from V2
        // Path: movie_performance_v2/{metadataId}/days
        const allDays = await firestoreRestClient.getSubCollection(
            `movie_performance_v2/${metadataId}/days`
        ) as DayRecord[];

        // Filter out records missing a date field
        const days = allDays.filter(d => d && d.date && typeof d.date === 'string');

        // Enrich with gross revenue if not already stored
        const enrichedDays = days.map(d => ({
            ...d,
            gross_revenue: (d.gross_revenue as number) || (((d.total_sold as number) || 0) * DEFAULT_TICKET_PRICE),
        }));

        // Sort locally by 'date' descending
        enrichedDays.sort((a, b) => b.date.localeCompare(a.date));

        return NextResponse.json({
            success: true,
            data: {
                movieId: metadataId,
                history: enrichedDays
            }
        });
    } catch (error) {
        console.error(`Error fetching history for ${metadataId} (V2):`, error);
        return NextResponse.json(
            { success: false, error: String(error) },
            { status: 500 }
        );
    }
}
