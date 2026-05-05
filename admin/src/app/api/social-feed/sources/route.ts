/**
 * GET  /api/social-feed/sources       — list all sources (public)
 * POST /api/social-feed/sources       — create a source (admin-only)
 * PATCH /api/social-feed/sources      — update a source (admin-only)
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { firestoreRestClient } from '@/lib/firestore-rest';
import { COLLECTIONS, SOURCE_CATEGORIES, SOURCE_CATEGORY_ORDER, type FirestoreSocialSource, type Platform, type SourceCategory } from '@/lib/firestore-social';
import { isAdmin } from '@/lib/auth-helpers';

const VALID_PLATFORMS: Platform[] = ['youtube', 'twitter', 'instagram', 'tiktok', 'web'];
const VALID_CATEGORIES: SourceCategory[] = SOURCE_CATEGORIES.map(c => c.value);

export async function GET() {
    try {
        const sources = await firestoreRestClient.getCollection<FirestoreSocialSource>(
            COLLECTIONS.SOURCES,
        );

        // Sort: active first, then by category, then by display_name
        sources.sort((a, b) => {
            if (a.active !== b.active) return a.active ? -1 : 1;
            const ca = SOURCE_CATEGORY_ORDER[a.category] ?? 9;
            const cb = SOURCE_CATEGORY_ORDER[b.category] ?? 9;
            if (ca !== cb) return ca - cb;
            return a.display_name.localeCompare(b.display_name);
        });

        return NextResponse.json({
            success: true,
            data: {
                sources: sources.map(s => ({
                    id: s.id,
                    platform: s.platform,
                    display_name: s.display_name,
                    handle: s.handle,
                    category: s.category,
                    verified: s.verified,
                    avatar_url: s.avatar_url,
                    url: s.url,
                    active: s.active,
                    notes: s.notes,
                    sort_order: s.sort_order ?? 0,
                    subscriber_count: s.metadata?.subscriber_count || 0,
                    frequency: s.fetch_config?.frequency || 'daily',
                    added_at: s.added_at,
                    last_fetched_at: s.last_fetched_at,
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

export async function POST(request: NextRequest) {
    const session = await auth();
    if (!session) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    if (!isAdmin(session)) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });

    try {
        const body = await request.json();
        const { platform, platform_id, display_name, handle, category, avatar_url, url, active, notes, subscriber_count } = body as {
            platform: string;
            platform_id: string;
            display_name: string;
            handle: string;
            category: string;
            avatar_url?: string;
            url?: string;
            active?: boolean;
            notes?: string;
            subscriber_count?: number;
        };

        if (!platform || !platform_id || !display_name || !handle || !category) {
            return NextResponse.json({ success: false, error: 'Missing required fields: platform, platform_id, display_name, handle, category' }, { status: 400 });
        }

        if (!VALID_PLATFORMS.includes(platform as Platform)) {
            return NextResponse.json({ success: false, error: `Invalid platform. Use: ${VALID_PLATFORMS.join(', ')}` }, { status: 400 });
        }

        if (!VALID_CATEGORIES.includes(category as SourceCategory)) {
            return NextResponse.json({ success: false, error: `Invalid category. Use: ${VALID_CATEGORIES.join(', ')}` }, { status: 400 });
        }

        const docId = `${platform}_${platform_id}`;
        const now = new Date().toISOString();

        const doc = {
            platform: platform as Platform,
            display_name,
            handle,
            category: category as SourceCategory,
            verified: false,
            avatar_url: avatar_url || '',
            url: url || `https://youtube.com/${handle}`,
            active: active ?? true,
            notes: notes || '',
            metadata: { subscriber_count: subscriber_count || 0 },
            fetch_config: { frequency: 'daily', max_items_per_fetch: 50 },
            added_at: now,
            last_fetched_at: '',
        };

        const ok = await firestoreRestClient.createDocument(COLLECTIONS.SOURCES, docId, doc);
        if (!ok) {
            return NextResponse.json({ success: false, error: 'Failed to create source (may already exist)' }, { status: 409 });
        }

        return NextResponse.json({ success: true, data: { id: docId, ...doc } });
    } catch (error) {
        console.error('[Source Create Error]', error);
        return NextResponse.json({ success: false, error: 'Failed to create source' }, { status: 500 });
    }
}

export async function PATCH(request: NextRequest) {
    const session = await auth();
    if (!session) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    if (!isAdmin(session)) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });

    try {
        const body = await request.json();
        const { id, ...updates } = body as { id: string; [key: string]: unknown };

        if (!id) {
            return NextResponse.json({ success: false, error: 'Missing source id' }, { status: 400 });
        }

        // Whitelist updatable fields
        const allowedFields = ['display_name', 'handle', 'category', 'active', 'notes', 'avatar_url', 'url', 'verified', 'sort_order'];
        const filteredUpdates: Record<string, unknown> = {};
        for (const key of allowedFields) {
            if (key in updates) {
                filteredUpdates[key] = updates[key];
            }
        }

        if (Object.keys(filteredUpdates).length === 0) {
            return NextResponse.json({ success: false, error: 'No valid fields to update' }, { status: 400 });
        }

        // Validate category if being updated
        if (filteredUpdates.category && !VALID_CATEGORIES.includes(filteredUpdates.category as SourceCategory)) {
            return NextResponse.json({ success: false, error: `Invalid category. Use: ${VALID_CATEGORIES.join(', ')}` }, { status: 400 });
        }

        const ok = await firestoreRestClient.updateDocument(COLLECTIONS.SOURCES, id, filteredUpdates);
        if (!ok) {
            return NextResponse.json({ success: false, error: 'Failed to update source' }, { status: 500 });
        }

        return NextResponse.json({ success: true, data: { id, updates: filteredUpdates } });
    } catch (error) {
        console.error('[Source Update Error]', error);
        return NextResponse.json({ success: false, error: 'Failed to update source' }, { status: 500 });
    }
}
