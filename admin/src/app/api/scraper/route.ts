import { NextResponse } from 'next/server';
import { getScraperRuns } from '@/services/theatreService';

export async function GET() {
    try {
        const runs = await getScraperRuns(30); // Get last 30 runs

        return NextResponse.json({
            runs: runs.map(run => ({
                id: run.id,
                date: run.date,
                timestamp: run.timestamp,
                status: run.status,
                movies: run.movies || 0,
                cities: run.cities || 0,
                theatres_total: run.theatres_total || 0,
                theatres_success: run.theatres_success || 0,
                theatres_failed: run.theatres_failed || 0,
                presales: run.presales || 0,
            })),
        });
    } catch (error) {
        console.error('Error fetching scraper runs:', error);
        return NextResponse.json({ runs: [] }, { status: 500 });
    }
}
