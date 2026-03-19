/**
 * Movie Performance V2 Detail API
 * 
 * GET /api/performance_v2/[metadataId]
 *   → Get specific movie with aggregate stats from V2
 */
import { NextRequest, NextResponse } from 'next/server';
import { firestoreRestClient } from '@/lib/firestore-rest';
import { MarketingMetadata } from '@/features/performances_v2/types/social';

export const revalidate = 300; // Cache for 5 minutes

/**
 * Formats genres or age_category into a string.
 * Handles strings, arrays of strings, and arrays of objects { name: string }.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function formatMetadataField(field: any): string {
    if (!field) return '';
    if (typeof field === 'string') return field;
    if (Array.isArray(field)) {
        return field
            .map((item) => {
                if (typeof item === 'string') return item;
                if (item && typeof item === 'object' && 'name' in item) return item.name;
                return '';
            })
            .filter(Boolean)
            .join(', ');
    }
    if (typeof field === 'object' && 'name' in field) return field.name;
    return String(field);
}

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ metadataId: string }> }
) {
    try {
        const { metadataId } = await params;

        // 1. Get Movie Performance Doc (Root V2)
        const perfDoc = await firestoreRestClient.getDocument('movie_performance_v2', metadataId);

        if (!perfDoc) {
            return NextResponse.json(
                { success: false, error: 'Movie performance not found' },
                { status: 404 }
            );
        }

        // 2. Get Movie Metadata from `movies`
        const metadata = await firestoreRestClient.getDocument('movies', metadataId);

        if (!metadata) {
            return NextResponse.json(
                { success: false, error: 'Movie metadata not found' },
                { status: 404 }
            );
        }

        // Merge results
        const summary = {
            ...perfDoc,
            id: metadataId,
            movie_id: metadataId, // For compatibility
            title: (metadata.name as string) || `ID: ${metadataId}`,
            poster: (metadata.poster as string) || (metadata.poster_path as string) || '',
            genres: formatMetadataField(metadata.genres),
            age_category: formatMetadataField(metadata.age_category),
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            last_updated: (perfDoc as any).last_swept_at || '',
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            marketing: (perfDoc as any).marketing || undefined,
        };

        return NextResponse.json({
            success: true,
            summary
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
 * PATCH /api/performance_v2/[metadataId]
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
            message: 'Movie performance V2 updated successfully',
            updatedFields: Object.keys(updateData),
        });
    } catch (error) {
        console.error('Error updating movie performance V2:', error);
        return NextResponse.json(
            { success: false, error: String(error) },
            { status: 500 }
        );
    }
}
