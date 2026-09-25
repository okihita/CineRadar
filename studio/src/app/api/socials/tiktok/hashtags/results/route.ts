import { NextRequest, NextResponse } from 'next/server';
import { firestoreRestClient } from '@/lib/firestore-rest';
import { getTodayJakarta } from '@/lib/timeUtils';
import { computeHashtagUnitCost, USD_TO_IDR } from '@/lib/tiktokCostEngine';
import type {
    TrackedHashtag,
    HashtagPulseStats,
    TikTokHashtagDetailSnapshot,
    HashtagCostTelemetry,
} from '@/types/tiktokHashtags';

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const rawTag = searchParams.get('tag');
        const dateParam = searchParams.get('date');

        if (!rawTag) {
            return NextResponse.json(
                { success: false, error: 'Query parameter "tag" is required' },
                { status: 400 }
            );
        }

        const cleanTag = rawTag.replace(/^#/, '').toLowerCase().trim();
        const today = getTodayJakarta();
        const targetDate = dateParam || today;

        // 1. Fetch tag configuration
        const tagDoc = await firestoreRestClient.getDocument<TrackedHashtag>(
            'tiktok_tracked_hashtags',
            cleanTag
        );

        // 2. Fetch granular snapshot from subcollection
        let snapshot = await firestoreRestClient.getDocument<TikTokHashtagDetailSnapshot>(
            `tiktok_custom_pulse/${targetDate}/hashtags`,
            cleanTag
        );

        // 3. Fallback: Check root pulse document if subcollection not yet populated
        if (!snapshot) {
            const rootPulse = await firestoreRestClient.getDocument<{
                stats?: Record<string, HashtagPulseStats>;
                updated_at?: string;
            }>('tiktok_custom_pulse', targetDate);

            const tagSummary = rootPulse?.stats?.[cleanTag];
            if (tagSummary) {
                snapshot = {
                    tag: cleanTag,
                    label: tagDoc?.label || cleanTag,
                    category: tagDoc?.category || 'general',
                    date: targetDate,
                    crawled_at: tagSummary.crawled_at || rootPulse?.updated_at || `${targetDate}T18:00:00Z`,
                    source: 'scheduled_pulse',
                    total_posts: tagSummary.total_posts || 0,
                    total_views: tagSummary.total_views || 0,
                    total_likes: tagSummary.total_likes || 0,
                    total_comments: tagSummary.total_comments || 0,
                    total_shares: tagSummary.total_shares || 0,
                    sentiment: tagSummary.sentiment,
                    posts: [],
                };
            }
        }

        // 4. Build 7-day historical momentum trend
        const history: Array<{
            date: string;
            views: number;
            likes: number;
            comments: number;
            hype_score: number;
        }> = [];

        const targetDateObj = new Date(targetDate);
        const daysToQuery: string[] = [];
        for (let i = 6; i >= 0; i--) {
            const d = new Date(targetDateObj);
            d.setDate(d.getDate() - i);
            daysToQuery.push(d.toISOString().split('T')[0]);
        }

        const historyPromises = daysToQuery.map(async (dStr) => {
            const dayDoc = await firestoreRestClient.getDocument<{
                stats?: Record<string, HashtagPulseStats>;
            }>('tiktok_custom_pulse', dStr);
            const dayStat = dayDoc?.stats?.[cleanTag];
            if (dayStat) {
                return {
                    date: dStr,
                    views: dayStat.total_views || 0,
                    likes: dayStat.total_likes || 0,
                    comments: dayStat.total_comments || 0,
                    hype_score: dayStat.sentiment?.hype_score || 0,
                };
            }
            return null;
        });

        const resolvedHistory = await Promise.all(historyPromises);
        for (const item of resolvedHistory) {
            if (item) history.push(item);
        }

        // 5. Discover all historical scrape dates available for this hashtag
        const availableDatesSet = new Set<string>();
        for (const item of resolvedHistory) {
            if (item && item.date) availableDatesSet.add(item.date);
        }
        if (Array.isArray(tagDoc?.scrape_history)) {
            for (const log of tagDoc.scrape_history) {
                if (log.timestamp) availableDatesSet.add(log.timestamp.split('T')[0]);
            }
        }
        if (tagDoc?.last_scraped_at) {
            availableDatesSet.add(tagDoc.last_scraped_at.split('T')[0]);
        }
        if (snapshot) {
            availableDatesSet.add(targetDate);
        }

        const availableDates = Array.from(availableDatesSet).sort().reverse();

        // 6. Compute Unit Economics & Scrape Frequency Telemetry
        const targetPosts = tagDoc?.target_posts || 40;
        const includeComments = tagDoc?.include_comments ?? true;
        const cadence = Math.max(1, tagDoc?.cadence ?? 1);

        const unitCost = computeHashtagUnitCost({
            postsPerCrawl: targetPosts,
            includeComments,
            crawlsPerDay: cadence,
        });

        const deepCost = computeHashtagUnitCost({
            postsPerCrawl: 100,
            includeComments,
            crawlsPerDay: cadence,
        });

        const scrapeCount =
            tagDoc?.scrape_count !== undefined && tagDoc?.scrape_count !== null
                ? tagDoc.scrape_count
                : tagDoc?.last_scraped_at
                ? 1
                : 0;

        const totalCostUsd =
            tagDoc?.total_cost_usd !== undefined && tagDoc?.total_cost_usd !== null
                ? tagDoc.total_cost_usd
                : Number((scrapeCount * unitCost.totalPerCrawlUsd).toFixed(4));

        const costTelemetry: HashtagCostTelemetry = {
            unitCost,
            deepCost,
            scrape_count: scrapeCount,
            total_cost_usd: totalCostUsd,
            total_cost_idr: Math.round(totalCostUsd * USD_TO_IDR),
            scrape_history: Array.isArray(tagDoc?.scrape_history) ? tagDoc.scrape_history : [],
        };

        return NextResponse.json({
            success: true,
            tag: cleanTag,
            targetDate,
            config: tagDoc || null,
            cost: costTelemetry,
            snapshot: snapshot || null,
            history,
            available_dates: availableDates,
        });
    } catch (error) {
        console.error('[TikTok Hashtag Results API Error]:', error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to fetch hashtag results',
            },
            { status: 500 }
        );
    }
}
