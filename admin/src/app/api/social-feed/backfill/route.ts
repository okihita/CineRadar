/**
 * POST /api/social-feed/backfill
 *
 * Backfills YouTube data for a given date into Firestore,
 * then generates per-hour AI analysis via Gemini.
 *
 * Body: { date: "2026-05-04" }
 */

import { NextResponse } from 'next/server';
import { YOUTUBE_CHANNELS } from '@/features/social-pulse/data/youtubeChannels';
import { detectContentType } from '@/features/social-pulse/data/mockSocialFeed';
import { firestoreRestClient } from '@/lib/firestore-rest';
import { generateHourlySummary } from '@/lib/gemini';
import {
    COLLECTIONS,
    makeHourId,
    groupVideosByHour,
    type FirestoreYouTubeVideo,
    type FirestoreHourlyAnalysis,
} from '@/lib/firestore-youtube';

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;

// ─── Types ─────────────────────────────────────────────

interface YouTubeActivity {
    id: string;
    snippet: {
        channelTitle: string;
        description: string;
        publishedAt: string;
        title: string;
        thumbnails: {
            high?: { url: string };
            default?: { url: string };
        };
        type: string;
    };
    contentDetails?: {
        upload?: { videoId: string };
    };
}

// ─── Helpers ───────────────────────────────────────────

function getAccountCategory(accountId: string): string {
    const categories: Record<string, string> = {
        'cine-crib': 'critic',
        'joker-review': 'critic',
        'cgv-id': 'cinema_chain',
        'xxi-official': 'cinema_chain',
        'md-pictures': 'distributor',
        'riva-pictures': 'distributor',
        'star-movies': 'distributor',
        'bioskopmania': 'community',
    };
    return categories[accountId] || 'community';
}

/** Fetch YouTube activities for a single channel within a date range */
async function fetchChannelActivities(
    channelId: string,
    publishedAfter: string,
    publishedBefore: string,
): Promise<YouTubeActivity[]> {
    if (!YOUTUBE_API_KEY) return [];

    const url = new URL('https://www.googleapis.com/youtube/v3/activities');
    url.searchParams.set('part', 'snippet,contentDetails');
    url.searchParams.set('channelId', channelId);
    url.searchParams.set('maxResults', '50');
    url.searchParams.set('publishedAfter', publishedAfter);
    url.searchParams.set('publishedBefore', publishedBefore);
    url.searchParams.set('key', YOUTUBE_API_KEY);

    const res = await fetch(url.toString(), { cache: 'no-store' });
    if (!res.ok) {
        console.error(`[Backfill] YouTube API error for ${channelId}: ${res.status}`);
        return [];
    }
    const data = await res.json();
    return (data.items || [])
        .filter((a: YouTubeActivity) => a.snippet.type === 'upload' && a.contentDetails?.upload?.videoId);
}

/** Fetch channel stats + avatar */
async function fetchChannelStats(): Promise<Map<string, { subscriberCount: string; avatarUrl: string }>> {
    const map = new Map<string, { subscriberCount: string; avatarUrl: string }>();
    if (!YOUTUBE_API_KEY) return map;

    const ids = YOUTUBE_CHANNELS.map(c => c.channel_id).join(',');
    const url = new URL('https://www.googleapis.com/youtube/v3/channels');
    url.searchParams.set('part', 'statistics,snippet');
    url.searchParams.set('id', ids);
    url.searchParams.set('key', YOUTUBE_API_KEY);

    const res = await fetch(url.toString(), { cache: 'no-store' });
    if (!res.ok) return map;

    const data = await res.json();
    for (const item of data.items || []) {
        map.set(item.id, {
            subscriberCount: item.statistics?.subscriberCount || '0',
            avatarUrl: item.snippet?.thumbnails?.high?.url || item.snippet?.thumbnails?.default?.url || '',
        });
    }
    return map;
}

// ─── Route Handler ─────────────────────────────────────

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { date } = body;

        // Validate date format
        if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
            return NextResponse.json(
                { success: false, error: 'Invalid date. Use YYYY-MM-DD format.' },
                { status: 400 },
            );
        }

        // Build time window for the full day (UTC)
        const publishedAfter = `${date}T00:00:00Z`;
        const publishedBefore = `${date}T23:59:59Z`;

        console.log(`[Backfill] Starting backfill for ${date}`);

        // 1. Fetch channel stats (avatars)
        const statsMap = await fetchChannelStats();

        // 2. Fetch activities for all channels in parallel
        const activityPromises = YOUTUBE_CHANNELS.map(async (channel) => {
            const activities = await fetchChannelActivities(
                channel.channel_id,
                publishedAfter,
                publishedBefore,
            );
            return { channel, activities };
        });
        const channelResults = await Promise.all(activityPromises);

        // 3. Convert to Firestore documents and write
        const now = new Date().toISOString();
        let videosWritten = 0;
        const allVideos: FirestoreYouTubeVideo[] = [];

        for (const { channel, activities } of channelResults) {
            const stats = statsMap.get(channel.channel_id);
            const category = getAccountCategory(channel.account_id) as 'critic' | 'cinema_chain' | 'distributor' | 'community';

            for (const activity of activities) {
                const videoId = activity.contentDetails!.upload!.videoId;
                const contentType = detectContentType(activity.snippet.title, category);
                const thumb = activity.snippet.thumbnails?.high?.url || activity.snippet.thumbnails?.default?.url || '';

                const doc: Omit<FirestoreYouTubeVideo, 'id'> = {
                    title: activity.snippet.title,
                    description: activity.snippet.description?.slice(0, 500) || '',
                    thumbnail: thumb,
                    video_url: `https://youtube.com/watch?v=${videoId}`,
                    channel_id: channel.channel_id,
                    channel_title: channel.display_name,
                    channel_avatar: stats?.avatarUrl || '',
                    content_type: contentType,
                    published_at: activity.snippet.publishedAt,
                    fetched_at: now,
                };

                const ok = await firestoreRestClient.createDocument(
                    COLLECTIONS.VIDEOS,
                    videoId,
                    doc,
                );
                if (ok) videosWritten++;
                allVideos.push({ id: videoId, ...doc });
            }
        }

        console.log(`[Backfill] Wrote ${videosWritten} videos for ${date}`);

        // 4. Group videos by hour and generate AI analysis
        const hourGroups = groupVideosByHour(allVideos);
        let analysesWritten = 0;

        for (let hour = 0; hour < 24; hour++) {
            const hourId = makeHourId(date, hour);
            const videosInHour = hourGroups.get(hour) || [];

            // Count content types
            const typeBreakdown: Record<string, number> = {};
            const channelsActive = new Set<string>();
            for (const v of videosInHour) {
                typeBreakdown[v.content_type] = (typeBreakdown[v.content_type] || 0) + 1;
                channelsActive.add(v.channel_title);
            }

            // Generate AI summary
            const summary = await generateHourlySummary(
                videosInHour.map(v => ({
                    title: v.title,
                    channel_title: v.channel_title,
                    content_type: v.content_type,
                    published_at: v.published_at,
                })),
                hour,
                date,
            );

            const analysisDoc: Omit<FirestoreHourlyAnalysis, 'id'> = {
                date,
                hour,
                summary,
                video_count: videosInHour.length,
                content_type_breakdown: typeBreakdown,
                channels_active: [...channelsActive],
                generated_at: now,
                model: 'gemini-2.0-flash',
            };

            const ok = await firestoreRestClient.createDocument(
                COLLECTIONS.HOURLY_ANALYSIS,
                hourId,
                analysisDoc,
            );
            if (ok) analysesWritten++;

            // Small delay to avoid Gemini rate limits (15 RPM free tier)
            if (videosInHour.length > 0) {
                await new Promise(r => setTimeout(r, 4500));
            }
        }

        console.log(`[Backfill] Wrote ${analysesWritten} hourly analyses for ${date}`);

        return NextResponse.json({
            success: true,
            data: {
                date,
                videos_written: videosWritten,
                analyses_written: analysesWritten,
            },
        });
    } catch (error) {
        console.error('[Backfill Error]', error);
        return NextResponse.json(
            { success: false, error: 'Backfill failed' },
            { status: 500 },
        );
    }
}
