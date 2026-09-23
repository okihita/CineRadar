import { NextRequest, NextResponse } from 'next/server';
import { firestoreRestClient } from '@/lib/firestore-rest';
import { getTodayJakarta } from '@/lib/timeUtils';
import type {
    TrackedHashtag,
    HashtagPulseStats,
    TikTokHashtagDetailSnapshot,
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

        return NextResponse.json({
            success: true,
            tag: cleanTag,
            targetDate,
            config: tagDoc || null,
            snapshot: snapshot || null,
            history,
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
