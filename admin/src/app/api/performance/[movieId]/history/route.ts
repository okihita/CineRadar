import { NextResponse } from 'next/server';
import { firestoreRestClient } from '@/lib/firestore-rest';

interface DayRecord {
    date: string;
    [key: string]: unknown;
}

export async function GET(
    request: Request,
    { params }: { params: unknown }
) {
    const { movieId } = await (params as Promise<{ movieId: string }>);

    try {
        // Get 'days' subcollection
        // Path: movie_performance/{movieId}/days
        // We order by 'date' descending
        const days = await firestoreRestClient.getSubCollection(
            `movie_performance/${movieId}/days`
        ) as DayRecord[];

        // Sort locally if API doesn't support generic subcollection query with sort
        // Assuming getSubCollection returns all docs
        days.sort((a, b) => b.date.localeCompare(a.date));

        return NextResponse.json({
            success: true,
            movieId,
            history: days
        });
    } catch (error) {
        console.error(`Error fetching history for ${movieId}:`, error);
        return NextResponse.json(
            { success: false, error: String(error) },
            { status: 500 }
        );
    }
}
