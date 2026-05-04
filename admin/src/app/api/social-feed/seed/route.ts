/**
 * POST /api/social-feed/seed
 *
 * One-time seed: populates beta_social_sources with 18 Indonesian cinema channels.
 * Safe to re-run — uses createDocument (idempotent, skips existing).
 *
 * Also fetches real subscriber counts + avatars from YouTube API.
 * Document IDs use the platform-agnostic format: "youtube_{channelId}"
 */

import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { firestoreRestClient } from '@/lib/firestore-rest';
import { COLLECTIONS, type FirestoreSocialSource, type SourceCategory } from '@/lib/firestore-social';

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;

interface ChannelSeed {
    channel_id: string;
    display_name: string;
    handle: string;
    category: SourceCategory;
    verified: boolean;
    active: boolean;
    notes: string;
}

const CHANNEL_SEEDS: ChannelSeed[] = [
    // ─── Distributors / Studios ────────────────────────
    { channel_id: 'UCQExjzw5-z1VE2Fcbd3ky9Q', display_name: 'MD Pictures', handle: '@MDPictures', category: 'distributor', verified: true, active: true, notes: 'Major Indonesian studio' },
    { channel_id: 'UCTi-irCm6xVzft7gh9ltRNQ', display_name: 'Rapi Films', handle: '@RapiFilms', category: 'distributor', verified: true, active: true, notes: 'Major Indonesian studio' },
    { channel_id: 'UCeGQiHPv-oFeQUNe9xQAoWQ', display_name: 'StarVision Plus', handle: '@StarVisionPlus', category: 'distributor', verified: true, active: true, notes: '~1.87M subs' },
    { channel_id: 'UC-khv-3jEhk6DN4KVglHYkA', display_name: 'Soraya Intercine Films', handle: '@SorayaIntercineFilms', category: 'distributor', verified: true, active: true, notes: '~103K subs' },
    { channel_id: 'UCwZfUUW2r0TtnXhDfb3DRgw', display_name: 'Warner Bros. Indonesia', handle: '@WarnerBrosID', category: 'distributor', verified: true, active: true, notes: '~121K subs' },
    { channel_id: 'UCaMUw3b9jDwmay8EKP7CBsg', display_name: 'Falcon Pictures', handle: '@FalconPictures', category: 'distributor', verified: true, active: false, notes: 'Very small YouTube presence (~12 subs). Verify manually.' },
    { channel_id: 'UCjTA5AcXGsksWEZkRvFO8mA', display_name: 'Visinema Pictures', handle: '@VisinemaPictures', category: 'distributor', verified: true, active: true, notes: 'Behind KKN, Pengabdi Setan 2. ~750K subs' },
    { channel_id: 'UC6RHORmRuCiGJQILQDu5B7Q', display_name: 'Screenplay Films', handle: '@ScreenplayFilms', category: 'distributor', verified: true, active: true, notes: 'Behind Dilan, AADC 2. ~180K subs' },
    { channel_id: 'UC1zZXckboolY8-GNVpU_ISQ', display_name: 'Miles Films', handle: '@MilesFilms', category: 'distributor', verified: true, active: true, notes: 'Behind Pengabdi Setan (2017). Joko Anwar.' },
    { channel_id: 'UCyEdDGN6e9NsATMCgTktXTQ', display_name: 'MVP Pictures', handle: '@mvpictures', category: 'distributor', verified: true, active: true, notes: 'Behind KKN di Desa Penari (10M+ admissions)' },
    { channel_id: 'UCrm3aF4Y1VGyEyUnEfXYY3A', display_name: 'BASE Films', handle: '@BASEFilms', category: 'distributor', verified: true, active: true, notes: 'Horror/thriller specialist. Behind Perewangan.' },
    { channel_id: 'UCGFqddFzZ83Hg3q0OtYhT3Q', display_name: 'Infinite Studios', handle: '@InfiniteStudiosBatam', category: 'distributor', verified: true, active: true, notes: 'Animation & VFX studio. Behind Sing to the Dawn.' },

    // ─── Streaming ─────────────────────────────────────
    { channel_id: 'UCI_c_ZmYt6CtFJo4jOQVhiw', display_name: 'Disney+ Indonesia', handle: '@DisneyPlusID', category: 'streaming', verified: true, active: true, notes: '~1.2M subs' },
    { channel_id: 'UC5E0wgsW3JyQEP-DLkGwI2Q', display_name: 'Netflix Indonesia', handle: '@NetflixIndonesia', category: 'streaming', verified: true, active: true, notes: '~11.5M subs' },
    { channel_id: 'UCC6BkAWZB6UWdQoVtilpDSw', display_name: 'Vidio', handle: '@vidioid', category: 'streaming', verified: true, active: true, notes: 'Major Indonesian streaming platform. ~550K subs' },
    { channel_id: 'UC3RrFzfZJcXVdTklTUHDcBq', display_name: 'BioskopOnline', handle: '@BioskopOnline', category: 'streaming', verified: true, active: true, notes: 'Government-backed Indonesian cinema streaming' },

    // ─── Cinema Chains ─────────────────────────────────
    { channel_id: 'UC2vfMMUMoAZd-RBGwA0-9Nw', display_name: 'CGV Kreasi', handle: '@CGVKreasi', category: 'cinema_chain', verified: true, active: true, notes: '~260K subs' },
    { channel_id: 'UCudik2UCrl1TGyyPZ2I9Pvg', display_name: 'CINEMA 21', handle: '@CINEMA21', category: 'cinema_chain', verified: true, active: true, notes: '~180K subs' },
    { channel_id: 'UCP70SpqoP28WPYIHkzf_Y8Q', display_name: 'Cinépolis Indonesia', handle: '@CinepolisIndonesia', category: 'cinema_chain', verified: true, active: true, notes: '~135K subs' },
    { channel_id: 'UC-ge5BRqhec9fwV2VJtankACg', display_name: 'FLIX Cinema', handle: '@FlixCinema', category: 'cinema_chain', verified: true, active: false, notes: 'Very small channel. Verify manually.' },

    // ─── Critics / Reviewers ───────────────────────────
    { channel_id: 'UCrMqntY4lAQu0JHYFl8Z0nw', display_name: 'Cine Crib', handle: '@CineCrib', category: 'critic', verified: true, active: true, notes: '~500K subs' },
    { channel_id: 'UC_5tCGLrVehijNbC1_G8a5w', display_name: 'Ngelantur Indonesia', handle: '@NgelanturIndonesia', category: 'critic', verified: false, active: true, notes: '~200K subs' },
    { channel_id: 'UCLIm7HLHCNr4ZNJcNjNkbeQ', display_name: 'Review Film iD', handle: '@ReviewFilmID', category: 'critic', verified: true, active: true, notes: '~47K subs' },
    { channel_id: 'UCFF47NXFmpN7elvt0e1TRUV', display_name: 'Duta Film', handle: '@DutaFilm', category: 'critic', verified: true, active: true, notes: 'Major movie review channel. ~500K subs' },
    { channel_id: 'UCcy9-Nqw4RbOyVQglSxjCYg', display_name: 'Musik Film', handle: '@MusikFilm', category: 'critic', verified: true, active: true, notes: 'Film reviews and discussion. ~80K subs' },

    // ─── Community / Fandom ────────────────────────────
    { channel_id: 'UCHlCL5cY9PPlq2Ou9iU4NuQ', display_name: 'Bioskop Mania', handle: '@BioskopMania', category: 'community', verified: false, active: true, notes: '~350K subs' },
    { channel_id: 'UCTg9aljIS9E1eOv8W9Sx53g', display_name: 'Layar Lebar', handle: '@LayarLebar', category: 'community', verified: true, active: true, notes: 'Movie fan channel' },
    { channel_id: 'UCsUT0qQmoezR_J5VAUlwffQ', display_name: 'KomaTV', handle: '@KomaTV', category: 'community', verified: true, active: true, notes: 'Sketch comedy, strong cinema culture. ~1.5M subs' },
    { channel_id: 'UCvaUHIHmeEBxshWyYW5TfYg', display_name: 'Flix Indonesia', handle: '@FlixIndonesia', category: 'community', verified: true, active: true, notes: 'Film discussion and community' },
    { channel_id: 'UCadv-UfEyjjwOPcZHc2QvIQ', display_name: 'Nonton Yuk', handle: '@nontonyukofficial', category: 'community', verified: true, active: true, notes: 'Movie reactions, reviews, recommendations' },

    // ─── News / Trade ──────────────────────────────────
    { channel_id: 'UCfsp3KKBKjezdNxpoWxCWHg', display_name: 'KapanLagi', handle: '@KapanLagidotcom', category: 'news', verified: true, active: true, notes: 'Entertainment news' },
];

export async function POST(request: Request) {
    const session = await auth();
    if (!session) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

    try {
        // 1. Fetch real stats + avatars from YouTube API
        const statsMap = new Map<string, { subscriberCount: number; avatarUrl: string }>();

        if (YOUTUBE_API_KEY) {
            const ids = CHANNEL_SEEDS.map(c => c.channel_id).join(',');
            const url = new URL('https://www.googleapis.com/youtube/v3/channels');
            url.searchParams.set('part', 'statistics,snippet');
            url.searchParams.set('id', ids);
            url.searchParams.set('key', YOUTUBE_API_KEY);

            const res = await fetch(url.toString(), { cache: 'no-store' });
            if (res.ok) {
                const data = await res.json();
                for (const item of data.items || []) {
                    statsMap.set(item.id, {
                        subscriberCount: parseInt(item.statistics?.subscriberCount || '0'),
                        avatarUrl: item.snippet?.thumbnails?.high?.url || item.snippet?.thumbnails?.default?.url || '',
                    });
                }
            }
        }

        // 2. Write sources to Firestore with new schema
        const now = new Date().toISOString();
        let written = 0;
        let skipped = 0;

        for (const seed of CHANNEL_SEEDS) {
            const stats = statsMap.get(seed.channel_id);
            const docId = `youtube_${seed.channel_id}`;

            const doc: Omit<FirestoreSocialSource, 'id'> = {
                platform: 'youtube',
                display_name: seed.display_name,
                handle: seed.handle,
                category: seed.category,
                verified: seed.verified,
                avatar_url: stats?.avatarUrl || '',
                url: `https://youtube.com/${seed.handle}`,
                active: seed.active,
                notes: seed.notes,
                metadata: {
                    subscriber_count: stats?.subscriberCount || 0,
                },
                fetch_config: {
                    frequency: 'daily',
                    max_items_per_fetch: 50,
                },
                added_at: now,
                last_fetched_at: '',
            };

            const ok = await firestoreRestClient.createDocument(
                COLLECTIONS.SOURCES,
                docId,
                doc,
            );
            if (ok) written++;
            else skipped++;
        }

        return NextResponse.json({
            success: true,
            data: {
                total: CHANNEL_SEEDS.length,
                written,
                skipped,
                active: CHANNEL_SEEDS.filter(c => c.active).length,
                inactive: CHANNEL_SEEDS.filter(c => !c.active).length,
            },
        });
    } catch (error) {
        console.error('[Seed Error]', error);
        return NextResponse.json(
            { success: false, error: 'Seed failed' },
            { status: 500 },
        );
    }
}
