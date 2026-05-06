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

        // Showtimes: write nested object if present, otherwise preserve existing
        const showtimeItems = items.filter((i) => i.type === 'showtimes');
        if (showtimeItems.length > 0) {
          const latest = showtimeItems[showtimeItems.length - 1];
          data.showtimes = {
            raw: latest.raw_text,
            parsed: latest.parsed,
            source_tweet_id: latest.source_tweet_id,
            updated_at: now,
          };
        } else {
          data.showtimes = existing?.showtimes ?? null;
        }

        // Admissions: write nested object if present, otherwise preserve existing
        const admissionItems = items.filter((i) => i.type === 'admissions');
        if (admissionItems.length > 0) {
          const latest = admissionItems[admissionItems.length - 1];
          data.admissions = {
            raw: latest.raw_text,
            parsed: latest.parsed,
            source_tweet_id: latest.source_tweet_id,
            updated_at: now,
          };
        } else {
          data.admissions = existing?.admissions ?? null;
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
    if (!result) continue;

    // 1. Greedy Text Extraction: Scour the entire object for the longest report text
    // (This finds full note_tweet text even if buried in nested visibility or quote wrappers)
    const reportTexts: string[] = [];
    
    // Recursive searcher for anything that looks like a report
    const scour = (obj: unknown) => {
      if (!obj || typeof obj !== 'object') return;
      
      const record = obj as Record<string, unknown>;
      if (typeof record.full_text === 'string') reportTexts.push(record.full_text);
      if (typeof record.text === 'string') reportTexts.push(record.text);
      
      Object.values(record).forEach(val => scour(val));
    };
    
    scour(result);
    
    // Filter for only CinePoint reports and pick the absolute longest one
    const validReports = reportTexts.filter(t => 
      t.startsWith('SHOWTIMES') || t.startsWith('ESTIMATED ADMISSION')
    );
    
    const rawText = validReports.length > 0 
      ? validReports.reduce((a, b) => a.length > b.length ? a : b) 
      : '';
      
    if (!rawText) continue;

    // 2. Resolve Target Result (prioritize unwrapped tweet for metadata)
    const target = result.tweet || result;

    // Extract source meta (read from the first valid user found)
    if (!sourceMeta.handle) {
      const user = target?.core?.user_results?.result || target?.user_results?.result;
      if (user) {
        sourceMeta = {
          handle: user?.core?.screen_name || user?.legacy?.screen_name || '',
          name: user?.core?.name || user?.legacy?.name || '',
          avatar: user?.avatar?.image_url || user?.legacy?.profile_image_url_https || '',
        };
      }
    }

    // Extract all media URLs from anywhere in the result
    const mediaUrls: string[] = [];
    const collectMedia = (obj: unknown) => {
      if (!obj || typeof obj !== 'object') return;
      const record = obj as Record<string, unknown>;
      if (record.media_url_https && typeof record.media_url_https === 'string') {
        mediaUrls.push(record.media_url_https);
      }
      Object.values(record).forEach(val => collectMedia(val));
    };
    collectMedia(result);

    const text = rawText
      .replace(/https:\/\/t\.co\/\S+/g, '')
      .replace(/[🔥🔻]/g, '')
      .trim();

    tweets.push({
      id: target.rest_id || result.rest_id,
      created_at: target.legacy?.created_at || result.legacy?.created_at,
      text,
      media_urls: [...new Set(mediaUrls)],
    });
  }

  return { tweets, sourceMeta };
}
