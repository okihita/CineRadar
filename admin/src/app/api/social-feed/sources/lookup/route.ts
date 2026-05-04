/**
 * GET /api/social-feed/sources/lookup?channel_id=UCxxx
 *
 * Admin-only: look up a YouTube channel's name, avatar, subscriber count.
 * Used by the "Add Source" dialog to auto-fill fields.
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;

function isAdmin(session: unknown): boolean {
    return (session as { user?: { role?: string } })?.user?.role === 'admin';
}

export async function GET(request: NextRequest) {
    const session = await auth();
    if (!session) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    if (!isAdmin(session)) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });

    const channelId = request.nextUrl.searchParams.get('channel_id');
    if (!channelId) {
        return NextResponse.json({ success: false, error: 'Missing channel_id parameter' }, { status: 400 });
    }

    if (!YOUTUBE_API_KEY) {
        return NextResponse.json({ success: false, error: 'YouTube API key not configured' }, { status: 500 });
    }

    try {
        const url = new URL('https://www.googleapis.com/youtube/v3/channels');
        url.searchParams.set('part', 'snippet,statistics');
        url.searchParams.set('id', channelId);
        url.searchParams.set('key', YOUTUBE_API_KEY);

        const res = await fetch(url.toString(), { cache: 'no-store' });
        if (!res.ok) {
            const errText = await res.text();
            return NextResponse.json({ success: false, error: `YouTube API error: ${res.status}` }, { status: 502 });
        }

        const data = await res.json();
        const item = data.items?.[0];

        if (!item) {
            return NextResponse.json({ success: false, error: 'Channel not found' }, { status: 404 });
        }

        return NextResponse.json({
            success: true,
            data: {
                channel_id: item.id,
                display_name: item.snippet?.title || '',
                handle: item.snippet?.customUrl || `@${item.snippet?.title?.replace(/\s+/g, '') || ''}`,
                avatar_url: item.snippet?.thumbnails?.high?.url || item.snippet?.thumbnails?.default?.url || '',
                subscriber_count: parseInt(item.statistics?.subscriberCount || '0'),
                video_count: parseInt(item.statistics?.videoCount || '0'),
            },
        });
    } catch (error) {
        console.error('[YouTube Lookup Error]', error);
        return NextResponse.json({ success: false, error: 'Lookup failed' }, { status: 500 });
    }
}
