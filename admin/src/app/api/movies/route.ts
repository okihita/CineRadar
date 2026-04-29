/**
 * Movie Database API - Unified List
 *
 * GET /api/movies
 *   → Returns all movies from the master root `movies` collection.
 *   → Flags movies as "showing today" based on existence in `schedules_v2`.
 */
import { NextResponse } from 'next/server';
import { firestoreRestClient } from '@/lib/firestore-rest';
import { getTodayJakarta } from '@/lib/timeUtils';
import type { FirestoreMovie } from '@/features/movies/types';

export async function GET() {
    try {
        const today = getTodayJakarta();

        // 1. Fetch all movies from the master root collection with field masking for performance.
        const allMovies = (await firestoreRestClient.getCollection('movies', [
            'movie_id',
            'id',
            'name',
            'title',
            'poster_path',
            'scraped_at',
            'release_date',
            'age_category',
            'rating_score',
            'genres'
        ])) as FirestoreMovie[];

        // 2. Fetch today's Metadata IDs from schedules_v2 to determine "Now Showing" status.
        const scheduleV2Path = `schedules_v2/${today}/movies`;
        const scheduleMoviesV2 = await firestoreRestClient.getSubCollection(scheduleV2Path, ['id']);
        const showingMetadataIds = new Set(scheduleMoviesV2.map(m => String(m.id)));

        // 3. Map into the UnifiedMovie format expected by the UI
        const unifiedMovies = allMovies.map((m) => {
            const metadataId = String(m.movie_id || ''); 
            const isShowingToday = showingMetadataIds.has(metadataId);
            const ratingData = m.rating_score;
            
            // Map genre objects to simple string array
            const genres = m.genres?.map((g) => g.name) || [];

            return {
                id: metadataId,                               
                movie_id: (m.id as string),     
                tix_metadata_id: metadataId,
                title: (m.name as string) || (m.title as string) || `ID: ${metadataId}`,
                poster: (m.poster_path as string) || '',
                is_showing_today: isShowingToday,
                last_updated: (m.scraped_at as string) || '',
                release_date: m.release_date || 0,
                age_category: (m.age_category as string) || '',
                genres: genres,
                rating: ratingData ? {
                    average: ratingData.vote_average || 0,
                    count: ratingData.vote_count || 0
                } : undefined
            };
        });

        // Sort by LIVE status first, then by date DESC
        unifiedMovies.sort((a, b) => {
            if (a.is_showing_today !== b.is_showing_today) {
                return a.is_showing_today ? -1 : 1;
            }
            return (b.last_updated || '').localeCompare(a.last_updated || '');
        });

        return NextResponse.json({
            success: true,
            date: today,
            movies: unifiedMovies
        });
    } catch (error) {
        console.error('Error fetching unified movie database:', error);
        return NextResponse.json(
            { success: false, error: String(error) },
            { status: 500 }
        );
    }
}
