/**
 * Movie Performance API
 * 
 * GET /api/performance
 *   → List all movies with performance data + today's stats
 */
import { NextResponse } from 'next/server';
import { firestoreAdminClient } from '@/lib/firebase-admin';

// Get today's date in Jakarta timezone (YYYY-MM-DD)
function getTodayJakarta(): string {
    return new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Jakarta' });
}

interface MovieWithStats {
    id: string;
    movie_id: string;
    title: string;
    poster: string;
    last_updated: string;
    today?: {
        date: string;
        total_showtimes: number;
        avg_occupancy_pct: number;
        total_seats: number;
        total_sold: number;
        cities: string[];
    };
}

export async function GET() {
    try {
        const today = getTodayJakarta();

        // Get all movie metadata (Root Collection)
        const movies = await firestoreAdminClient.getCollectionWithQuery(
            'movie_performance',
            'last_updated',
            100
        ) as MovieWithStats[];

        // Fetch today's stats for each movie in parallel
        const moviesWithStats = await Promise.all(
            movies.map(async (movie) => {
                try {
                    const days = await firestoreAdminClient.getSubCollection(
                        `movie_performance/${movie.id}/days`
                    );
                    // Find today's stats
                    const todayStats = days.find((d) => d.date === today);
                    return {
                        ...movie,
                        today: todayStats ? {
                            date: todayStats.date as string,
                            total_showtimes: (todayStats.total_showtimes as number) || 0,
                            avg_occupancy_pct: (todayStats.avg_occupancy_pct as number) || 0,
                            total_seats: (todayStats.total_seats as number) || 0,
                            total_sold: (todayStats.total_sold as number) || 0,
                            cities: (todayStats.cities as string[]) || [],
                        } : undefined,
                    };
                } catch {
                    return movie; // Return without today's stats on error
                }
            })
        );

        return NextResponse.json({
            success: true,
            date: today,
            count: moviesWithStats.length,
            movies: moviesWithStats
        });
    } catch (error) {
        console.error('Error fetching movie performance:', error);
        return NextResponse.json(
            { success: false, error: String(error) },
            { status: 500 }
        );
    }
}
