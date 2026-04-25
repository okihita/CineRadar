import { NextResponse } from 'next/server';
import { firestoreRestClient } from '@/lib/firestore-rest';

// Get today's date in Jakarta timezone (YYYY-MM-DD)
function getTodayJakarta(): string {
    return new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Jakarta' });
}

interface MovieWithStats {
    id: string; // metadata_id
    movie_id: string; // schedule_id / movie_id
    title: string;
    poster: string;
    last_updated: string;
    today?: {
        date: string;
        total_showtimes: number;
        total_showtimes_scraped: number;
        avg_occupancy_pct: number;
        total_seats: number;
        total_sold: number;
        cities: string[];
    };
}

interface DiagnosticEntry {
    id: string;
    title: string;
    has_metadata: boolean;
    has_performance: boolean;
    has_schedule: boolean;
    showtimes_count: number;
}

export const dynamic = 'force-dynamic';
export const revalidate = 0; 

export async function GET() {
    try {
        const today = getTodayJakarta();

        // 1. DISCOVERY: Get active schedule registry
        const scheduleMoviesV2 = await firestoreRestClient.getSubCollection(`schedules_v2/${today}/movies`, ['id', 'name']);
        const scheduledIds = new Set(scheduleMoviesV2.map(m => String(m.id)));

        // 2. DISCOVERY: Get historical performance context
        const recentPerfDocs = await firestoreRestClient.getCollectionWithQuery('movie_performance_v2', 'last_swept_at', 100);
        const performanceIds = new Set((recentPerfDocs as Array<{ id: string }>).map(d => d.id));

        // Combine for a master audit list
        const masterAuditIds = new Set([...scheduledIds, ...performanceIds]);
        
        const diagnostic: DiagnosticEntry[] = [];
        const validMovies: MovieWithStats[] = [];

        // ENRICHMENT PHASE
        await Promise.all(
            Array.from(masterAuditIds).map(async (id) => {
                try {
                    const [metadata, todayStats, scheduleV2] = await Promise.all([
                        firestoreRestClient.getDocument('movies', id),
                        firestoreRestClient.getDocument(`movie_performance_v2/${id}/days`, today),
                        firestoreRestClient.getDocument(`schedules_v2/${today}/movies`, id)
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
                                date: (todayStats?.date as string) || today,
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

        // Deterministic sort for the UI
        validMovies.sort((a, b) => {
            const soldA = a.today?.total_sold || 0;
            const soldB = b.today?.total_sold || 0;
            if (soldB !== soldA) return soldB - soldA;
            return a.title.localeCompare(b.title);
        });

        // Deterministic sort for the diagnostic audit
        diagnostic.sort((a, b) => a.title.localeCompare(b.title));

        return NextResponse.json({
            success: true,
            data: {
                date: today,
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
