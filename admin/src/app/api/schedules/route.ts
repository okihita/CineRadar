import { NextRequest, NextResponse } from 'next/server';
import { firestoreAdminClient } from '@/lib/firebase-admin';
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

        // Collection path: schedules/{date}/movies
        const path = `schedules/${date}/movies`;

        // Using getSubCollection which internally does a runQuery on the parent document
        const moviesRaw = await firestoreAdminClient.getSubCollection(path);

        return NextResponse.json({
            success: true,
            date,
            count: moviesRaw.length,
            movies: moviesRaw as unknown as MovieSchedule[]
        } as ScheduleResponse);

    } catch (error) {
        console.error('Error fetching schedules:', error);
        return NextResponse.json(
            { success: false, error: String(error) },
            { status: 500 }
        );
    }
}
