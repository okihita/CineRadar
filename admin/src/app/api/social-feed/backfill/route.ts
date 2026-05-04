/**
 * POST /api/social-feed/backfill
 *
 * Backfills YouTube data for a given date into Firestore,
 * then generates per-hour AI analysis via Gemini.
 *
 * Returns Server-Sent Events (SSE) for live progress updates.
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

// ─── SSE Helper ────────────────────────────────────────

function sseEvent(event: string, data: unknown): string {
    return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

// ─── Route Handler ─────────────────────────────────────

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { date } = body;

        if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
            return NextResponse.json(
                { success: false, error: 'Invalid date. Use YYYY-MM-DD format.' },
                { status: 400 },
            );
        }

        const publishedAfter = `${date}T00:00:00Z`;
        const publishedBefore = `${date}T23:59:59Z`;
        const totalChannels = YOUTUBE_CHANNELS.length;

        console.log(`[Backfill] Starting backfill for ${date}`);

        // ─── SSE Stream ──────────────────────────────────
        const encoder = new TextEncoder();
        const stream = new ReadableStream({
            async start(controller) {
                const send = (event: string, data: unknown) => {
                    controller.enqueue(encoder.encode(sseEvent(event, data)));
                };

                try {
                    // Phase 1: Fetch channel stats
                    send('phase', { phase: 'stats', message: 'Fetching channel statistics...' });
                    const statsMap = await fetchChannelStats();

                    // Phase 2: Fetch activities per channel
                    const allVideos: FirestoreYouTubeVideo[] = [];
                    let videosWritten = 0;

                    for (let i = 0; i < YOUTUBE_CHANNELS.length; i++) {
                        const channel = YOUTUBE_CHANNELS[i];
                        send('progress', {
                            phase: 'fetching',
                            channel: channel.display_name,
                            channelIndex: i + 1,
                            totalChannels,
                            message: `Fetching ${channel.display_name} (${i + 1}/${totalChannels})...`,
                        });

                        const activities = await fetchChannelActivities(
                            channel.channel_id,
                            publishedAfter,
                            publishedBefore,
                        );

                        const stats = statsMap.get(channel.channel_id);
                        const category = getAccountCategory(channel.account_id) as 'critic' | 'cinema_chain' | 'distributor' | 'community';
                        const now = new Date().toISOString();

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

                        send('channel_done', {
                            channel: channel.display_name,
                            videosFound: activities.length,
                            totalVideosSoFar: allVideos.length,
                        });
                    }

                    console.log(`[Backfill] Wrote ${videosWritten} videos for ${date}`);

                    send('phase', {
                        phase: 'writing_done',
                        message: `Found ${videosWritten} videos. Starting AI analysis...`,
                        totalVideos: videosWritten,
                    });

                    // Phase 3: AI analysis per hour
                    const hourGroups = groupVideosByHour(allVideos);
                    let analysesWritten = 0;
                    let hoursWithContent = 0;

                    // Count hours with content for progress
                    for (let h = 0; h < 24; h++) {
                        if ((hourGroups.get(h) || []).length > 0) hoursWithContent++;
                    }

                    let completedHours = 0;
                    const now = new Date().toISOString();

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
                        const { summary, retried } = await generateHourlySummary(
                            videosInHour.map(v => ({
                                title: v.title,
                                channel_title: v.channel_title,
                                content_type: v.content_type,
                                published_at: v.published_at,
                            })),
                            hour,
                            date,
                        );

                        const analysisDoc = {
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
                        completedHours++;

                        send('hour_done', {
                            hour,
                            hourFormatted: `${String(hour).padStart(2, '0')}:00`,
                            videoCount: videosInHour.length,
                            summary: summary.slice(0, 120) + (summary.length > 120 ? '...' : ''),
                            completedHours,
                            totalHours: 24,
                            progress: Math.round((completedHours / 24) * 100),
                            retried,
                        });

                        // Rate limit: only delay if hour had content (triggered a real API call)
                        if (videosInHour.length > 0) {
                            await new Promise(r => setTimeout(r, 5000));
                        }
                    }

                    console.log(`[Backfill] Wrote ${analysesWritten} hourly analyses for ${date}`);

                    send('done', {
                        date,
                        videos_written: videosWritten,
                        analyses_written: analysesWritten,
                    });
                } catch (error) {
                    console.error('[Backfill Error]', error);
                    send('error', {
                        message: error instanceof Error ? error.message : 'Unknown error',
                    });
                } finally {
                    controller.close();
                }
            },
        });

        return new Response(stream, {
            headers: {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
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
