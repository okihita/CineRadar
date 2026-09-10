import { NextResponse } from 'next/server';
import { firestoreRestClient } from '@/lib/firestore-rest';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const collection = searchParams.get('collection') || 'tiktok_daily_pulse';
    const date = searchParams.get('date') || new Date().toISOString().split('T')[0];
    const docId = searchParams.get('doc_id');
    const movieId = searchParams.get('movie_id');

    try {
        if (collection === 'tiktok_daily_pulse') {
            if (movieId) {
                const movieDoc = await firestoreRestClient.getDocument<Record<string, unknown>>(
                    `tiktok_daily_pulse/${date}/movies`,
                    movieId
                );
                return NextResponse.json({
                    success: true,
                    collection,
                    path: `tiktok_daily_pulse/${date}/movies/${movieId}`,
                    data: movieDoc || null,
                });
            }

            const dailyDoc = await firestoreRestClient.getDocument<Record<string, unknown>>(
                'tiktok_daily_pulse',
                date
            );
            return NextResponse.json({
                success: true,
                collection,
                path: `tiktok_daily_pulse/${date}`,
                data: dailyDoc || null,
            });
        }

        if (collection === 'tiktok_hashtag_discovery') {
            const targetDocId = docId || date;
            const doc = await firestoreRestClient.getDocument<Record<string, unknown>>(
                'tiktok_hashtag_discovery',
                targetDocId
            );
            return NextResponse.json({
                success: true,
                collection,
                path: `tiktok_hashtag_discovery/${targetDocId}`,
                data: doc || null,
            });
        }

        if (collection === 'tiktok_sources') {
            const doc = await firestoreRestClient.getDocument<Record<string, unknown>>(
                'tiktok_sources',
                'config'
            );
            return NextResponse.json({
                success: true,
                collection,
                path: 'tiktok_sources/config',
                data: doc || null,
            });
        }

        if (collection === 'tiktok_movie_trends') {
            if (movieId) {
                const doc = await firestoreRestClient.getDocument<Record<string, unknown>>(
                    'tiktok_movie_trends',
                    movieId
                );
                return NextResponse.json({
                    success: true,
                    collection,
                    path: `tiktok_movie_trends/${movieId}`,
                    data: doc || null,
                });
            }
            return NextResponse.json({
                success: true,
                collection,
                path: 'tiktok_movie_trends',
                message: 'Specify movie_id parameter to inspect movie trends',
                data: null,
            });
        }

        if (collection === 'tiktok_exhibitor_archive') {
            const limitCount = parseInt(searchParams.get('limit') || '50', 10);
            const posts = await firestoreRestClient.getCollectionWithQuery<Record<string, unknown>>(
                'tiktok_exhibitor_archive',
                'scraped_at',
                limitCount
            );
            return NextResponse.json({
                success: true,
                collection,
                path: 'tiktok_exhibitor_archive',
                total_documents: posts.length,
                data: posts,
            });
        }

        return NextResponse.json({
            success: false,
            message: `Unsupported collection: ${collection}`,
        }, { status: 400 });
    } catch (err: unknown) {
        return NextResponse.json({
            success: false,
            error: err instanceof Error ? err.message : 'Failed to fetch raw Firestore data',
        }, { status: 500 });
    }
}
