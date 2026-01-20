import { NextRequest, NextResponse } from 'next/server';
import { firestoreRestClient } from '@/lib/firestore-rest';
import type { ScraperLog } from '@/features/scraper/types';

/**
 * GET /api/scraper/today
 * 
 * Fetches the consolidated daily scraper log from scraper_logs/{date}.
 * Query params:
 *   - date: Optional date in YYYY-MM-DD format. Defaults to today (Jakarta time).
 */
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        let dateStr = searchParams.get('date');

        // Default to today in Jakarta timezone
        if (!dateStr) {
            dateStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });
        }

        // Fetch document from scraper_logs/{date}
        const doc = await firestoreRestClient.getDocument('scraper_logs', dateStr);

        if (!doc) {
            return NextResponse.json(
                { error: 'No log found for date', date: dateStr },
                { status: 404 }
            );
        }

        // Transform to ScraperLog type
        const scraperLog: ScraperLog = {
            date: (doc.date as string) || dateStr,
            created_at: (doc.created_at as string) || '',
            morning_run: doc.morning_run as ScraperLog['morning_run'],
            jit_runs: doc.jit_runs as ScraperLog['jit_runs'],
            daily_summary: doc.daily_summary as ScraperLog['daily_summary'],
        };

        // Compute summary stats for JIT runs
        const jitEntries = scraperLog.jit_runs ? Object.entries(scraperLog.jit_runs) : [];
        const jitSummary = jitEntries.length > 0 ? {
            totalRuns: jitEntries.length,
            totalShowtimesFound: jitEntries.reduce((sum, [, entry]) => sum + (entry.showtimes_found || 0), 0),
            totalJobsPublished: jitEntries.reduce((sum, [, entry]) => sum + (entry.jobs_published || 0), 0),
            errorCount: jitEntries.filter(([, entry]) => entry.status === 'error').length,
            firstDispatch: jitEntries.sort(([a], [b]) => a.localeCompare(b))[0]?.[0],
            lastDispatch: jitEntries.sort(([a], [b]) => b.localeCompare(a))[0]?.[0],
        } : null;

        return NextResponse.json({
            log: scraperLog,
            jitSummary,
            date: dateStr,
        });

    } catch (error) {
        console.error('Error fetching scraper log:', error);
        return NextResponse.json(
            { error: 'Failed to fetch scraper log' },
            { status: 500 }
        );
    }
}
