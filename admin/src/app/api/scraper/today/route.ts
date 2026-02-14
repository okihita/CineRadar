import { NextRequest, NextResponse } from 'next/server';
import { firestoreRestClient } from '@/lib/firestore-rest';
import type { ScraperLog, DispatchEntry } from '@/features/scraper/types';

/**
 * GET /api/scraper/today
 * 
 * Fetches the consolidated daily scraper log from scraper_logs/{date},
 * including dispatches subcollection for dispatch-level details.
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

        // Fetch root document from scraper_logs/{date}
        const doc = await firestoreRestClient.getDocument('scraper_logs', dateStr);

        if (!doc) {
            return NextResponse.json(
                { error: 'No log found for date', date: dateStr },
                { status: 404 }
            );
        }

        // Fetch dispatches subcollection: scraper_logs/{date}/dispatches
        const dispatchDocs = await firestoreRestClient.getSubCollection(
            `scraper_logs/${dateStr}/dispatches`
        );

        // Transform dispatches into typed entries keyed by time slot
        const dispatches: Record<string, DispatchEntry> = {};
        for (const d of dispatchDocs) {
            const slot = (d.id as string) || '';
            dispatches[slot] = {
                dispatched_at: (d.dispatched_at as string) || '',
                time_slot: (d.time_slot as string) || slot.replace('-', ':'),
                showtimes_found: (d.showtimes_found as number) || 0,
                jobs_published: (d.jobs_published as number) || 0,
                window_start: (d.window_start as string) || '',
                window_end: (d.window_end as string) || '',
                status: (d.status as string) || 'ok',
                total_errors: (d.total_errors as number) || 0,
                total_successes: (d.total_successes as number) || 0,
                error: d.error as string | undefined,
            };
        }

        // Transform to ScraperLog type
        const scraperLog: ScraperLog = {
            date: (doc.date as string) || dateStr,
            created_at: (doc.created_at as string) || '',
            morning_run: doc.morning_run as ScraperLog['morning_run'],
            dispatches,
            daily_summary: doc.daily_summary as ScraperLog['daily_summary'],
            daily_error_summary: doc.daily_error_summary as ScraperLog['daily_error_summary'],
        };

        // Compute summary stats for dispatches
        const dispatchEntries = Object.entries(dispatches);
        const jitSummary = dispatchEntries.length > 0 ? {
            totalRuns: dispatchEntries.length,
            totalShowtimesFound: dispatchEntries.reduce((sum, [, entry]) => sum + (entry.showtimes_found || 0), 0),
            totalJobsPublished: dispatchEntries.reduce((sum, [, entry]) => sum + (entry.jobs_published || 0), 0),
            totalErrors: dispatchEntries.reduce((sum, [, entry]) => sum + (entry.total_errors || 0), 0),
            totalSuccesses: dispatchEntries.reduce((sum, [, entry]) => sum + (entry.total_successes || 0), 0),
            errorCount: dispatchEntries.filter(([, entry]) => entry.status === 'error').length,
            firstDispatch: dispatchEntries.sort(([a], [b]) => a.localeCompare(b))[0]?.[0]?.replace('-', ':'),
            lastDispatch: dispatchEntries.sort(([a], [b]) => b.localeCompare(a))[0]?.[0]?.replace('-', ':'),
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
