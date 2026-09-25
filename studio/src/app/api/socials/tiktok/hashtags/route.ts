import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { firestoreRestClient } from '@/lib/firestore-rest';
import { computeAggregateCost, computeHashtagUnitCost } from '@/lib/tiktokCostEngine';
import type { TrackedHashtag, HashtagPulseStats } from '@/types/tiktokHashtags';

const FIRESTORE_COLLECTION = 'tiktok_tracked_hashtags';
const SOURCES_COLLECTION = 'tiktok_sources';
const SOURCES_DOC_ID = 'config';

function getLocalBackupPath(): string {
    return path.join(process.cwd(), 'src/data/tiktok_tracked_hashtags.json');
}

function readLocalBackup(): TrackedHashtag[] {
    const filePath = getLocalBackupPath();
    if (!fs.existsSync(filePath)) {
        return [];
    }
    try {
        const raw = fs.readFileSync(filePath, 'utf-8');
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

function writeLocalBackup(tags: TrackedHashtag[]): void {
    try {
        const filePath = getLocalBackupPath();
        fs.writeFileSync(filePath, JSON.stringify(tags, null, 2), 'utf-8');
    } catch (e) {
        console.warn('[TikTok Hashtags API] Failed to update local backup:', e);
    }
}

async function getTrackedHashtags(): Promise<TrackedHashtag[]> {
    try {
        const docs = await firestoreRestClient.getCollection<TrackedHashtag>(FIRESTORE_COLLECTION);
        if (docs && docs.length > 0) {
            writeLocalBackup(docs);
            return docs;
        }
    } catch (err) {
        console.warn('[TikTok Hashtags API] Firestore read fallback to local backup:', err);
    }

    return readLocalBackup();
}

// GET: Return all tracked hashtags from dedicated collection, cost forecast, and recent stats
export async function GET() {
    try {
        const tags = await getTrackedHashtags();
        const forecast = computeAggregateCost(tags);

        // Fetch recent pulse telemetry if available
        const latestPulseMap: Record<string, HashtagPulseStats> = {};
        try {
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

        // Fetch excluded hashtags for search/suggestions
        let excludedHashtags: string[] = [];
        try {
            const sourcesDoc = await firestoreRestClient.getDocument<{ excluded_hashtags?: string[] }>(
                SOURCES_COLLECTION,
                SOURCES_DOC_ID
            );
            excludedHashtags = sourcesDoc?.excluded_hashtags || [];
        } catch {
            // Fallback to empty
        }

        const tagsWithCost = tags.map((t) => {
            const cadence = Math.max(1, t.cadence ?? 1);
            const unit = computeHashtagUnitCost({
                postsPerCrawl: t.target_posts,
                includeComments: t.include_comments,
                crawlsPerDay: cadence,
            });
            const scrapeCount =
                t.scrape_count !== undefined && t.scrape_count !== null
                    ? t.scrape_count
                    : t.last_scraped_at
                    ? 1
                    : 0;
            const totalCostUsd =
                t.total_cost_usd !== undefined && t.total_cost_usd !== null
                    ? t.total_cost_usd
                    : Number((scrapeCount * unit.totalPerCrawlUsd).toFixed(4));

            return {
                ...t,
                cadence,
                start_hour: t.start_hour !== undefined ? t.start_hour : 18,
                scrape_count: scrapeCount,
                total_cost_usd: totalCostUsd,
                cost: unit,
                latest_stats: latestPulseMap[t.tag.toLowerCase()] || null,
            };
        });

        return NextResponse.json({
            success: true,
            tracked_hashtags: tagsWithCost,
            cost_forecast: forecast,
            excluded_hashtags: excludedHashtags,
            updated_at: new Date().toISOString(),
        });
    } catch (error) {
        console.error('[TikTok Hashtags API GET Error]:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to fetch tracked hashtags' },
            { status: 500 }
        );
    }
}

// POST: Add a new custom hashtag into dedicated tiktok_tracked_hashtags collection
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

        // Check if already tracked
        const existing = await firestoreRestClient.getDocument<TrackedHashtag>(FIRESTORE_COLLECTION, cleanTag);
        if (existing) {
            return NextResponse.json(
                { success: false, error: `Hashtag #${cleanTag} is already being tracked` },
                { status: 409 }
            );
        }

        const cadence = Math.max(1, Math.min(4, Number(body.cadence) || 1));
        const rawStartHour = body.start_hour !== undefined ? Number(body.start_hour) : 18;
        const startHour = isNaN(rawStartHour) ? 18 : Math.max(0, Math.min(23, rawStartHour));

        const now = new Date().toISOString();
        const newEntry: TrackedHashtag = {
            id: cleanTag,
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
            created_at: now,
            updated_at: now,
        };

        const success = await firestoreRestClient.createDocument(
            FIRESTORE_COLLECTION,
            cleanTag,
            newEntry as unknown as Record<string, unknown>
        );

        if (!success) {
            return NextResponse.json(
                { success: false, error: 'Failed to save hashtag to dedicated database collection' },
                { status: 500 }
            );
        }

        return NextResponse.json({
            success: true,
            data: newEntry,
            message: `Hashtag #${cleanTag} added successfully to ${FIRESTORE_COLLECTION}`,
        });
    } catch (error) {
        console.error('[TikTok Hashtags API POST Error]:', error);
        return NextResponse.json(
            { success: false, error: 'Internal server error adding hashtag' },
            { status: 500 }
        );
    }
}

// PUT: Update hashtag document in tiktok_tracked_hashtags
export async function PUT(req: NextRequest) {
    try {
        const body = await req.json();
        const rawId = String(body.id || body.tag || '').trim();
        const cleanTag = rawId.replace(/^ht-/, '').replace(/^#/, '').toLowerCase().trim();

        if (!cleanTag) {
            return NextResponse.json({ success: false, error: 'Hashtag identifier is required' }, { status: 400 });
        }

        let current = await firestoreRestClient.getDocument<TrackedHashtag>(FIRESTORE_COLLECTION, cleanTag);
        if (!current && rawId !== cleanTag) {
            current = await firestoreRestClient.getDocument<TrackedHashtag>(FIRESTORE_COLLECTION, rawId);
        }

        if (!current) {
            return NextResponse.json({ success: false, error: 'Tracked hashtag document not found' }, { status: 404 });
        }

        const docId = current.tag || cleanTag;
        const updates: Partial<TrackedHashtag> = {
            updated_at: new Date().toISOString(),
        };

        if (body.label !== undefined) updates.label = String(body.label).trim();
        if (body.category !== undefined) updates.category = body.category;
        if (body.target_posts !== undefined) updates.target_posts = Number(body.target_posts);
        if (body.cadence !== undefined) {
            updates.cadence = Math.max(1, Math.min(4, Number(body.cadence) || 1));
        }
        if (body.start_hour !== undefined) {
            updates.start_hour = Math.max(0, Math.min(23, Number(body.start_hour) || 18));
        }
        if (body.include_comments !== undefined) {
            updates.include_comments = Boolean(body.include_comments);
        }
        if (body.active !== undefined) {
            updates.active = Boolean(body.active);
        }

        const success = await firestoreRestClient.updateDocument(
            FIRESTORE_COLLECTION,
            docId,
            updates as unknown as Record<string, unknown>
        );

        if (!success) {
            return NextResponse.json(
                { success: false, error: 'Failed to update hashtag document' },
                { status: 500 }
            );
        }

        const updatedEntry = { ...current, ...updates };

        return NextResponse.json({
            success: true,
            data: updatedEntry,
            message: `Hashtag #${docId} updated`,
        });
    } catch (error) {
        console.error('[TikTok Hashtags API PUT Error]:', error);
        return NextResponse.json(
            { success: false, error: 'Internal server error updating hashtag' },
            { status: 500 }
        );
    }
}

// DELETE: Remove a tracked hashtag document from tiktok_tracked_hashtags
export async function DELETE(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const rawId = searchParams.get('id') || searchParams.get('tag') || '';
        const cleanTag = rawId.replace(/^ht-/, '').replace(/^#/, '').toLowerCase().trim();

        if (!cleanTag) {
            return NextResponse.json({ success: false, error: 'Hashtag identifier is required' }, { status: 400 });
        }

        // Attempt delete by normalized tag or rawId
        let success = await firestoreRestClient.deleteDocument(FIRESTORE_COLLECTION, cleanTag);
        if (!success && rawId !== cleanTag) {
            success = await firestoreRestClient.deleteDocument(FIRESTORE_COLLECTION, rawId);
        }

        if (!success) {
            return NextResponse.json(
                { success: false, error: 'Failed to delete hashtag document from collection' },
                { status: 500 }
            );
        }

        return NextResponse.json({
            success: true,
            message: `Hashtag #${cleanTag} removed from tracking`,
        });
    } catch (error) {
        console.error('[TikTok Hashtags API DELETE Error]:', error);
        return NextResponse.json(
            { success: false, error: 'Internal server error deleting hashtag' },
            { status: 500 }
        );
    }
}
