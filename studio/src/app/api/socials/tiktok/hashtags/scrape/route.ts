import { NextRequest, NextResponse } from 'next/server';
import { firestoreRestClient } from '@/lib/firestore-rest';
import { getTodayJakarta } from '@/lib/timeUtils';
import { GoogleGenerativeAI } from '@google/generative-ai';
import type {
    TrackedHashtag,
    HashtagPulseStats,
    TikTokPostItem,
    TikTokHashtagDetailSnapshot,
} from '@/types/tiktokHashtags';

interface ScrapeRequestBody {
    tag: string;
    force?: boolean;
    dryRun?: boolean;
    targetPosts?: number;
}

const COOLDOWN_MS = 15 * 60 * 1000; // 15 minutes cooldown

export async function POST(req: NextRequest) {
    try {
        const body: ScrapeRequestBody = await req.json();
        const cleanTag = String(body.tag || '')
            .replace(/^#/, '')
            .toLowerCase()
            .trim();

        if (!cleanTag) {
            return NextResponse.json(
                { success: false, error: 'Valid hashtag is required' },
                { status: 400 }
            );
        }

        // 1. Fetch hashtag configuration from Firestore
        const tagDoc = await firestoreRestClient.getDocument<TrackedHashtag>(
            'tiktok_tracked_hashtags',
            cleanTag
        );

        const targetPosts = Math.min(
            body.targetPosts || tagDoc?.target_posts || 40,
            100
        );
        const includeComments = tagDoc ? tagDoc.include_comments !== false : true;

        // 2. Enforce 15-minute cooldown guard unless force=true or dryRun=true
        const nowMs = Date.now();
        const nowIso = new Date().toISOString();
        const lastScrapedMs = tagDoc?.last_scraped_at
            ? new Date(tagDoc.last_scraped_at).getTime()
            : 0;

        if (
            !body.force &&
            !body.dryRun &&
            lastScrapedMs > 0 &&
            nowMs - lastScrapedMs < COOLDOWN_MS
        ) {
            const remainingSeconds = Math.ceil((COOLDOWN_MS - (nowMs - lastScrapedMs)) / 1000);
            return NextResponse.json(
                {
                    success: false,
                    cooldown: true,
                    remaining_seconds: remainingSeconds,
                    error: `Cooldown active: #${cleanTag} was scraped recently. Please wait ${Math.ceil(remainingSeconds / 60)} minutes or use force override.`,
                },
                { status: 429 }
            );
        }

        // 3. Load credentials from auth_tokens/socials
        const authDoc = await firestoreRestClient.getDocument<{
            apify_api_token?: string;
            gemini_tiktok_api_key?: string;
        }>('auth_tokens', 'socials');

        const apifyToken = authDoc?.apify_api_token?.trim();
        const geminiApiKey = authDoc?.gemini_tiktok_api_key?.trim();

        const isDryRun = body.dryRun === true || !apifyToken;
        const today = getTodayJakarta();

        let posts: TikTokPostItem[] = [];
        let summaryStats: HashtagPulseStats;

        if (isDryRun) {
            // Generate realistic simulated intelligence dataset
            const sampleCreators = [
                { handle: 'sinemania_id', name: 'Sinemania Indonesia' },
                { handle: 'movietalk_jkt', name: 'Movie Talk Jakarta' },
                { handle: 'layarlebar_id', name: 'Layar Lebar ID' },
                { handle: 'nontoners', name: 'Nonton Bareng Cinema' },
                { handle: 'filmnasional', name: 'Pecinta Film Indo' },
                { handle: 'popcornbuzz', name: 'Popcorn Buzz Media' },
                { handle: 'boxoffice_radar', name: 'Box Office Radar' },
                { handle: 'hypecinemajkt', name: 'Hype Cinema Jakarta' },
            ];

            const sampleCaptions = [
                `Kaget banget sama plot twist #${cleanTag}! Aktingnya bener-bener solid, wajib nonton di bioskop weekend ini!`,
                `Review jujur nonton #${cleanTag}: CGI dan sound design mantap, cuma pacing babak kedua agak lambat. Overall 8/10!`,
                `Gokil rame banget studio pas nonton #${cleanTag}. Reaksi penonton seru abis pas adegan puncaknya!`,
                `Siapa yang udah nonton #${cleanTag}? Scene post-credit beneran bikin merinding! Ada hint buat sekuel?`,
                `POV: Lo lagi nonton #${cleanTag} sendirian di baris belakang bioskop. Seremnya dapet banget!`,
                `Soundtrack #${cleanTag} terngiang-ngiang terus di kepala. Scoring musiknya juara kelas festival!`,
                `Rekomendasi tontonan akhir pekan: #${cleanTag}. Worth every rupiah tiket XXI dan CGV!`,
                `Karakter utamanya deep banget di #${cleanTag}. Salah satu film lokal terbaik tahun ini!`,
            ];

            const generatedCount = Math.min(targetPosts, 12);
            for (let i = 0; i < generatedCount; i++) {
                const creator = sampleCreators[i % sampleCreators.length];
                const views = Math.floor(Math.random() * 650000) + 45000;
                const likes = Math.floor(views * (Math.random() * 0.08 + 0.04));
                const comments = Math.floor(likes * (Math.random() * 0.04 + 0.015));
                const shares = Math.floor(likes * (Math.random() * 0.03 + 0.01));

                posts.push({
                    id: `sim_${cleanTag}_${i + 1}_${Date.now()}`,
                    url: `https://www.tiktok.com/@${creator.handle}/video/73000000000000000${i}`,
                    author_handle: `@${creator.handle}`,
                    author_name: creator.name,
                    caption: sampleCaptions[i % sampleCaptions.length],
                    hashtags: [cleanTag, 'filmbioskop', 'cineradar', 'moviereview'],
                    views,
                    likes,
                    comments,
                    shares,
                    published_at: new Date(Date.now() - (i * 3600 * 4000)).toISOString(),
                });
            }

            posts.sort((a, b) => b.views - a.views);

            const totalViews = posts.reduce((sum, p) => sum + p.views, 0);
            const totalLikes = posts.reduce((sum, p) => sum + p.likes, 0);
            const totalComments = posts.reduce((sum, p) => sum + p.comments, 0);
            const totalShares = posts.reduce((sum, p) => sum + p.shares, 0);

            summaryStats = {
                total_posts: posts.length,
                total_views: totalViews,
                total_likes: totalLikes,
                total_comments: totalComments,
                total_shares: totalShares,
                sentiment: {
                    positive: 78,
                    mixed: 16,
                    negative: 6,
                    hype_score: 84,
                    praise_points: [
                        'Pujian kuat terhadap akting pemain dan intensitas cerita',
                        'Rekomendasi viral tinggi untuk tontonan bioskop akhir pekan',
                    ],
                    criticism_themes: [
                        'Keluhan minor terkait pacing di paruh kedua durasi film',
                    ],
                },
                cadence: tagDoc?.cadence ?? 1,
                start_hour: tagDoc?.start_hour ?? 18,
                crawled_at: nowIso,
                top_video_url: posts[0]?.url || `https://www.tiktok.com/tag/${cleanTag}`,
            };
        } else {
            // Live Apify scraping execution
            const formattedTag = `https://www.tiktok.com/tag/${cleanTag}`;
            const actorUrl = `https://api.apify.com/v2/acts/clockworks~tiktok-scraper/run-sync-get-dataset-items?token=${apifyToken}`;

            const apifyRes = await fetch(actorUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    hashtags: [formattedTag],
                    resultsPerPage: targetPosts,
                    shouldDownloadVideos: false,
                    shouldDownloadCovers: false,
                }),
                signal: AbortSignal.timeout(75000),
            });

            if (!apifyRes.ok) {
                const errText = await apifyRes.text();
                return NextResponse.json(
                    {
                        success: false,
                        error: `Apify Actor error (${apifyRes.status}): ${errText.slice(0, 300)}`,
                    },
                    { status: 502 }
                );
            }

            const rawItems = await apifyRes.json();
            if (!Array.isArray(rawItems) || rawItems.length === 0) {
                return NextResponse.json(
                    {
                        success: false,
                        error: `No TikTok posts found for tag #${cleanTag}. Verify that the hashtag has public video traffic.`,
                    },
                    { status: 404 }
                );
            }

            // Sanitize raw posts
            const seenIds = new Set<string>();
            for (const item of rawItems) {
                if (!item || typeof item !== 'object') continue;
                const p = item as Record<string, unknown>;
                const id = String(p.id || '');
                if (!id || seenIds.has(id)) continue;
                seenIds.add(id);

                const authorMeta = (p.authorMeta as Record<string, unknown>) || {};
                const handle = String(authorMeta.nickName || authorMeta.name || 'creator');
                const name = String(authorMeta.name || handle);
                const caption = String(p.text || p.caption || '');
                const url = String(p.webVideoUrl || p.url || `https://www.tiktok.com/@${handle}/video/${id}`);

                const rawTags = (p.hashtags as unknown[]) || [];
                const tags: string[] = [];
                for (const t of rawTags) {
                    if (typeof t === 'string') tags.push(t.replace('#', '').toLowerCase());
                    else if (t && typeof t === 'object' && 'name' in t) {
                        tags.push(String((t as { name: unknown }).name).replace('#', '').toLowerCase());
                    }
                }

                posts.push({
                    id,
                    url,
                    author_handle: `@${handle.replace(/^@/, '')}`,
                    author_name: name,
                    caption: caption.slice(0, 400),
                    hashtags: Array.from(new Set(tags)),
                    views: Number(p.playCount || p.views || 0),
                    likes: Number(p.diggCount || p.likes || 0),
                    comments: Number(p.commentCount || 0),
                    shares: Number(p.shareCount || 0),
                    published_at: String(p.createTimeISO || p.published_at || nowIso),
                });
            }

            posts.sort((a, b) => b.views - a.views);
            posts = posts.slice(0, targetPosts);

            const totalViews = posts.reduce((sum, p) => sum + p.views, 0);
            const totalLikes = posts.reduce((sum, p) => sum + p.likes, 0);
            const totalComments = posts.reduce((sum, p) => sum + p.comments, 0);
            const totalShares = posts.reduce((sum, p) => sum + p.shares, 0);

            // Fetch comments if configured
            let audienceComments: string[] = [];
            if (includeComments && posts.length > 0) {
                const topVideoUrls = posts.slice(0, 2).map((p) => p.url);
                try {
                    const commentsUrl = `https://api.apify.com/v2/acts/clockworks~tiktok-comments-scraper/run-sync-get-dataset-items?token=${apifyToken}`;
                    const commentRes = await fetch(commentsUrl, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            postURLs: topVideoUrls,
                            commentsPerPost: 15,
                        }),
                        signal: AbortSignal.timeout(45000),
                    });

                    if (commentRes.ok) {
                        const rawComments = await commentRes.json();
                        if (Array.isArray(rawComments)) {
                            for (const c of rawComments) {
                                if (c && typeof c === 'object' && c.text) {
                                    audienceComments.push(String(c.text).trim());
                                }
                            }
                        }
                    }
                } catch (e) {
                    console.warn(`[Live Scrape Comments Warning] #${cleanTag}:`, e);
                }
            }

            // Sentiment Analysis via Gemini Flash
            let sentimentResult = {
                positive: 75,
                mixed: 18,
                negative: 7,
                hype_score: 80,
                praise_points: ['Trafik video viral terpantau aktif di TikTok'],
                criticism_themes: [] as string[],
            };

            if (geminiApiKey && audienceComments.length > 0) {
                try {
                    const genAI = new GoogleGenerativeAI(geminiApiKey);
                    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
                    const sampleComments = audienceComments.slice(0, 50).map((c) => `- ${c}`).join('\n');
                    const prompt = `You are CineRadar's box office sentiment analyst. Analyze these real Indonesian audience comments for the hashtag campaign "#${cleanTag}".
Comments:
${sampleComments}

Return a STRICT JSON object with these exact keys:
{
  "positive": <integer percentage 0-100>,
  "mixed": <integer percentage 0-100>,
  "negative": <integer percentage 0-100>,
  "hype_score": <integer 1-100>,
  "praise_points": ["short praise highlight 1", "short praise highlight 2"],
  "criticism_themes": ["short criticism point 1", "short criticism point 2"]
}
Ensure positive + mixed + negative equals 100. Output JSON only without markdown fences.`;

                    const response = await model.generateContent(prompt);
                    const text = response.response.text().trim();
                    const cleanJson = text.replace(/```json/g, '').replace(/```/g, '').trim();
                    const parsed = JSON.parse(cleanJson);
                    if (parsed && typeof parsed.positive === 'number') {
                        sentimentResult = {
                            positive: parsed.positive,
                            mixed: parsed.mixed ?? 0,
                            negative: parsed.negative ?? 0,
                            hype_score: parsed.hype_score ?? 75,
                            praise_points: Array.isArray(parsed.praise_points) ? parsed.praise_points : [],
                            criticism_themes: Array.isArray(parsed.criticism_themes) ? parsed.criticism_themes : [],
                        };
                    }
                } catch (e) {
                    console.warn(`[Gemini Sentiment Warning] #${cleanTag}:`, e);
                }
            }

            summaryStats = {
                total_posts: posts.length,
                total_views: totalViews,
                total_likes: totalLikes,
                total_comments: totalComments,
                total_shares: totalShares,
                sentiment: sentimentResult,
                cadence: tagDoc?.cadence ?? 1,
                start_hour: tagDoc?.start_hour ?? 18,
                crawled_at: nowIso,
                top_video_url: posts[0]?.url || `https://www.tiktok.com/tag/${cleanTag}`,
            };
        }

        // 4. Atomic Firestore Persistence
        // A. Update summary document in tiktok_custom_pulse/{today}
        const existingPulseDoc = await firestoreRestClient.getDocument<{
            stats?: Record<string, HashtagPulseStats>;
        }>('tiktok_custom_pulse', today);

        const mergedStats = {
            ...(existingPulseDoc?.stats || {}),
            [cleanTag]: summaryStats,
        };

        if (existingPulseDoc) {
            await firestoreRestClient.updateDocument('tiktok_custom_pulse', today, {
                date: today,
                updated_at: nowIso,
                stats: mergedStats,
            });
        } else {
            await firestoreRestClient.createDocument('tiktok_custom_pulse', today, {
                date: today,
                updated_at: nowIso,
                stats: mergedStats,
            });
        }

        // B. Persist granular posts snapshot to subcollection tiktok_custom_pulse/{today}/hashtags/{cleanTag}
        const detailSnapshot: TikTokHashtagDetailSnapshot = {
            tag: cleanTag,
            label: tagDoc?.label || cleanTag,
            category: tagDoc?.category || 'general',
            date: today,
            crawled_at: nowIso,
            source: isDryRun ? 'simulated' : 'live_manual',
            total_posts: posts.length,
            total_views: summaryStats.total_views,
            total_likes: summaryStats.total_likes,
            total_comments: summaryStats.total_comments,
            total_shares: summaryStats.total_shares,
            sentiment: summaryStats.sentiment,
            posts,
        };

        const subcollectionPath = `tiktok_custom_pulse/${today}/hashtags`;
        const updatedDetail = await firestoreRestClient.updateDocument(
            subcollectionPath,
            cleanTag,
            detailSnapshot as unknown as Record<string, unknown>
        );
        if (!updatedDetail) {
            await firestoreRestClient.createDocument(
                subcollectionPath,
                cleanTag,
                detailSnapshot as unknown as Record<string, unknown>
            );
        }

        // C. Update tracked hashtag metadata with last_scraped_at
        if (tagDoc) {
            await firestoreRestClient.updateDocument('tiktok_tracked_hashtags', cleanTag, {
                last_scraped_at: nowIso,
                latest_stats: summaryStats,
                updated_at: nowIso,
            });
        }

        return NextResponse.json({
            success: true,
            mode: isDryRun ? 'simulated' : 'live',
            message: `Scrape completed for #${cleanTag}`,
            data: detailSnapshot,
        });
    } catch (error) {
        console.error('[TikTok Live Scrape Error]:', error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to execute live scrape',
            },
            { status: 500 }
        );
    }
}
