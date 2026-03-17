/**
 * Movie Performance Detail API
 *
 * GET /api/performance/[movieId]
 *   → Get specific movie with all showtime snapshots
 *
 * PATCH /api/performance/[movieId]
 *   → Update movie fields (e.g., marketing metadata)
 */
import { NextRequest, NextResponse } from 'next/server';
import { firestoreRestClient } from '@/lib/firestore-rest';
import { MarketingMetadata } from '@/features/performances/types/social';

export const revalidate = 300; // Cache for 5 minutes

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ movieId: string }> }
) {
    try {
        const { movieId } = await params;

        // Get movie summary
        const summaryDoc = await firestoreRestClient.getDocument('movie_performance', movieId);

        if (!summaryDoc) {
            return NextResponse.json(
                { success: false, error: 'Movie not found' },
                { status: 404 }
            );
        }

        const summary = summaryDoc;

        // Get all showtime snapshots for this movie
        let showtimes = await firestoreRestClient.getSubCollection(
            `movie_performance/${movieId}/showtimes`
        );

        // Sort showtimes by 'showtime' field ascending since REST client doesn't sort by default in getSubCollection
        showtimes = showtimes.sort((a, b) => {
            const timeA = (a.showtime as string) || '';
            const timeB = (b.showtime as string) || '';
            return timeA.localeCompare(timeB);
        });

        return NextResponse.json({
            success: true,
            summary,
            showtimes,
            showtimes_count: showtimes.length
        });
    } catch (error) {
        console.error('Error fetching movie performance detail:', error);
        return NextResponse.json(
            { success: false, error: String(error) },
            { status: 500 }
        );
    }
}

/**
 * PATCH /api/performance/[movieId]
 * Update movie document with partial data (e.g., marketing metadata)
 *
 * Request body: { marketing: MarketingMetadata }
 */
export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ movieId: string }> }
) {
    try {
        const { movieId } = await params;
        const body = await request.json();

        // Validate request body
        if (!body || typeof body !== 'object') {
            return NextResponse.json(
                { success: false, error: 'Invalid request body' },
                { status: 400 }
            );
        }

        // Only allow updating specific fields
        const allowedFields = ['marketing'];
        const updateData: Record<string, unknown> = {};

        for (const field of allowedFields) {
            if (field in body) {
                updateData[field] = body[field];
            }
        }

        if (Object.keys(updateData).length === 0) {
            return NextResponse.json(
                { success: false, error: 'No valid fields to update' },
                { status: 400 }
            );
        }

        // Validate marketing metadata if provided
        if (updateData.marketing) {
            const marketing = updateData.marketing as MarketingMetadata;
            
            // Validate primary hashtag
            if (!marketing.primary_hashtag || typeof marketing.primary_hashtag !== 'string') {
                return NextResponse.json(
                    { success: false, error: 'Primary hashtag is required' },
                    { status: 400 }
                );
            }

            // Validate secondary hashtags (max 5)
            if (marketing.secondary_hashtags && marketing.secondary_hashtags.length > 5) {
                return NextResponse.json(
                    { success: false, error: 'Maximum 5 secondary hashtags allowed' },
                    { status: 400 }
                );
            }

            // Clean up undefined values from official_accounts (create new object to avoid mutation)
            if (marketing.official_accounts) {
                const cleanedAccounts: Record<string, string> = {};
                for (const [platform, handle] of Object.entries(marketing.official_accounts)) {
                    if (handle && typeof handle === 'string' && handle.trim()) {
                        cleanedAccounts[platform] = handle.replace(/^@/, '').trim();
                    }
                }
                updateData.marketing = {
                    ...marketing,
                    official_accounts: cleanedAccounts,
                };
            }
        }

        // Update the document
        const success = await firestoreRestClient.updateDocument(
            'movie_performance',
            movieId,
            updateData
        );

        if (!success) {
            return NextResponse.json(
                { success: false, error: 'Failed to update movie' },
                { status: 500 }
            );
        }

        return NextResponse.json({
            success: true,
            message: 'Movie updated successfully',
            updatedFields: Object.keys(updateData),
        });
    } catch (error) {
        console.error('Error updating movie:', error);
        return NextResponse.json(
            { success: false, error: String(error) },
            { status: 500 }
        );
    }
}
