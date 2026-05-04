/**
 * POST /api/social-feed/backfill
 *
 * Backfills YouTube data for a given date into Firestore,
 * then generates per-hour AI analysis via Gemini.
 *
 * Channels are read from beta_youtube_channels (Firestore).
 * Full video details fetched via videos.list (descriptions, duration, stats).
 *
 * Returns Server-Sent Events (SSE) for live progress updates.
 *
 * Body: { date: "2026-05-04" }
 */

import { NextResponse } from 'next/server';
import { detectContentType } from '@/features/social-pulse/data/mockSocialFeed';
import { firestoreRestClient } from '@/lib/firestore-rest';
import { generateHourlySummary } from '@/lib/gemini';
import {
    COLLECTIONS,
    makeHourId,
    groupVideosByHour,
    type FirestoreYouTubeVideo,
    type FirestoreYouTubeChannel,
    type FirestoreHourlyAnalysis,
    type ChannelCategory,
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

interface VideoDetails {
    id: string;
    snippet?: {
        description?: string;
        tags?: string[];
    };
    contentDetails?: {
        duration?: string; // PT15M30S
    };
    statistics?: {
        viewCount?: string;
        likeCount?: string;
    };
}

// ─── YouTube API helpers ───────────────────────────────

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

/** Fetch full video details (description, duration, stats) — up to 50 IDs per call */
async function fetchVideoDetails(videoIds: string[]): Promise<Map<string, VideoDetails>> {
    const map = new Map<string, VideoDetails>();
    if (!YOUTUBE_API_KEY || videoIds.length === 0) return map;

    // Batch in groups of 50 (YouTube API limit)
    for (let i = 0; i < videoIds.length; i += 50) {
        const batch = videoIds.slice(i, i + 50);
        const url = new URL('https://www.googleapis.com/youtube/v3/videos');
        url.searchParams.set('part', 'snippet,contentDetails,statistics');
        url.searchParams.set('id', batch.join(','));
        url.searchParams.set('key', YOUTUBE_API_KEY);

        const res = await fetch(url.toString(), { cache: 'no-store' });
        if (!res.ok) continue;

        const data = await res.json();
        for (const item of data.items || []) {
            map.set(item.id, item);
        }
    }
    return map;
}

/** Fetch channel stats + avatars for given channel IDs */
async function fetchChannelStats(channelIds: string[]): Promise<Map<string, { subscriberCount: number; avatarUrl: string }>> {
    const map = new Map<string, { subscriberCount: number; avatarUrl: string }>();
    if (!YOUTUBE_API_KEY || channelIds.length === 0) return map;

    const url = new URL('https://www.googleapis.com/youtube/v3/channels');
    url.searchParams.set('part', 'statistics,snippet');
    url.searchParams.set('id', channelIds.join(','));
    url.searchParams.set('key', YOUTUBE_API_KEY);

    const res = await fetch(url.toString(), { cache: 'no-store' });
    if (!res.ok) return map;

    const data = await res.json();
    for (const item of data.items || []) {
        map.set(item.id, {
            subscriberCount: parseInt(item.statistics?.subscriberCount || '0'),
            avatarUrl: item.snippet?.thumbnails?.high?.url || item.snippet?.thumbnails?.default?.url || '',
        });
    }
    return map;
}

/** Load active channels from Firestore */
async function loadActiveChannels(): Promise<FirestoreYouTubeChannel[]> {
    const allChannels = await firestoreRestClient.runQuery<FirestoreYouTubeChannel>({
        from: [{ collectionId: COLLECTIONS.CHANNELS }],
        where: {
            fieldFilter: {
                field: { fieldPath: 'active' },
                op: 'EQUAL',
                value: { booleanValue: true },
            },
        },
    });
    return allChannels;
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

        const backfillStart = Date.now();

        // Convert Jakarta date to UTC range for YouTube API
        const publishedAfter = `${date}T00:00:00+07:00`;
        const publishedBefore = `${date}T23:59:59+07:00`;

        console.log(`[Backfill] Starting backfill for ${date}`);

        // ─── SSE Stream ──────────────────────────────────
        const encoder = new TextEncoder();
        const stream = new ReadableStream({
            async start(controller) {
                const send = (event: string, data: unknown) => {
                    controller.enqueue(encoder.encode(sseEvent(event, data)));
                };

                try {
                    // Phase 0: Load channels from Firestore
                    send('phase', { phase: 'loading_channels', message: 'Loading channels from database...' });
                    const channels = await loadActiveChannels();

                    if (channels.length === 0) {
                        send('error', { message: 'No active channels found. Run /api/social-feed/seed first.' });
                        controller.close();
                        return;
                    }

                    const totalChannels = channels.length;
                    const channelIds = channels.map(c => c.id);

                    // Phase 1: Fetch channel stats (avatars, subscriber counts)
                    send('phase', { phase: 'stats', message: `Fetching stats for ${totalChannels} channels...` });
                    const statsMap = await fetchChannelStats(channelIds);

                    // Phase 2: Fetch activities per channel
                    const allVideos: FirestoreYouTubeVideo[] = [];
                    let videosWritten = 0;

                    for (let i = 0; i < channels.length; i++) {
                        const channel = channels[i];
                        send('progress', {
                            phase: 'fetching',
                            channel: channel.display_name,
                            channelIndex: i + 1,
                            totalChannels,
                            message: `Fetching ${channel.display_name} (${i + 1}/${totalChannels})...`,
                        });

                        const activities = await fetchChannelActivities(
                            channel.id,
                            publishedAfter,
                            publishedBefore,
                        );

                        const stats = statsMap.get(channel.id);
                        const category = channel.category as ChannelCategory;
                        const now = new Date().toISOString();

                        for (const activity of activities) {
                            const videoId = activity.contentDetails!.upload!.videoId;
                            const contentType = detectContentType(activity.snippet.title, category);
                            const thumb = activity.snippet.thumbnails?.high?.url || activity.snippet.thumbnails?.default?.url || '';

                            const doc: Omit<FirestoreYouTubeVideo, 'id'> = {
                                title: activity.snippet.title,
                                description: activity.snippet.description?.slice(0, 500) || '',
                                full_description: '', // Will be filled in Phase 2.5
                                thumbnail: thumb,
                                video_url: `https://youtube.com/watch?v=${videoId}`,
                                channel_id: channel.id,
                                channel_title: channel.display_name,
                                channel_avatar: stats?.avatarUrl || '',
                                content_type: contentType,
                                published_at: activity.snippet.publishedAt,
                                fetched_at: now,
                                duration: '',
                                view_count: 0,
                                like_count: 0,
                                tags: [],
                            };

                            const ok = await firestoreRestClient.createDocument(
                                COLLECTIONS.VIDEOS,
                                videoId,
                                doc,
                            );
                            if (ok) videosWritten++;
                            allVideos.push({ id: videoId, ...doc });
                        }

                        // Update channel's last_backfilled_at
                        await firestoreRestClient.updateDocument(
                            COLLECTIONS.CHANNELS,
                            channel.id,
                            { last_backfilled_at: new Date().toISOString() },
                        );

                        send('channel_done', {
                            channel: channel.display_name,
                            videosFound: activities.length,
                            totalVideosSoFar: allVideos.length,
                        });
                    }

                    console.log(`[Backfill] Found ${allVideos.length} videos for ${date}`);

                    // Phase 2.5: Fetch full video details (descriptions, durations, stats)
                    if (allVideos.length > 0) {
                        send('phase', { phase: 'video_details', message: `Fetching full details for ${allVideos.length} videos...` });
                        const videoIds = allVideos.map(v => v.id);
                        const detailsMap = await fetchVideoDetails(videoIds);

                        let detailsUpdated = 0;
                        for (const video of allVideos) {
                            const details = detailsMap.get(video.id);
                            if (details) {
                                const update: Record<string, unknown> = {
                                    full_description: details.snippet?.description || '',
                                    duration: details.contentDetails?.duration || '',
                                    view_count: parseInt(details.statistics?.viewCount || '0'),
                                    like_count: parseInt(details.statistics?.likeCount || '0'),
                                    tags: details.snippet?.tags || [],
                                };

                                await firestoreRestClient.updateDocument(
                                    COLLECTIONS.VIDEOS,
                                    video.id,
                                    update,
                                );

                                // Update local copy too (for AI analysis below)
                                video.full_description = update.full_description as string;
                                video.duration = update.duration as string;
                                video.view_count = update.view_count as number;
                                video.like_count = update.like_count as number;
                                video.tags = update.tags as string[];

                                detailsUpdated++;
                            }
                        }
                        console.log(`[Backfill] Updated details for ${detailsUpdated} videos`);
                    }

                    // Phase 3: AI analysis per hour
                    send('phase', {
                        phase: 'writing_done',
                        message: `Found ${videosWritten} videos with full details. Starting AI analysis...`,
                        totalVideos: videosWritten,
                    });

                    const hourGroups = groupVideosByHour(allVideos);
                    let analysesWritten = 0;
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

                        // Generate AI summary (with retry callback for SSE)
                        const { summary, model: usedModel } = await generateHourlySummary(
                            videosInHour.map(v => ({
                                title: v.title,
                                channel_title: v.channel_title,
                                content_type: v.content_type,
                                published_at: v.published_at,
                            })),
                            hour,
                            date,
                            ({ attempt, maxRetries, retryDelaySeconds }) => {
                                send('retry', {
                                    hour,
                                    hourFormatted: `${String(hour).padStart(2, '0')}:00`,
                                    attempt,
                                    maxRetries,
                                    retryDelaySeconds,
                                    message: `Rate limited. Retrying in ${retryDelaySeconds}s (attempt ${attempt}/${maxRetries})...`,
                                });
                            },
                        );

                        const analysisDoc: Omit<FirestoreHourlyAnalysis, 'id'> = {
                            date,
                            hour,
                            summary,
                            video_count: videosInHour.length,
                            content_type_breakdown: typeBreakdown,
                            channels_active: [...channelsActive],
                            generated_at: now,
                            model: usedModel,
                            channels_fetched: channelIds,
                            backfill_duration_ms: Date.now() - backfillStart,
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
                        });

                        // Rate limit: only delay if hour had content (triggered a real API call)
                        if (videosInHour.length > 0) {
                            await new Promise(r => setTimeout(r, 5000));
                        }
                    }

                    console.log(`[Backfill] Complete: ${videosWritten} videos, ${analysesWritten} analyses for ${date}`);

                    send('done', {
                        date,
                        videos_written: videosWritten,
                        analyses_written: analysesWritten,
                        duration_ms: Date.now() - backfillStart,
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
