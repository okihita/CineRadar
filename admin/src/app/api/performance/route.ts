import { NextResponse } from 'next/server';
import { firestoreRestClient } from '@/lib/firestore-rest';
import { getTodayJakarta, isValidDateFormat } from '@/lib/timeUtils';
import { DiagnosticItem, MovieWithStats } from '@/features/performances/types/performance';
import { auth } from '@/auth';

export const dynamic = 'force-dynamic';
export const revalidate = 0; 

export async function GET(request: Request) {
    const session = await auth();
    if (!session) {
        return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    try {
        // Support ?date=YYYY-MM-DD query param (defaults to today in Jakarta time)
        const { searchParams } = new URL(request.url);
        const dateParam = searchParams.get('date');
        const targetDate = dateParam && isValidDateFormat(dateParam) ? dateParam : getTodayJakarta();

        // 1. DISCOVERY: Get active schedule registry
        const scheduleMoviesV2 = await firestoreRestClient.getSubCollection(`schedules_v2/${targetDate}/movies`, ['id', 'name']);
        const scheduledIds = new Set(scheduleMoviesV2.map(m => String(m.id)));

        // 2. DISCOVERY: Get historical performance context
        const recentPerfDocs = await firestoreRestClient.getCollectionWithQuery('movie_performance_v2', 'last_swept_at', 100);
        const performanceIds = new Set((recentPerfDocs as Array<{ id: string }>).map(d => d.id));

        // Combine for a master audit list
        const masterAuditIds = new Set([...scheduledIds, ...performanceIds]);
        
        const diagnostic: DiagnosticItem[] = [];
        const validMovies: MovieWithStats[] = [];

        // ENRICHMENT PHASE
        await Promise.all(
            Array.from(masterAuditIds).map(async (id) => {
                try {
                    const [metadata, todayStats, scheduleV2] = await Promise.all([
                        firestoreRestClient.getDocument('movies', id),
                        firestoreRestClient.getDocument(`movie_performance_v2/${id}/days`, targetDate),
                        firestoreRestClient.getDocument(`schedules_v2/${targetDate}/movies`, id)
                    ]);

                    const hasMetadata = !!(metadata && (metadata.name || metadata.title));
                    const hasPerformance = !!todayStats;
                    const hasSchedule = scheduledIds.has(id);

                    // Calculate accurate showtimes count
                    let totalShowtimes = (todayStats?.total_showtimes as number) || 0;
                    if (scheduleV2 && scheduleV2.cities) {
                        const scheduledCount = Object.values(scheduleV2.cities as Record<string, unknown[]>)
                            .flat()
                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                            .reduce((sum: number, theatre: any) => {
                                const t = theatre as { rooms?: Array<{ all_showtimes?: unknown[] }> };
                                return sum + (t.rooms || []).reduce((roomSum: number, room) => {
                                    return roomSum + (room.all_showtimes?.length || 0);
                                }, 0);
                            }, 0);
                        totalShowtimes = Math.max(totalShowtimes, scheduledCount as number);
                    }

                    // Add to diagnostic list
                    diagnostic.push({
                        id,
                        title: (metadata?.name || metadata?.title || scheduleMoviesV2.find(m => m.id === id)?.name || `Unknown ID: ${id}`) as string,
                        has_metadata: hasMetadata,
                        has_performance: hasPerformance,
                        has_schedule: hasSchedule,
                        showtimes_count: totalShowtimes
                    });

                    // UI INTEGRITY: Only add to active dashboard if we have metadata AND active showtimes
                    if (hasMetadata && totalShowtimes > 0) {
                        validMovies.push({
                            id,
                            movie_id: id,
                            title: (metadata.name || metadata.title) as string,
                            poster: (metadata.poster || metadata.poster_path) as string || '',
                            last_updated: (todayStats?.last_updated as string) || (metadata.scraped_at as string) || '',
                            today: {
                                date: (todayStats?.date as string) || targetDate,
                                total_showtimes: totalShowtimes,
                                total_showtimes_scraped: (todayStats?.total_showtimes_scraped as number) || 0,
                                avg_occupancy_pct: (todayStats?.avg_occupancy_pct as number) || 0,
                                total_seats: (todayStats?.total_seats as number) || 0,
                                total_sold: (todayStats?.total_sold as number) || 0,
                                cities: (todayStats?.cities as string[]) || Object.keys(scheduleV2?.cities || {}),
                            },
                        });
                    }
                } catch (err) {
                    console.error(`[API] Error auditing movie ${id}:`, err);
                }
            })
        );

        // Deterministic sort: by audience → showtimes → title
        validMovies.sort((a, b) => {
            const soldA = a.today?.total_sold || 0;
            const soldB = b.today?.total_sold || 0;
            if (soldB !== soldA) return soldB - soldA;
            const showsA = a.today?.total_showtimes || 0;
            const showsB = b.today?.total_showtimes || 0;
            if (showsB !== showsA) return showsB - showsA;
            return a.title.localeCompare(b.title);
        });

        // Deterministic sort for the diagnostic audit
        diagnostic.sort((a, b) => a.title.localeCompare(b.title));

        return NextResponse.json({
            success: true,
            data: {
                date: targetDate,
                movies: validMovies,
                diagnostic: {
                    total_discovered: masterAuditIds.size,
                    active_count: validMovies.length,
                    scheduled_count: scheduledIds.size,
                    items: diagnostic
                }
            }
        });
    } catch (error) {
        console.error('Error in /api/performance (Diagnostic):', error);
        return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
    }
}
