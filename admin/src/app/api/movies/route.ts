/**
 * Movie Database API - List
 *
 * GET /api/movies
 *   → Returns "now showing" movies from today's schedules
 *     AND "past movies" from movie_performance that aren't showing today
 */
import { NextResponse } from 'next/server';
import { firestoreRestClient } from '@/lib/firestore-rest';

function getTodayJakarta(): string {
    return new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Jakarta' });
}

export async function GET() {
    try {
        const today = getTodayJakarta();

        // 1. Get today's schedule movies
        const schedulePath = `schedules/${today}/movies`;
        const scheduleMovies = await firestoreRestClient.getSubCollection(schedulePath);

        // 2. Get all movies from movie_performance (for past movies)
        const performanceMovies = await firestoreRestClient.getCollectionWithQuery(
            'movie_performance',
            'last_updated',
            200
        );

        // 3. Build a set of movie_ids currently showing
        const nowShowingIds = new Set(
            scheduleMovies.map((m) => String(m.movie_id))
        );

        // 4. Past movies = in movie_performance but NOT in today's schedules
        const pastMovies = performanceMovies.filter(
            (m) => !nowShowingIds.has(String(m.movie_id))
        );

        return NextResponse.json({
            success: true,
            date: today,
            now_showing: scheduleMovies,
            past_movies: pastMovies,
        });
    } catch (error) {
        console.error('Error fetching movie database:', error);
        return NextResponse.json(
            { success: false, error: String(error) },
            { status: 500 }
        );
    }
}
