/**
 * POST /api/social-feed/backfill
 *
 * Backfills YouTube data for a given date into Firestore,
 * then generates per-hour AI analysis via Gemini.
 *
 * Sources are read from beta_social_sources (Firestore).
 * Full video details fetched via videos.list (descriptions, duration, stats).
 * Posts written with denormalized source info for historical integrity.
 *
 * Returns Server-Sent Events (SSE) for live progress updates.
 *
 * Body: { date: "2026-05-04" }
 */

import { NextResponse } from 'next/server';
import { detectContentType } from '@/features/social-pulse/data/mockSocialFeed';
import { firestoreRestClient } from '@/lib/firestore-rest';
import { summarizeHour } from '@/lib/summarize';
import {
    COLLECTIONS,
    makeHourId,
    type FirestoreSocialPost,
    type FirestoreSocialSource,
    type SourceCategory,
} from '@/lib/firestore-social';

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
        duration?: string;
    };
    statistics?: {
        viewCount?: string;
        likeCount?: string;
    };
}

// ─── YouTube API helpers ───────────────────────────────

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

async function fetchVideoDetails(videoIds: string[]): Promise<Map<string, VideoDetails>> {
    const map = new Map<string, VideoDetails>();
    if (!YOUTUBE_API_KEY || videoIds.length === 0) return map;

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

/** Load active sources from Firestore */
async function loadActiveSources(): Promise<FirestoreSocialSource[]> {
    const allSources = await firestoreRestClient.runQuery<FirestoreSocialSource>({
        from: [{ collectionId: COLLECTIONS.SOURCES }],
        where: {
            fieldFilter: {
                field: { fieldPath: 'active' },
                op: 'EQUAL',
                value: { booleanValue: true },
            },
        },
    });
    // Only YouTube sources for now
    return allSources.filter(s => s.platform === 'youtube');
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

        const encoder = new TextEncoder();
        const stream = new ReadableStream({
            async start(controller) {
                const send = (event: string, data: unknown) => {
                    controller.enqueue(encoder.encode(sseEvent(event, data)));
                };

                try {
                    // Phase 0: Load sources from Firestore
                    send('phase', { phase: 'loading_sources', message: 'Loading sources from database...' });
                    const sources = await loadActiveSources();

                    if (sources.length === 0) {
                        send('error', { message: 'No active sources found. Run /api/social-feed/seed first.' });
                        controller.close();
                        return;
                    }

                    const totalSources = sources.length;

                    // Extract YouTube channel IDs from source IDs (format: "youtube_UC...")
                    const sourcesWithChannelId = sources.map(s => ({
                        source: s,
                        channelId: s.id.replace('youtube_', ''),
                    }));
                    const channelIds = sourcesWithChannelId.map(s => s.channelId);

                    // Phase 1: Fetch channel stats (avatars, subscriber counts)
                    send('phase', { phase: 'stats', message: `Fetching stats for ${totalSources} channels...` });
                    const statsMap = await fetchChannelStats(channelIds);

                    // Phase 2: Fetch activities per channel
                    const allPosts: FirestoreSocialPost[] = [];
                    let postsWritten = 0;

                    for (let i = 0; i < sourcesWithChannelId.length; i++) {
                        const { source, channelId } = sourcesWithChannelId[i];
                        send('progress', {
                            phase: 'fetching',
                            channel: source.display_name,
                            channelIndex: i + 1,
                            totalChannels: totalSources,
                            message: `Fetching ${source.display_name} (${i + 1}/${totalSources})...`,
                        });

                        const activities = await fetchChannelActivities(
                            channelId,
                            publishedAfter,
                            publishedBefore,
                        );

                        const stats = statsMap.get(channelId);
                        const category = source.category as SourceCategory;
                        const now = new Date().toISOString();

                        for (const activity of activities) {
                            const videoId = activity.contentDetails!.upload!.videoId;
                            const contentType = detectContentType(activity.snippet.title, category);
                            const thumb = activity.snippet.thumbnails?.high?.url || activity.snippet.thumbnails?.default?.url || '';
                            const postDocId = `youtube_${videoId}`;

                            const doc: Omit<FirestoreSocialPost, 'id'> = {
                                platform: 'youtube',
                                title: activity.snippet.title,
                                text: '', // Will be filled with full_description after Phase 2.5
                                url: `https://youtube.com/watch?v=${videoId}`,
                                published_at: activity.snippet.publishedAt,
                                fetched_at: now,
                                source_id: source.id,
                                source_name: source.display_name,
                                source_handle: source.handle,
                                source_avatar: stats?.avatarUrl || source.avatar_url || '',
                                source_category: source.category,
                                content_type: contentType,
                                thumbnail: thumb,
                                media: [{ type: 'video', url: thumb }],
                                metrics: { views: 0, likes: 0 },
                                platform_data: { video_id: videoId },
                                // YouTube backward compat
                                description: activity.snippet.description?.slice(0, 500) || '',
                                full_description: '',
                                video_url: `https://youtube.com/watch?v=${videoId}`,
                                channel_id: channelId,
                                channel_title: source.display_name,
                                channel_avatar: stats?.avatarUrl || source.avatar_url || '',
                                duration: '',
                                view_count: 0,
                                like_count: 0,
                                tags: [],
                            };

                            const ok = await firestoreRestClient.createDocument(
                                COLLECTIONS.POSTS,
                                postDocId,
                                doc,
                            );
                            if (ok) postsWritten++;
                            allPosts.push({ id: postDocId, ...doc });
                        }

                        // Update source's last_fetched_at
                        await firestoreRestClient.updateDocument(
                            COLLECTIONS.SOURCES,
                            source.id,
                            { last_fetched_at: new Date().toISOString() },
                        );

                        send('channel_done', {
                            channel: source.display_name,
                            videosFound: activities.length,
                            totalVideosSoFar: allPosts.length,
                        });
                    }

                    console.log(`[Backfill] Found ${allPosts.length} posts for ${date}`);

                    // Phase 2.5: Fetch full video details (descriptions, durations, stats)
                    if (allPosts.length > 0) {
                        send('phase', { phase: 'video_details', message: `Fetching full details for ${allPosts.length} videos...` });
                        // Extract video IDs from post IDs (format: "youtube_{videoId}")
                        const videoIds = allPosts.map(p => p.id.replace('youtube_', ''));
                        const detailsMap = await fetchVideoDetails(videoIds);

                        let detailsUpdated = 0;
                        for (const post of allPosts) {
                            const videoId = post.platform_data?.video_id || post.id.replace('youtube_', '');
                            const details = detailsMap.get(videoId);
                            if (details) {
                                const fullDesc = details.snippet?.description || '';
                                const dur = details.contentDetails?.duration || '';
                                const views = parseInt(details.statistics?.viewCount || '0');
                                const likes = parseInt(details.statistics?.likeCount || '0');
                                const vidTags = details.snippet?.tags || [];

                                const update: Record<string, unknown> = {
                                    text: fullDesc,
                                    full_description: fullDesc,
                                    duration: dur,
                                    view_count: views,
                                    like_count: likes,
                                    tags: vidTags,
                                    metrics: { views, likes },
                                    platform_data: { video_id: videoId, duration: dur, tags: vidTags },
                                };

                                await firestoreRestClient.updateDocument(
                                    COLLECTIONS.POSTS,
                                    post.id,
                                    update,
                                );

                                // Update local copy too (for AI analysis)
                                post.text = fullDesc;
                                post.full_description = fullDesc;
                                post.duration = dur;
                                post.view_count = views;
                                post.like_count = likes;
                                post.tags = vidTags;
                                if (post.metrics) {
                                    post.metrics.views = views;
                                    post.metrics.likes = likes;
                                }
                                if (post.platform_data) {
                                    post.platform_data.duration = dur;
                                    post.platform_data.tags = vidTags;
                                }

                                detailsUpdated++;
                            }
                        }
                        console.log(`[Backfill] Updated details for ${detailsUpdated} videos`);
                    }

                    // Phase 3: AI analysis per hour
                    send('phase', {
                        phase: 'writing_done',
                        message: `Found ${postsWritten} posts with full details. Starting AI analysis...`,
                        totalVideos: postsWritten,
                    });

                    let analysesWritten = 0;
                    let completedHours = 0;
                    const sourceIds = sources.map(s => s.id);

                    for (let hour = 0; hour < 24; hour++) {
                        const result = await summarizeHour(date, hour, {
                            existingPosts: allPosts,
                            sourceIds,
                            onRetry: ({ attempt, maxRetries, retryDelaySeconds }) => {
                                send('retry', {
                                    hour,
                                    hourFormatted: `${String(hour).padStart(2, '0')}:00`,
                                    attempt,
                                    maxRetries,
                                    retryDelaySeconds,
                                    message: `Rate limited. Retrying in ${retryDelaySeconds}s (attempt ${attempt}/${maxRetries})...`,
                                });
                            },
                        });

                        if (result.success || result.postCount > 0) analysesWritten++;
                        completedHours++;

                        send('hour_done', {
                            hour,
                            hourFormatted: `${String(hour).padStart(2, '0')}:00`,
                            videoCount: result.postCount,
                            summary: result.summary.slice(0, 120) + (result.summary.length > 120 ? '...' : ''),
                            fullSummary: result.summary,
                            hashtags: result.hashtags.slice(0, 10),
                            completedHours,
                            totalHours: 24,
                            progress: Math.round((completedHours / 24) * 100),
                        });

                        // Rate limit: only delay if hour had content (triggered a real API call)
                        if (result.postCount > 0) {
                            await new Promise(r => setTimeout(r, 5000));
                        }
                    }

                    console.log(`[Backfill] Complete: ${postsWritten} posts, ${analysesWritten} analyses for ${date}`);

                    send('done', {
                        date,
                        videos_written: postsWritten,
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
