/**
 * GET /api/social-feed/sources
 *
 * Returns all sources from beta_social_sources.
 * Used by the backfill panel to show which accounts will be scraped.
 */

import { NextResponse } from 'next/server';
import { firestoreRestClient } from '@/lib/firestore-rest';
import { COLLECTIONS, type FirestoreSocialSource } from '@/lib/firestore-social';

export async function GET() {
    try {
        const sources = await firestoreRestClient.getCollection<FirestoreSocialSource>(
            COLLECTIONS.SOURCES,
            ['display_name', 'category', 'avatar_url', 'handle', 'active', 'platform', 'metadata'],
        );

        return NextResponse.json({
            success: true,
            data: {
                sources: sources.map(s => ({
                    id: s.id,
                    display_name: s.display_name,
                    category: s.category,
                    avatar_url: s.avatar_url,
                    handle: s.handle,
                    active: s.active,
                    platform: s.platform,
                    subscriber_count: s.metadata?.subscriber_count || 0,
                })),
            },
        });
    } catch (error) {
        console.error('[Sources Load Error]', error);
        return NextResponse.json(
            { success: false, error: 'Failed to load sources' },
            { status: 500 },
        );
    }
}
