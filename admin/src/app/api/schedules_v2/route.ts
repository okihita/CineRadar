import { NextRequest, NextResponse } from 'next/server';
import { firestoreRestClient } from '@/lib/firestore-rest';
import { ScheduleResponse, MovieSchedule } from '@/features/schedules/types';

// Get today's date in Jakarta timezone (YYYY-MM-DD)
function getTodayJakarta(): string {
    return new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Jakarta' });
}

export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams;
        const date = searchParams.get('date') || getTodayJakarta();

        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
            return NextResponse.json(
                { success: false, error: 'Invalid date format. Use YYYY-MM-DD' },
                { status: 400 }
            );
        }

        // Collection path: schedules_v2/{date}/movies
        const path = `schedules_v2/${date}/movies`;

        // Using getSubCollection which internally does a runQuery on the parent document
        const moviesRaw = await firestoreRestClient.getSubCollection(path);

        // Add source indicator for V2
        const movies = (moviesRaw as unknown as MovieSchedule[]).map(m => ({
            ...m,
            source: 'v2_api'
        }));

        return NextResponse.json({
            success: true,
            date,
            count: movies.length,
            source: 'schedules_v2',
            movies
        } as ScheduleResponse & { source: string });

    } catch (error) {
        console.error('Error fetching schedules_v2:', error);
        return NextResponse.json(
            { success: false, error: String(error) },
            { status: 500 }
        );
    }
}
