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

export const dynamic = 'force-dynamic';
export const revalidate = 300; // Cache for 5 minutes (300 seconds)

export async function GET() {
    try {
        const today = getTodayJakarta();

        // 1. Get all performance metadata documents (Root Collection - V2)
        // Optimized: Only get the top 60 most recently updated movies
        const performanceDocs = (await firestoreRestClient.getCollectionWithQuery(
            'movie_performance_v2',
            'last_swept_at', 
            60
        )) as unknown as Array<{ id: string; last_swept_at?: string }>;

        if (!performanceDocs || performanceDocs.length === 0) {
            return NextResponse.json({ success: true, date: today, movies: [] });
        }

        // 2. Fetch metadata and daily stats in parallel for ALL found movies
        // We avoid batching here to maximize concurrency for the small doc set (~40-60 movies)
        const moviesWithStats = await Promise.all(
            performanceDocs.map(async (perfDoc) => {
                try {
                    // Fetch Movie Metadata AND Today's Stats in parallel
                    const [metadata, todayStats] = await Promise.all([
                        firestoreRestClient.getDocument('movies', perfDoc.id),
                        firestoreRestClient.getDocument(`movie_performance_v2/${perfDoc.id}/days`, today)
                    ]);

                    // Fallback to basic info if today stats aren't initialized yet
                    // But we no longer fetch schedules_v2 here as it's too slow for a list view
                    
                    return {
                        id: perfDoc.id,
                        movie_id: perfDoc.id,
                        title: metadata?.name || metadata?.title || `ID: ${perfDoc.id}`,
                        poster: metadata?.poster || metadata?.poster_path || '',
                        last_updated: perfDoc.last_swept_at || '',
                        today: todayStats ? {
                            date: todayStats.date || today,
                            total_showtimes: todayStats.total_showtimes || 0,
                            total_showtimes_scraped: todayStats.total_showtimes_scraped || 0,
                            avg_occupancy_pct: todayStats.avg_occupancy_pct || 0,
                            total_seats: todayStats.total_seats || 0,
                            total_sold: todayStats.total_sold || 0,
                            cities: todayStats.cities || [],
                        } : undefined,
                    };
                } catch (err) {
                    console.error(`[API] Error fetching data for movie ${perfDoc.id}:`, err);
                    return null;
                }
            })
        );

        // Filter out any failed fetches
        const validMovies = moviesWithStats.filter(m => m !== null) as MovieWithStats[];

        // 3. Return response with caching headers
        const response = NextResponse.json({
            success: true,
            date: today,
            count: validMovies.length,
            movies: validMovies
        });

        // Set cache control for 5 minutes
        response.headers.set('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');

        return response;
    } catch (error) {
        console.error('Error in /api/performance:', error);
        return NextResponse.json(
            { success: false, error: String(error) },
            { status: 500 }
        );
    }
}
