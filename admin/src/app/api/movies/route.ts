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

        // 1. Preload root `movies` metadata collection to build a Schedule ID -> Metadata ID lookup map.
        // This is necessary because historical V1 documents in `schedules` and `movie_performance` 
        // lack a `tix_metadata_id` field, causing the frontend UI to build broken links.
        const rootMovies = await firestoreRestClient.getCollectionWithQuery(
            'movies',
            'release_date',
            300 // fetch enough history to resolve
        );
        const scheduleToMetadataMap = new Map();
        for (const rm of rootMovies) {
            // inside root movies schema: `rm.id` is the schedule ID, `rm.movie_id` is the metadata ID
            if (rm.id && rm.movie_id) {
                scheduleToMetadataMap.set(String(rm.id), String(rm.movie_id));
            }
        }

        // 2. Get today's schedule movies
        const schedulePath = `schedules/${today}/movies`;
        const scheduleMovies = await firestoreRestClient.getSubCollection(schedulePath);

        // 3. Get all movies from movie_performance (for past movies)
        const performanceMovies = await firestoreRestClient.getCollectionWithQuery(
            'movie_performance',
            'last_updated',
            200
        );

        // 4. Build a set of movie_ids currently showing (these are schedule IDs historically)
        const nowShowingIds = new Set(
            scheduleMovies.map((m) => String(m.id || m.movie_id))
        );

        // 5. Past movies = in movie_performance but NOT in today's schedules
        const pastMovies = performanceMovies.filter(
            (m) => !nowShowingIds.has(String(m.id || m.movie_id))
        );

        // 6. Enrich all records with the true metadata ID from the root collection lookup
        for (const m of scheduleMovies) {
            if (!m.tix_metadata_id) {
                const schedId = String(m.id || m.movie_id);
                m.tix_metadata_id = scheduleToMetadataMap.get(schedId) || schedId;
            }
        }
        for (const m of pastMovies) {
            if (!m.tix_metadata_id) {
                const schedId = String(m.id || m.movie_id);
                m.tix_metadata_id = scheduleToMetadataMap.get(schedId) || schedId;
            }
        }

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
