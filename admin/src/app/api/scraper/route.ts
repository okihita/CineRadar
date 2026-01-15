import { NextResponse } from 'next/server';
import { firestoreRestClient } from '@/lib/firestore-rest';
import { ScraperRun } from '@/types';

// Helper to get date string in WIB timezone
function getWIBDateString(date: Date): string {
    return date.toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' }); // en-CA gives YYYY-MM-DD format
}

// Helper to get hour in WIB timezone
function getWIBHour(date: Date): number {
    return parseInt(date.toLocaleString('en-US', { timeZone: 'Asia/Jakarta', hour: 'numeric', hour12: false }));
}

export async function GET() {
    try {
        // Fetch scraper runs directly from Firestore (server-side)
        const docs = await firestoreRestClient.getCollectionWithQuery('scraper_runs', 'timestamp', 30);
        const runs = docs as unknown as ScraperRun[];

        // Get today's date in WIB timezone
        const todayWIB = getWIBDateString(new Date());

        // Find today's morning scrape (run_type: movies, morning hours in WIB)
        const todayMorningScrape = runs.find(run => {
            if (!run.timestamp) return false;
            const runDate = new Date(run.timestamp);
            const runDateWIB = getWIBDateString(runDate);
            const runHourWIB = getWIBHour(runDate);
            const isMorning = runHourWIB >= 5 && runHourWIB <= 9;
            return runDateWIB === todayWIB && (run.run_type === 'movies' || isMorning);
        });

        // Find all today's JIT runs and consolidate
        const todayJITRuns = runs.filter(run => {
            if (!run.timestamp) return false;
            const runDateWIB = getWIBDateString(new Date(run.timestamp));
            return runDateWIB === todayWIB && run.run_type === 'seats';
        });

        const jitSummary = todayJITRuns.length > 0 ? {
            totalRuns: todayJITRuns.length,
            totalShowtimes: todayJITRuns.reduce((sum, r) => sum + (r.showtimes_scraped || 0), 0),
            successfulShowtimes: todayJITRuns.reduce((sum, r) => sum + (r.showtimes_success || 0), 0),
            firstRun: todayJITRuns[todayJITRuns.length - 1]?.timestamp,
            lastRun: todayJITRuns[0]?.timestamp,
        } : null;

        return NextResponse.json({
            runs: runs.map(run => ({
                id: run.id,
                date: run.date,
                timestamp: run.timestamp,
                status: run.status,
                run_type: run.run_type,
                movies: run.movies || 0,
                cities: run.cities || 0,
                theatres_total: run.theatres_total || 0,
                theatres_success: run.theatres_success || 0,
                theatres_failed: run.theatres_failed || 0,
                presales: run.presales || 0,
            })),
            todayMorningScrape: todayMorningScrape ? {
                status: todayMorningScrape.status,
                timestamp: todayMorningScrape.timestamp,
                movies: todayMorningScrape.movies || 0,
                cities: todayMorningScrape.cities || 0,
                theatres: todayMorningScrape.theatres_total || 0,
            } : null,
            todayJITSummary: jitSummary,
        });
    } catch (error) {
        console.error('Error fetching scraper data:', error);
        return NextResponse.json({ runs: [], todayMorningScrape: null, todayJITSummary: null }, { status: 500 });
    }
}
