import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { firestoreRestClient } from '@/lib/firestore-rest';
import { computeAggregateCost, computeHashtagUnitCost } from '@/lib/tiktokCostEngine';
import type { TrackedHashtag, CustomHashtagsConfigDoc, HashtagPulseStats } from '@/types/tiktokHashtags';

const FIRESTORE_COLLECTION = 'tiktok_sources';
const FIRESTORE_DOC_ID = 'config';

function getLocalConfigPath(): string {
    return path.join(process.cwd(), 'src/data/tiktok_sources.json');
}

function readLocalConfig(): CustomHashtagsConfigDoc {
    const filePath = getLocalConfigPath();
    if (!fs.existsSync(filePath)) {
        return { tracked_hashtags: [] };
    }
    try {
        const raw = fs.readFileSync(filePath, 'utf-8');
        return JSON.parse(raw);
    } catch {
        return { tracked_hashtags: [] };
    }
}

function writeLocalConfig(data: CustomHashtagsConfigDoc): void {
    try {
        const filePath = getLocalConfigPath();
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
    } catch (e) {
        console.warn('[TikTok Hashtags API] Failed to update local config backup:', e);
    }
}

async function getHashtagConfig(): Promise<{ doc: CustomHashtagsConfigDoc; tags: TrackedHashtag[] }> {
    try {
        const doc = await firestoreRestClient.getDocument<CustomHashtagsConfigDoc>(
            FIRESTORE_COLLECTION,
            FIRESTORE_DOC_ID
        );
        if (doc) {
            return {
                doc,
                tags: Array.isArray(doc.tracked_hashtags) ? doc.tracked_hashtags : [],
            };
        }
    } catch (err) {
        console.warn('[TikTok Hashtags API] Firestore read fallback to local JSON:', err);
    }

    const local = readLocalConfig();
    return {
        doc: local,
        tags: Array.isArray(local.tracked_hashtags) ? local.tracked_hashtags : [],
    };
}

async function persistHashtagConfig(updatedTags: TrackedHashtag[]): Promise<boolean> {
    const { doc } = await getHashtagConfig();
    const updatedDoc: CustomHashtagsConfigDoc = {
        ...doc,
        tracked_hashtags: updatedTags,
        updated_at: new Date().toISOString(),
    };

    // Update local file backup
    writeLocalConfig(updatedDoc);

    // Update Firestore
    try {
        const success = await firestoreRestClient.updateDocument(
            FIRESTORE_COLLECTION,
            FIRESTORE_DOC_ID,
            {
                tracked_hashtags: updatedTags,
                updated_at: new Date().toISOString(),
            }
        );
        return success;
    } catch (err) {
        console.error('[TikTok Hashtags API] Failed to persist to Firestore:', err);
        return false;
    }
}

// GET: Return all tracked hashtags, cost forecast, and recent stats
export async function GET() {
    try {
        const { doc, tags } = await getHashtagConfig();
        const forecast = computeAggregateCost(tags);

        // Fetch recent pulse telemetry if available
        const latestPulseMap: Record<string, HashtagPulseStats> = {};
        try {
            // Try fetching latest custom pulse data
            const today = new Date().toISOString().split('T')[0];
            const pulseDoc = await firestoreRestClient.getDocument<{ stats?: Record<string, HashtagPulseStats> }>(
                'tiktok_custom_pulse',
                today
            );
            if (pulseDoc?.stats) {
                Object.assign(latestPulseMap, pulseDoc.stats);
            }
        } catch {
            // Ignore telemetry fetch errors
        }

        const tagsWithCost = tags.map((t) => {
            const cadence = Math.max(1, t.cadence ?? 1);
            const unit = computeHashtagUnitCost({
                postsPerCrawl: t.target_posts,
                includeComments: t.include_comments,
                crawlsPerDay: cadence,
            });
            return {
                ...t,
                cadence,
                start_hour: t.start_hour !== undefined ? t.start_hour : 18,
                cost: unit,
                latest_stats: latestPulseMap[t.tag.toLowerCase()] || null,
            };
        });

        return NextResponse.json({
            success: true,
            tracked_hashtags: tagsWithCost,
            cost_forecast: forecast,
            excluded_hashtags: doc.excluded_hashtags || [],
            updated_at: doc.updated_at,
        });
    } catch (error) {
        console.error('[TikTok Hashtags API GET Error]:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to fetch tracked hashtags' },
            { status: 500 }
        );
    }
}

// POST: Add a new custom hashtag
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const rawTag = String(body.tag || '').trim();
        const cleanTag = rawTag.replace(/^#/, '').toLowerCase().replace(/[^a-z0-9_]/g, '');

        if (!cleanTag) {
            return NextResponse.json(
                { success: false, error: 'Valid hashtag name is required' },
                { status: 400 }
            );
        }

        const { doc, tags } = await getHashtagConfig();

        // Check if already tracked
        if (tags.some((t) => t.tag.toLowerCase() === cleanTag)) {
            return NextResponse.json(
                { success: false, error: `Hashtag #${cleanTag} is already being tracked` },
                { status: 409 }
            );
        }

        const cadence = Math.max(1, Math.min(4, Number(body.cadence) || 1));
        const rawStartHour = body.start_hour !== undefined ? Number(body.start_hour) : 18;
        const startHour = isNaN(rawStartHour) ? 18 : Math.max(0, Math.min(23, rawStartHour));

        const newEntry: TrackedHashtag = {
            id: `ht-${cleanTag}-${Date.now().toString(36)}`,
            tag: cleanTag,
            label: String(body.label || cleanTag).trim(),
            category: ['campaign', 'competitor', 'meme', 'talent', 'general'].includes(body.category)
                ? body.category
                : 'general',
            target_posts: Number(body.target_posts) || 40,
            cadence,
            start_hour: startHour,
            include_comments: body.include_comments !== false,
            active: body.active !== false,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        };

        const updated = [newEntry, ...tags];
        const success = await persistHashtagConfig(updated);

        if (!success) {
            return NextResponse.json(
                { success: false, error: 'Failed to save hashtag to database' },
                { status: 500 }
            );
        }

        return NextResponse.json({
            success: true,
            data: newEntry,
            message: `Hashtag #${cleanTag} added successfully`,
        });
    } catch (error) {
        console.error('[TikTok Hashtags API POST Error]:', error);
        return NextResponse.json(
            { success: false, error: 'Internal server error adding hashtag' },
            { status: 500 }
        );
    }
}

// PUT: Update hashtag configuration (e.g. toggle active, adjust posts, comments, cadence, start_hour)
export async function PUT(req: NextRequest) {
    try {
        const body = await req.json();
        const tagId = String(body.id || '').trim();

        if (!tagId) {
            return NextResponse.json({ success: false, error: 'Hashtag ID is required' }, { status: 400 });
        }

        const { tags } = await getHashtagConfig();
        const index = tags.findIndex((t) => t.id === tagId);

        if (index === -1) {
            return NextResponse.json({ success: false, error: 'Tracked hashtag not found' }, { status: 404 });
        }

        const current = tags[index];
        const updatedEntry: TrackedHashtag = {
            ...current,
            label: body.label !== undefined ? String(body.label).trim() : current.label,
            category: body.category || current.category,
            target_posts: body.target_posts !== undefined ? Number(body.target_posts) : current.target_posts,
            cadence:
                body.cadence !== undefined
                    ? Math.max(1, Math.min(4, Number(body.cadence) || 1))
                    : (current.cadence ?? 1),
            start_hour:
                body.start_hour !== undefined
                    ? Math.max(0, Math.min(23, Number(body.start_hour) || 18))
                    : (current.start_hour ?? 18),
            include_comments:
                body.include_comments !== undefined ? Boolean(body.include_comments) : current.include_comments,
            active: body.active !== undefined ? Boolean(body.active) : current.active,
            updated_at: new Date().toISOString(),
        };

        tags[index] = updatedEntry;
        const success = await persistHashtagConfig(tags);

        if (!success) {
            return NextResponse.json(
                { success: false, error: 'Failed to update hashtag in database' },
                { status: 500 }
            );
        }

        return NextResponse.json({
            success: true,
            data: updatedEntry,
            message: `Hashtag #${updatedEntry.tag} updated`,
        });
    } catch (error) {
        console.error('[TikTok Hashtags API PUT Error]:', error);
        return NextResponse.json(
            { success: false, error: 'Internal server error updating hashtag' },
            { status: 500 }
        );
    }
}

// DELETE: Remove a tracked hashtag
export async function DELETE(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const tagId = searchParams.get('id');

        if (!tagId) {
            return NextResponse.json({ success: false, error: 'Hashtag ID is required' }, { status: 400 });
        }

        const { tags } = await getHashtagConfig();
        const filtered = tags.filter((t) => t.id !== tagId);

        if (filtered.length === tags.length) {
            return NextResponse.json({ success: false, error: 'Tracked hashtag not found' }, { status: 404 });
        }

        const success = await persistHashtagConfig(filtered);
        if (!success) {
            return NextResponse.json(
                { success: false, error: 'Failed to delete hashtag from database' },
                { status: 500 }
            );
        }

        return NextResponse.json({
            success: true,
            message: 'Hashtag removed from tracking',
        });
    } catch (error) {
        console.error('[TikTok Hashtags API DELETE Error]:', error);
        return NextResponse.json(
            { success: false, error: 'Internal server error deleting hashtag' },
            { status: 500 }
        );
    }
}
