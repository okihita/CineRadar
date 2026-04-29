import { NextRequest, NextResponse } from 'next/server';
import { firestoreRestClient } from '@/lib/firestore-rest';
import type { ScraperLog, DispatchEntry } from '@/features/scraper/types';
import { getTodayJakarta } from '@/lib/timeUtils';

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
            dateStr = getTodayJakarta();
        }

        // 1. ALWAYS fetch schedules first (available after morning scrape ~6:35 AM)
        // This ensures "Schedules Today" card shows data even before JIT dispatcher runs
        let totalSchedules = 0;
        let availableSchedules = 0;
        try {
            const moviesRaw = await firestoreRestClient.getSubCollection(
                `schedules/${dateStr}/movies`
            );

            // Count showtimes from each movie's cities -> theatres -> rooms -> all_showtimes
            // Separate count for total vs available (is_available !== false)
            for (const movie of moviesRaw) {
                const cities = movie.cities as Record<string, unknown[]> || {};
                for (const theatres of Object.values(cities)) {
                    if (!Array.isArray(theatres)) continue;
                    for (const theatre of theatres) {
                        const rooms = (theatre as Record<string, unknown>).rooms as unknown[] || [];
                        for (const room of rooms) {
                            const allShowtimes = (room as Record<string, unknown>).all_showtimes as unknown[];
                            if (Array.isArray(allShowtimes)) {
                                for (const showtime of allShowtimes) {
                                    totalSchedules++;
                                    // Count as available unless explicitly marked unavailable
                                    if ((showtime as Record<string, unknown>).is_available !== false) {
                                        availableSchedules++;
                                    }
                                }
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
                    availableSchedules,
                    coveragePercent: 0,
                    errorBreakdown: { auth: 0, closed: 0, other: 0 },
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
                // Phase-specific fields
                t30_found: (d.t30_found as number) || 0,
                t20_found: (d.t20_found as number) || 0,
                t10_found: (d.t10_found as number) || 0,
                t30_success: (d.t30_success as number) || 0,
                t20_success: (d.t20_success as number) || 0,
                t10_success: (d.t10_success as number) || 0,
                t30_error: (d.t30_error as number) || 0,
                t20_error: (d.t20_error as number) || 0,
                t10_error: (d.t10_error as number) || 0,
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
        const totalErrors = dispatchEntries.reduce((sum, [, entry]) => sum + (entry.total_errors || 0), 0);

        // Aggregate wave-specific stats
        const waveBreakdown = {
            t30: { found: 0, success: 0, error: 0, rate: 0 },
            t20: { found: 0, success: 0, error: 0, rate: 0 },
            t10: { found: 0, success: 0, error: 0, rate: 0 },
        };

        dispatchEntries.forEach(([, entry]) => {
            waveBreakdown.t30.found += entry.t30_found || 0;
            waveBreakdown.t30.success += entry.t30_success || 0;
            waveBreakdown.t30.error += entry.t30_error || 0;

            waveBreakdown.t20.found += entry.t20_found || 0;
            waveBreakdown.t20.success += entry.t20_success || 0;
            waveBreakdown.t20.error += entry.t20_error || 0;

            waveBreakdown.t10.found += entry.t10_found || 0;
            waveBreakdown.t10.success += entry.t10_success || 0;
            waveBreakdown.t10.error += entry.t10_error || 0;
        });

        // Calculate rates
        const calcRate = (success: number, found: number) => found > 0 ? Math.round((success / found) * 100) : 0;
        waveBreakdown.t30.rate = calcRate(waveBreakdown.t30.success, waveBreakdown.t30.found);
        waveBreakdown.t20.rate = calcRate(waveBreakdown.t20.success, waveBreakdown.t20.found);
        waveBreakdown.t10.rate = calcRate(waveBreakdown.t10.success, waveBreakdown.t10.found);

        // Aggregate error counts by HTTP status from errors subcollections
        const errorBreakdown = {
            auth: 0,      // 401 - token/auth issues (CRITICAL)
            closed: 0,    // 400 - seating closed/passed (expected)
            other: 0,     // Other errors (network, schema, etc.)
        };

        // Fetch errors from subcollections in PARALLEL for dispatches that have errors
        const errorFetchPromises = dispatchEntries
            .filter(([, entry]) => (entry.total_errors || 0) > 0)
            .map(async ([slot]) => {
                try {
                    const errors = await firestoreRestClient.getSubCollection(
                        `scraper_logs/${dateStr}/dispatches/${slot}/errors`
                    );
                    return errors.map(err => err.http_status as number);
                } catch {
                    return [];
                }
            });

        const allErrorStatuses = await Promise.all(errorFetchPromises);
        for (const statuses of allErrorStatuses) {
            for (const status of statuses) {
                if (status === 401) errorBreakdown.auth++;
                else if (status === 400) errorBreakdown.closed++;
                else errorBreakdown.other++;
            }
        }

        // Determine how many waves are active in this log (backward compatibility)
        let waveMultiplier = 1;
        if (waveBreakdown.t30.found > 0 || waveBreakdown.t20.found > 0 || waveBreakdown.t10.found > 0) {
            // Count distinct waves that have data
            waveMultiplier = (waveBreakdown.t30.found > 0 ? 1 : 0) + 
                             (waveBreakdown.t20.found > 0 ? 1 : 0) + 
                             (waveBreakdown.t10.found > 0 ? 1 : 0);
        } else if (totalShowtimesScraped > availableSchedules * 1.5) {
            // Fallback for older logs: if scraped > 1.5x schedules, it's likely a 3-wave run
            waveMultiplier = 3;
        }

        const jitSummary = {
            totalRuns: dispatchEntries.length,
            totalShowtimesFound: totalShowtimesScraped,
            totalJobsPublished: dispatchEntries.reduce((sum, [, entry]) => sum + (entry.jobs_published || 0), 0),
            totalErrors,
            totalSuccesses: dispatchEntries.reduce((sum, [, entry]) => sum + (entry.total_successes || 0), 0),
            errorCount: dispatchEntries.filter(([, entry]) => entry.status === 'error').length,
            firstDispatch: dispatchEntries.length > 0
                ? dispatchEntries.sort(([a], [b]) => a.localeCompare(b))[0]?.[0]?.replace('-', ':')
                : null,
            lastDispatch: dispatchEntries.length > 0
                ? dispatchEntries.sort(([a], [b]) => b.localeCompare(a))[0]?.[0]?.replace('-', ':')
                : null,
            // Schedule coverage metrics - use availableSchedules for accurate coverage
            totalSchedules,
            availableSchedules,
            waveMultiplier,
            coveragePercent: availableSchedules > 0 ? Math.round((totalShowtimesScraped / (availableSchedules * waveMultiplier)) * 100) : 0,
            // Error breakdown by type
            errorBreakdown,
            waveBreakdown,
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

