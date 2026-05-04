import { NextResponse } from 'next/server';
import { YOUTUBE_CHANNELS } from '@/features/social-pulse/data/youtubeChannels';

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;

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
        playlistItem?: { resourceId: { videoId: string } };
    };
}

interface YouTubeChannelStats {
    subscriberCount: string;
    videoCount: string;
    viewCount: string;
}

/**
 * GET /api/social-feed/youtube
 * 
 * Fetches recent activities from configured YouTube channels.
 * Uses the YouTube Data API v3 `activities.list` endpoint.
 * 
 * Query params:
 *   - maxResults (optional, default 5 per channel, max 50)
 */
export async function GET(request: Request) {
    if (!YOUTUBE_API_KEY) {
        return NextResponse.json(
            { success: false, error: 'YOUTUBE_API_KEY not configured' },
            { status: 500 }
        );
    }

    const { searchParams } = new URL(request.url);
    const maxResults = Math.min(parseInt(searchParams.get('maxResults') || '5'), 50);

    try {
        const channelIds = YOUTUBE_CHANNELS.map(c => c.channel_id);

        // 1. Fetch activities for all channels (batch into comma-separated list)
        const activitiesUrl = new URL('https://www.googleapis.com/youtube/v3/activities');
        activitiesUrl.searchParams.set('part', 'snippet,contentDetails');
        activitiesUrl.searchParams.set('channelId', channelIds.join(','));
        activitiesUrl.searchParams.set('maxResults', String(maxResults));
        activitiesUrl.searchParams.set('key', YOUTUBE_API_KEY);

        // YouTube activities.list doesn't support comma-separated channelIds.
        // We need to fetch per-channel, but parallelize.
        const activityPromises = channelIds.map(async (channelId) => {
            const url = new URL('https://www.googleapis.com/youtube/v3/activities');
            url.searchParams.set('part', 'snippet,contentDetails');
            url.searchParams.set('channelId', channelId);
            url.searchParams.set('maxResults', String(maxResults));
            url.searchParams.set('key', YOUTUBE_API_KEY!);

            const res = await fetch(url.toString(), { next: { revalidate: 3600 } }); // Cache 1 hour
            if (!res.ok) return { items: [] };
            const data = await res.json();
            return data;
        });

        // 2. Fetch channel stats + avatars (subscriber count, profile picture)
        const statsUrl = new URL('https://www.googleapis.com/youtube/v3/channels');
        statsUrl.searchParams.set('part', 'statistics,snippet');
        statsUrl.searchParams.set('id', channelIds.join(','));
        statsUrl.searchParams.set('key', YOUTUBE_API_KEY);

        const [activityResults, statsResponse] = await Promise.all([
            Promise.all(activityPromises),
            fetch(statsUrl.toString(), { next: { revalidate: 3600 } }).then(r => r.json()),
        ]);

        // 3. Build channel stats map
        const statsMap = new Map<string, YouTubeChannelStats & { avatar_url?: string }>();
        for (const item of (statsResponse.items || [])) {
            statsMap.set(item.id, {
                ...item.statistics,
                avatar_url: item.snippet?.thumbnails?.high?.url || item.snippet?.thumbnails?.default?.url,
            });
        }

        // 4. Map activities to our post format
        const posts = activityResults.flatMap((result, index) => {
            const channelConfig = YOUTUBE_CHANNELS[index];
            const items: YouTubeActivity[] = result.items || [];

            return items
                .filter(a => a.snippet.type === 'upload' && a.contentDetails?.upload?.videoId)
                .map((activity) => {
                    const videoId = activity.contentDetails!.upload!.videoId;
                    const stats = statsMap.get(channelConfig.channel_id);

                    return {
                        id: activity.id,
                        account_id: channelConfig.account_id,
                        content: activity.snippet.title,
                        description: activity.snippet.description?.slice(0, 300) || '',
                        timestamp: activity.snippet.publishedAt,
                        video_id: videoId,
                        video_url: `https://youtube.com/watch?v=${videoId}`,
                        thumbnail: activity.snippet.thumbnails?.high?.url || activity.snippet.thumbnails?.default?.url,
                        channel_avatar: stats?.avatar_url,
                        channel_stats: stats ? {
                            subscriber_count: stats.subscriberCount,
                            video_count: stats.videoCount,
                            view_count: stats.viewCount,
                        } : null,
                    };
                });
        });

        // Sort by most recent first
        posts.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

        return NextResponse.json({
            success: true,
            data: {
                posts,
                fetched_at: new Date().toISOString(),
                channel_count: channelIds.length,
            },
        });
    } catch (error) {
        console.error('[YouTube API Error]', error);
        return NextResponse.json(
            { success: false, error: 'Failed to fetch YouTube data' },
            { status: 500 }
        );
    }
}
