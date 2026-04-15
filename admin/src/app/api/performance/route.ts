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

export async function GET() {
    try {
        const today = getTodayJakarta();

        // Get all performance metadata documents (Root Collection - V2)
        const performanceDocs = (await firestoreRestClient.getCollectionWithQuery(
            'movie_performance_v2',
            'last_swept_at', // Wait, earlier it was last_updated. Looking at sweeper, it sets last_swept_at
            100
        )) as unknown as MovieWithStats[];

        // Wait, if movie_performance_v2 only contains ['total_sold', 'total_seats', 'last_swept_at'] it doesn't have title/poster.
        // We must fetch from the `movies` collection using the ID (metadata_id).

        // Fetch today's stats AND movie metadata for each performance doc in batches to avoid overwhelming Firestore
        const BATCH_SIZE = 20;
        const moviesWithStats: MovieWithStats[] = [];

        for (let i = 0; i < performanceDocs.length; i += BATCH_SIZE) {
            const batch = performanceDocs.slice(i, i + BATCH_SIZE);
            const results = await Promise.all(
                batch.map(async (perfDoc) => {
                    try {
                        // 1. Fetch Movie Metadata from `movies` collection
                        const metadata = await firestoreRestClient.getDocument('movies', perfDoc.id);
                        
                        if (!metadata) {
                            console.warn(`[API] Metadata not found for movie ID: ${perfDoc.id}`);
                        }

                        // 2. Fetch Today's Stats from `days` subcollection
                        const todayStats = await firestoreRestClient.getDocument(
                            `movie_performance_v2/${perfDoc.id}/days`,
                            today
                        );

                        // 3. Fetch from schedules_v2 for "Showtimes Today" (Source of Truth for initial scheduling)
                        const scheduleV2 = await firestoreRestClient.getDocument(
                            `schedules_v2/${today}/movies`,
                            perfDoc.id
                        );

                        let totalShowtimes = (todayStats?.total_showtimes as number) || 0;

                        // If we have a schedule_v2 doc, calculate showtimes from the cities map
                        if (scheduleV2 && scheduleV2.cities) {
                            let count = 0;
                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                            const citiesMap = scheduleV2.cities as Record<string, any[]>;
                            Object.values(citiesMap).forEach((theatres) => {
                                theatres.forEach((theatre) => {
                                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                    (theatre.rooms || []).forEach((room: any) => {
                                        count += (room.all_showtimes?.length || 0);
                                    });
                                });
                            });
                            totalShowtimes = count;
                        }

                        return {
                            ...perfDoc, // Includes total_sold, etc.
                            id: perfDoc.id,
                            movie_id: perfDoc.id, // For compatibility with V1 components expecting movie_id
                            title: metadata?.name ? (metadata.name as string) : `ID: ${perfDoc.id}`,
                            poster: metadata?.poster ? (metadata.poster as string) : (metadata?.poster_path ? (metadata.poster_path as string) : ''),
                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                            last_updated: (perfDoc as any).last_swept_at || '',
                            today: todayStats || scheduleV2 ? {
                                date: (todayStats?.date as string) || today,
                                total_showtimes: totalShowtimes,
                                total_showtimes_scraped: (todayStats?.total_showtimes_scraped as number) || 0,
                                avg_occupancy_pct: (todayStats?.avg_occupancy_pct as number) || 0,
                                total_seats: (todayStats?.total_seats as number) || 0,
                                total_sold: (todayStats?.total_sold as number) || 0,
                                cities: (todayStats?.cities as string[]) || Object.keys(scheduleV2?.cities || {}),
                            } : undefined,
                        };
                    } catch (err) {
                        console.error(`Error fetching data for ${perfDoc.id}:`, err);
                        return null;
                    }
                })
            );
            
            // Filter out nulls
            moviesWithStats.push(...(results.filter(r => r !== null) as MovieWithStats[]));
        }

        return NextResponse.json({
            success: true,
            date: today,
            count: moviesWithStats.length,
            movies: moviesWithStats
        });
    } catch (error) {
        console.error('Error fetching movie performance V2:', error);
        return NextResponse.json(
            { success: false, error: String(error) },
            { status: 500 }
        );
    }
}
