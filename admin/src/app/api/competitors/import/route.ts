/**
 * POST /api/competitors/import — bulk import tweets from raw Twitter JSON
 *
 * Accepts the full Twitter API timeline JSON (as captured from browser DevTools),
 * extracts all tweets, stores each individually, parses showtime + admission data,
 * and upserts into Firestore beta_competitor_snapshots.
 *
 * Admin-only.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth-helpers';
import { firestoreRestClient } from '@/lib/firestore-rest';
import { COMPETITOR_COLLECTION, TWEET_COLLECTION } from '@/features/competitors/types';
import type { CompetitorTweet, TweetType, TwitterTimelineResponse } from '@/features/competitors/types';
import {
  extractTweetsFromTwitterJson,
  parseTweetBatch,
  type RawTwitterEntry,
  type ParsedImportResult,
} from '@/features/competitors/parsers';

export async function POST(req: NextRequest) {
  const authError = await requireAdmin();
  if (authError) return authError;

  try {
    const json = await req.json();
    if (!json) {
      return NextResponse.json({ success: false, error: 'Missing JSON body' }, { status: 400 });
    }

    // 1. Extract tweets + source metadata from raw Twitter JSON
    const { tweets, sourceMeta } = extractTweetsWithMeta(json);
    if (tweets.length === 0) {
      return NextResponse.json({ success: false, error: 'No tweets found in the provided JSON' }, { status: 422 });
    }

    // 2. Store each tweet individually (upsert by tweet ID)
    const now = new Date().toISOString();
    let tweetsStored = 0;

    await Promise.all(tweets.map(async (tweet) => {
      const tweetType = detectTweetType(tweet.text);
      const tweetDoc: Omit<CompetitorTweet, 'id'> = {
        source_handle: sourceMeta.handle,
        source_name: sourceMeta.name,
        source_avatar: sourceMeta.avatar,
        created_at: tweet.created_at,
        text: tweet.text,
        tweet_type: tweetType,
        media_urls: tweet.media_urls,
        imported_at: now,
      };

      const existing = await firestoreRestClient.getDocument(TWEET_COLLECTION, tweet.id);
      const ok = existing
        ? await firestoreRestClient.updateDocument(TWEET_COLLECTION, tweet.id, tweetDoc as Record<string, unknown>)
        : await firestoreRestClient.createDocument(TWEET_COLLECTION, tweet.id, tweetDoc as Record<string, unknown>);

      if (ok) tweetsStored++;
    }));

    // 3. Parse data tweets into structured showtime/admission data
    const parsed = parseTweetBatch(tweets);

    // 4. Group by date and upsert snapshots
    const byDate = new Map<string, ParsedImportResult[]>();
    for (const item of parsed) {
      if (!byDate.has(item.date)) byDate.set(item.date, []);
      byDate.get(item.date)!.push(item);
    }

    const results: { date: string; showtimes: number; admissions: number }[] = [];
    let upserted = 0;

    for (const [date, items] of byDate) {
      try {
        const existing = await firestoreRestClient.getDocument(COMPETITOR_COLLECTION, date);

        const data: Record<string, unknown> = { date, source: 'cinepoint' };

        const showtimeItems = items.filter((i) => i.type === 'showtimes');
        if (showtimeItems.length > 0) {
          const latest = showtimeItems[showtimeItems.length - 1];
          data.showtimes_raw = latest.raw_text;
          data.showtimes_parsed = latest.parsed;
          data.showtimes_parsed_at = now;
        } else if (existing?.showtimes_raw) {
          data.showtimes_raw = existing.showtimes_raw;
          data.showtimes_parsed = existing.showtimes_parsed;
          data.showtimes_parsed_at = existing.showtimes_parsed_at;
        }

        const admissionItems = items.filter((i) => i.type === 'admissions');
        if (admissionItems.length > 0) {
          const latest = admissionItems[admissionItems.length - 1];
          data.admissions_raw = latest.raw_text;
          data.admissions_parsed = latest.parsed;
          data.admissions_parsed_at = now;
        } else if (existing?.admissions_raw) {
          data.admissions_raw = existing.admissions_raw;
          data.admissions_parsed = existing.admissions_parsed;
          data.admissions_parsed_at = existing.admissions_parsed_at;
        }

        const ok = existing
          ? await firestoreRestClient.updateDocument(COMPETITOR_COLLECTION, date, data)
          : await firestoreRestClient.createDocument(COMPETITOR_COLLECTION, date, data);

        if (ok) {
          upserted++;
          results.push({
            date,
            showtimes: showtimeItems.reduce((s, i) => s + i.parsed.length, 0),
            admissions: admissionItems.reduce((s, i) => s + i.parsed.length, 0),
          });
        }
      } catch {
        // Best effort — continue with other dates
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        source: sourceMeta.handle,
        tweets_extracted: tweets.length,
        tweets_stored: tweetsStored,
        tweets_parsed: parsed.length,
        dates_upserted: upserted,
        details: results.sort((a, b) => b.date.localeCompare(a.date)),
      },
    });
  } catch (error) {
    console.error('[Competitor Import Error]', error);
    return NextResponse.json({ success: false, error: 'Failed to import tweets' }, { status: 500 });
  }
}

// ─── Helpers ───────────────────────────────────────────────

function detectTweetType(text: string): TweetType {
  if (text.startsWith('SHOWTIMES')) return 'showtimes';
  if (text.startsWith('ESTIMATED ADMISSION')) return 'admissions';
  return 'other';
}

interface TweetWithMedia extends RawTwitterEntry {
  media_urls: string[];
}

interface SourceMeta {
  handle: string;
  name: string;
  avatar: string;
}

/**
 * Extract tweets + source account metadata from raw Twitter JSON.
 * Source info is read once from the first tweet's user data.
 */
function extractTweetsWithMeta(json: unknown): { tweets: TweetWithMedia[]; sourceMeta: SourceMeta } {
  const root = json as TwitterTimelineResponse;

  const instructions = root?.data?.user?.result?.timeline?.timeline?.instructions;
  if (!Array.isArray(instructions)) return { tweets: [], sourceMeta: { handle: '', name: '', avatar: '' } };

  const entries = instructions
    .filter((i) => Array.isArray(i?.entries))
    .flatMap((i) => i.entries || []);

  let sourceMeta: SourceMeta = { handle: '', name: '', avatar: '' };
  const tweets: TweetWithMedia[] = [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const e of entries as any[]) {
    const result = e?.content?.itemContent?.tweet_results?.result;
    if (!result?.legacy?.full_text) continue;

    // Extract source meta from the first tweet's user data (same for all tweets from this account)
    if (!sourceMeta.handle && result?.core?.user_results?.result) {
      const user = result.core.user_results.result;
      sourceMeta = {
        handle: user?.core?.screen_name || user?.legacy?.screen_name || '',
        name: user?.core?.name || user?.legacy?.name || '',
        avatar: user?.avatar?.image_url || user?.legacy?.profile_image_url_https || '',
      };
    }

    // Extract media URLs
    const mediaUrls: string[] = [];
    const extendedMedia = result?.legacy?.extended_entities?.media || result?.legacy?.entities?.media || [];
    for (const m of extendedMedia) {
      if (m?.media_url_https) mediaUrls.push(m.media_url_https);
    }

    const text: string = result.legacy.full_text
      .replace(/https:\/\/t\.co\/\S+/g, '')
      .replace(/[🔥🔻]/g, '')
      .trim();

    tweets.push({
      id: result.rest_id,
      created_at: result.legacy.created_at,
      text,
      media_urls: mediaUrls,
    });
  }

  return { tweets, sourceMeta };
}
