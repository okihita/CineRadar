/**
 * Movie Performance Detail API
 * 
 * GET /api/performance/[metadataId]
 *   → Get specific movie with aggregate stats from V2
 */
import { NextRequest, NextResponse } from 'next/server';
import { firestoreRestClient } from '@/lib/firestore-rest';
import { MarketingMetadata } from '@/features/performances/types/social';
import { buildMovieSummary } from '@/features/performances/utils/movie-mapping';

export const revalidate = 300; // Cache for 5 minutes

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ metadataId: string }> }
) {
    try {
        const { metadataId } = await params;

        // 1. Get Movie Performance Doc (Root V2)
        const perfDoc = await firestoreRestClient.getDocument('movie_performance_v2', metadataId);

        // 2. Get Movie Metadata from `movies`
        const metadata = await firestoreRestClient.getDocument('movies', metadataId);

        if (!metadata) {
            return NextResponse.json(
                { success: false, error: 'Movie metadata not found' },
                { status: 404 }
            );
        }

        // Merge results
        const summary = buildMovieSummary(metadata, perfDoc, metadataId);

        return NextResponse.json({
            success: true,
            data: { summary }
        });
    } catch (error) {
        console.error('Error fetching movie performance V2 detail:', error);
        return NextResponse.json(
            { success: false, error: String(error) },
            { status: 500 }
        );
    }
}

/**
 * PATCH /api/performance/[metadataId]
 * Update movie document with partial data (e.g., marketing metadata)
 *
 * Request body: { marketing: MarketingMetadata }
 */
export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ metadataId: string }> }
) {
    try {
        const { metadataId } = await params;
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
            
            // Basic validation for primary hashtag
            if (!marketing.primary_hashtag || typeof marketing.primary_hashtag !== 'string') {
                return NextResponse.json(
                    { success: false, error: 'Primary hashtag is required' },
                    { status: 400 }
                );
            }

            // Clean up undefined values from official_accounts
            if (marketing.official_accounts) {
                const cleanedAccounts: Record<string, string> = {};
                for (const [platform, handle] of Object.entries(marketing.official_accounts)) {
                    if (handle && typeof handle === 'string' && handle.trim()) {
                        cleanedAccounts[platform] = (handle as string).replace(/^@/, '').trim();
                    }
                }
                updateData.marketing = {
                    ...marketing,
                    official_accounts: cleanedAccounts,
                };
            }
        }

        // Update the document in movie_performance_v2
        console.log('[PATCH marketing] updateData:', JSON.stringify(updateData, null, 2));
        const success = await firestoreRestClient.updateDocument(
            'movie_performance_v2',
            metadataId,
            updateData
        );

        if (!success) {
            return NextResponse.json(
                { success: false, error: 'Failed to update movie performance V2' },
                { status: 500 }
            );
        }

        return NextResponse.json({
            success: true,
            data: {
                message: 'Movie performance V2 updated successfully',
                updatedFields: Object.keys(updateData),
            }
        });
    } catch (error) {
        console.error('Error updating movie performance V2:', error);
        return NextResponse.json(
            { success: false, error: String(error) },
            { status: 500 }
        );
    }
}
