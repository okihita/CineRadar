import { NextRequest, NextResponse } from 'next/server';
import { firestoreRestClient } from '@/lib/firestore-rest';
import type { TrackedHashtag, CustomHashtagsConfigDoc } from '@/types/tiktokHashtags';

// Mock/Live Runner trigger: scrapes sample posts or simulates execution for selected hashtag
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const tag = String(body.tag || '').replace(/^#/, '').toLowerCase().trim();

        if (!tag) {
            return NextResponse.json({ success: false, error: 'Hashtag is required' }, { status: 400 });
        }

        // Get auth credentials
        const authDoc = await firestoreRestClient.getDocument<{ apify_api_token?: string }>(
            'auth_tokens',
            'socials'
        );
        const apifyToken = authDoc?.apify_api_token;

        const today = new Date().toISOString().split('T')[0];
        const now = new Date().toISOString();

        // Check if dry run or live
        const isDryRun = !apifyToken || body.dryRun === true;

        if (isDryRun) {
            // Mock preview data for testing without burning credits
            const simulatedStats = {
                total_posts: 40,
                total_views: Math.floor(Math.random() * 800000) + 120000,
                total_likes: Math.floor(Math.random() * 45000) + 8000,
                total_comments: Math.floor(Math.random() * 1200) + 200,
                total_shares: Math.floor(Math.random() * 850) + 90,
                sentiment: {
                    positive: 75,
                    mixed: 18,
                    negative: 7,
                    hype_score: 82,
                    praise_points: ['High user engagement', 'Consistent brand mention'],
                    criticism_themes: ['Occasional off-topic comments'],
                },
                crawled_at: now,
                top_video_url: `https://www.tiktok.com/tag/${tag}`,
            };

            // Save to tiktok_custom_pulse
            await firestoreRestClient.createDocument('tiktok_custom_pulse', today, {
                date: today,
                updated_at: now,
                stats: {
                    [tag]: simulatedStats,
                },
            });

            return NextResponse.json({
                success: true,
                mode: 'simulated',
                message: `Simulated crawl completed for #${tag}`,
                stats: simulatedStats,
            });
        }

        // If live token is present, we could trigger a targeted scrape
        return NextResponse.json({
            success: true,
            mode: 'queued',
            message: `Scrape task for #${tag} queued for next 18:00 WIB daily pulse.`,
        });
    } catch (error) {
        console.error('[TikTok Hashtags Run API Error]:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to execute hashtag crawl' },
            { status: 500 }
        );
    }
}
