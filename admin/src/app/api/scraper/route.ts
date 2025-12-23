import { NextResponse } from 'next/server';
import { getScraperRuns } from '@/services/theatreService';
import { firestoreClient } from '@/lib/firebase';

// Known Firestore collections
const COLLECTIONS = ['theatres', 'scraper_runs', 'snapshots', 'auth_tokens'];

interface CollectionStats {
    name: string;
    count: number;
    sample: Record<string, unknown> | null;
    fields: string[];
}

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
        // Fetch scraper runs
        const runs = await getScraperRuns(30);

        // Get today's date in WIB timezone (the timezone we care about for "today")
        const todayWIB = getWIBDateString(new Date());

        // Find today's morning scrape (run_type: movies, morning hours in WIB)
        const todayMorningScrape = runs.find(run => {
            if (!run.timestamp) return false;
            const runDate = new Date(run.timestamp);
            const runDateWIB = getWIBDateString(runDate);
            const runHourWIB = getWIBHour(runDate);
            const isMorning = runHourWIB >= 5 && runHourWIB <= 9; // 5-9 AM WIB
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

        // Fetch collection stats in parallel
        const collectionStats: CollectionStats[] = await Promise.all(
            COLLECTIONS.map(async (name) => {
                try {
                    const [count, sample] = await Promise.all([
                        firestoreClient.getCollectionCount(name),
                        firestoreClient.getSampleDocument(name),
                    ]);

                    // Extract field names from sample
                    const fields = sample ? Object.keys(sample).filter(k => k !== 'id') : [];

                    // Clean sample for display (truncate long values)
                    const cleanSample = sample ? cleanForDisplay(sample) : null;

                    return { name, count, sample: cleanSample, fields };
                } catch {
                    return { name, count: 0, sample: null, fields: [] };
                }
            })
        );

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
            collections: collectionStats,
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
        return NextResponse.json({ runs: [], collections: [], todayMorningScrape: null, todayJITSummary: null }, { status: 500 });
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
