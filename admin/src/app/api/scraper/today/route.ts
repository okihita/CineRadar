import { NextRequest, NextResponse } from 'next/server';
import { firestoreRestClient } from '@/lib/firestore-rest';
import type { ScraperLog, DispatchEntry } from '@/features/scraper/types';

/**
 * GET /api/scraper/today
 * 
 * Fetches schedule counts from schedules/{date}/movies (available after morning scrape ~6:35 AM)
 * and optionally scraper logs from scraper_logs/{date} (available after JIT dispatcher starts ~10 AM).
 * 
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

        // 1. ALWAYS fetch schedules first (available after morning scrape ~6:35 AM)
        // This ensures "Schedules Today" card shows data even before JIT dispatcher runs
        let totalSchedules = 0;
        try {
            const moviesRaw = await firestoreRestClient.getSubCollection(
                `schedules/${dateStr}/movies`
            );

            // Count showtimes from each movie's cities -> theatres -> rooms -> all_showtimes
            for (const movie of moviesRaw) {
                const cities = movie.cities as Record<string, unknown[]> || {};
                for (const theatres of Object.values(cities)) {
                    if (!Array.isArray(theatres)) continue;
                    for (const theatre of theatres) {
                        const rooms = (theatre as Record<string, unknown>).rooms as unknown[] || [];
                        for (const room of rooms) {
                            const allShowtimes = (room as Record<string, unknown>).all_showtimes as unknown[];
                            if (Array.isArray(allShowtimes)) {
                                totalSchedules += allShowtimes.length;
                            }
                        }
                    }
                }
            }
        } catch {
            // Silently fail - totalSchedules will be 0
        }

        // 2. Try to fetch scraper_logs/{date} (may not exist before JIT dispatcher starts)
        const doc = await firestoreRestClient.getDocument('scraper_logs', dateStr);

        // If no scraper log exists yet, return schedules-only response
        if (!doc) {
            return NextResponse.json({
                log: null,
                jitSummary: {
                    totalRuns: 0,
                    totalShowtimesFound: 0,
                    totalJobsPublished: 0,
                    totalErrors: 0,
                    totalSuccesses: 0,
                    errorCount: 0,
                    firstDispatch: null,
                    lastDispatch: null,
                    totalSchedules,
                    coveragePercent: 0,
                },
                date: dateStr,
                hasScraperLog: false,
            });
        }

        // 3. Fetch dispatches subcollection: scraper_logs/{date}/dispatches
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
        };

        // Compute summary stats for dispatches
        const dispatchEntries = Object.entries(dispatches);
        const totalShowtimesScraped = dispatchEntries.reduce((sum, [, entry]) => sum + (entry.showtimes_found || 0), 0);

        const jitSummary = {
            totalRuns: dispatchEntries.length,
            totalShowtimesFound: totalShowtimesScraped,
            totalJobsPublished: dispatchEntries.reduce((sum, [, entry]) => sum + (entry.jobs_published || 0), 0),
            totalErrors: dispatchEntries.reduce((sum, [, entry]) => sum + (entry.total_errors || 0), 0),
            totalSuccesses: dispatchEntries.reduce((sum, [, entry]) => sum + (entry.total_successes || 0), 0),
            errorCount: dispatchEntries.filter(([, entry]) => entry.status === 'error').length,
            firstDispatch: dispatchEntries.length > 0
                ? dispatchEntries.sort(([a], [b]) => a.localeCompare(b))[0]?.[0]?.replace('-', ':')
                : null,
            lastDispatch: dispatchEntries.length > 0
                ? dispatchEntries.sort(([a], [b]) => b.localeCompare(a))[0]?.[0]?.replace('-', ':')
                : null,
            // Schedule coverage metrics
            totalSchedules,
            coveragePercent: totalSchedules > 0 ? Math.round((totalShowtimesScraped / totalSchedules) * 100) : 0,
        };

        return NextResponse.json({
            log: scraperLog,
            jitSummary,
            date: dateStr,
            hasScraperLog: true,
        });

    } catch (error) {
        console.error('Error fetching scraper log:', error);
        return NextResponse.json(
            { error: 'Failed to fetch scraper log' },
            { status: 500 }
        );
    }
}

