/**
 * GET /api/social-feed/sources/lookup?q=...
 *
 * Admin-only: look up a YouTube channel's name, avatar, subscriber count.
 * Accepts: channel ID (UCxxx), handle (@handle or plain), or full YouTube URL.
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { isAdmin } from '@/lib/auth-helpers';

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;

/**
 * Parse user input into the right YouTube API lookup strategy.
 * Returns { method, value } where method is 'id' | 'forHandle'.
 */
function parseInput(raw: string): { method: string; value: string } | null {
    const input = raw.trim();
    if (!input) return null;

    // Full URL: https://www.youtube.com/@handle or /channel/UCxxx or /c/name or /handle
    const urlMatch = input.match(/(?:https?:\/\/)?(?:www\.)?youtube\.com\/(?:@|c\/|channel\/)?([^\s/?]+)/);
    if (urlMatch) {
        const segment = urlMatch[1];
        // If it's a channel ID path
        if (segment.startsWith('UC') && segment.length >= 20) {
            return { method: 'id', value: segment };
        }
        // Otherwise treat as handle
        return { method: 'forHandle', value: segment.replace(/^@/, '') };
    }

    // Raw channel ID (UC...)
    if (/^UC[\w-]{16,}$/.test(input)) {
        return { method: 'id', value: input };
    }

    // Handle with or without @
    const handle = input.replace(/^@/, '');
    if (handle) {
        return { method: 'forHandle', value: handle };
    }

    return null;
}

export async function GET(request: NextRequest) {
    const session = await auth();
    if (!session) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    if (!isAdmin(session)) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });

    const rawQuery = request.nextUrl.searchParams.get('q') || request.nextUrl.searchParams.get('channel_id');
    if (!rawQuery) {
        return NextResponse.json({ success: false, error: 'Missing query parameter (q)' }, { status: 400 });
    }

    if (!YOUTUBE_API_KEY) {
        return NextResponse.json({ success: false, error: 'YouTube API key not configured' }, { status: 500 });
    }

    const parsed = parseInput(rawQuery);
    if (!parsed) {
        return NextResponse.json({ success: false, error: 'Could not parse input' }, { status: 400 });
    }

    try {
        const url = new URL('https://www.googleapis.com/youtube/v3/channels');
        url.searchParams.set('part', 'snippet,statistics');
        url.searchParams.set(parsed.method, parsed.value);
        url.searchParams.set('key', YOUTUBE_API_KEY);

        const res = await fetch(url.toString(), { cache: 'no-store' });
        if (!res.ok) {
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
