/**
 * Shared server-side logic for scraping a single tweet URL and importing it.
 *
 * Used by both /api/competitors/scrape-tweet and /batch endpoints.
 * Handles: syndication fetch → parse → store tweet → upsert snapshot.
 */

import { firestoreRestClient } from '@/lib/firestore-rest';
import { COMPETITOR_COLLECTION, TWEET_COLLECTION } from '@/features/competitors/types';
import type { CompetitorTweet, TweetType } from '@/features/competitors/types';
import { parseTweetBatch, type RawTwitterEntry, type ParsedImportResult } from '@/features/competitors/parsers';

// ─── Types ─────────────────────────────────────────────────

interface SyndicationMedia {
  media_url_https?: string;
  type?: string;
}

interface SyndicationTweet {
  id_str: string;
  text: string;
  created_at: string;
  user?: {
    screen_name: string;
    name: string;
    profile_image_url_https: string;
  };
  mediaDetails?: SyndicationMedia[];
  photos?: { url: string }[];
}

export interface ScrapeResult {
  success: boolean;
  tweet_id: string;
  type: TweetType;
  text_preview: string;
  media_count: number;
  snapshot: {
    date: string;
    type: string;
    parsed_count: number;
  } | null;
  error?: string;
}

// ─── Main function ─────────────────────────────────────────

export async function scrapeAndImportTweet(url: string): Promise<ScrapeResult> {
  const tweetId = extractTweetId(url);
  if (!tweetId) {
    return {
      success: false,
      tweet_id: '',
      type: 'other',
      text_preview: '',
      media_count: 0,
      snapshot: null,
      error: 'Could not extract tweet ID from URL',
    };
  }

  const tweet = await fetchTweetFromSyndication(tweetId);
  if (!tweet) {
    return {
      success: false,
      tweet_id: tweetId,
      type: 'other',
      text_preview: '',
      media_count: 0,
      snapshot: null,
      error: `Could not fetch tweet ${tweetId}. It may be private, deleted, or rate-limited.`,
    };
  }

  const cleanedText = tweet.text
    .replace(/https:\/\/t\.co\/\S+/g, '')
    .replace(/[🔥🔻]/g, '')
    .trim();

  if (!cleanedText) {
    return {
      success: false,
      tweet_id: tweetId,
      type: 'other',
      text_preview: '',
      media_count: 0,
      snapshot: null,
      error: 'Tweet has no text content',
    };
  }

  // Collect media URLs
  const mediaUrls: string[] = [];
  if (tweet.mediaDetails) {
    for (const m of tweet.mediaDetails) {
      if (m.media_url_https) mediaUrls.push(m.media_url_https);
    }
  }
  if (tweet.photos) {
    for (const p of tweet.photos) {
      if (p.url && !mediaUrls.includes(p.url)) mediaUrls.push(p.url);
    }
  }

  const tweetType = detectTweetType(cleanedText);
  const createdAt = tweet.created_at || new Date().toISOString();

  // Store tweet document
  const now = new Date().toISOString();
  const tweetDoc: Omit<CompetitorTweet, 'id'> = {
    source_handle: tweet.user?.screen_name || 'unknown',
    source_name: tweet.user?.name || 'Unknown',
    source_avatar: tweet.user?.profile_image_url_https || '',
    created_at: createdAt,
    text: cleanedText,
    tweet_type: tweetType,
    media_urls: [...new Set(mediaUrls)],
    imported_at: now,
  };

  const existingTweet = await firestoreRestClient.getDocument(TWEET_COLLECTION, tweetId);
  if (existingTweet) {
    await firestoreRestClient.updateDocument(TWEET_COLLECTION, tweetId, tweetDoc as Record<string, unknown>);
  } else {
    await firestoreRestClient.createDocument(TWEET_COLLECTION, tweetId, tweetDoc as Record<string, unknown>);
  }

  // Parse and upsert snapshot
  const rawEntry: RawTwitterEntry = { id: tweetId, created_at: createdAt, text: cleanedText };
  const parsed = parseTweetBatch([rawEntry]);

  let snapshotResult: ScrapeResult['snapshot'] = null;
  if (parsed.length > 0) {
    const byDate = new Map<string, ParsedImportResult[]>();
    for (const item of parsed) {
      if (!byDate.has(item.date)) byDate.set(item.date, []);
      byDate.get(item.date)!.push(item);
    }

    for (const [date, items] of byDate) {
      const existing = await firestoreRestClient.getDocument(COMPETITOR_COLLECTION, date);
      const data: Record<string, unknown> = { date, source: 'cinepoint' };

      // Showtimes: write nested object if present, otherwise preserve existing
      const showtimeItems = items.filter((i) => i.type === 'showtimes');
      if (showtimeItems.length > 0) {
        const latest = showtimeItems[showtimeItems.length - 1];
        data.showtimes = {
          raw: latest.raw_text,
          parsed: latest.parsed,
          source_tweet_id: tweetId,
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
          source_tweet_id: tweetId,
          updated_at: now,
        };
      } else {
        data.admissions = existing?.admissions ?? null;
      }

      if (existing) {
        await firestoreRestClient.updateDocument(COMPETITOR_COLLECTION, date, data);
      } else {
        await firestoreRestClient.createDocument(COMPETITOR_COLLECTION, date, data);
      }

      snapshotResult = {
        date,
        type: items[0].type,
        parsed_count: items.reduce((s, i) => s + i.parsed.length, 0),
      };
    }
  }

  return {
    success: true,
    tweet_id: tweetId,
    type: tweetType,
    text_preview: cleanedText.substring(0, 100) + (cleanedText.length > 100 ? '...' : ''),
    media_count: mediaUrls.length,
    snapshot: snapshotResult,
  };
}

// ─── Constants ─────────────────────────────────────────────

/**
 * Twitter public bearer token — embedded in every browser session.
 * Used for guest token activation + GraphQL queries.
 */
const TWITTER_BEARER = 'AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA';

/**
 * GraphQL query ID for TweetResultByRestId.
 * Extracted from Twitter's main.js bundle. May need updating when Twitter rotates it.
 * To find the current ID: search main.*.js on x.com for "TweetResultByRestId"
 * and extract the queryId from the same module.
 */
const GRAPHQL_QUERY_ID = '2pq8P2wfwUBo2hqukWqdIA';

/**
 * Features required by the GraphQL endpoint.
 * Must match what Twitter's frontend sends or the request returns 422.
 */
const GRAPHQL_FEATURES: Record<string, boolean> = {
  creator_subscriptions_tweet_preview_api_enabled: true,
  premium_content_api_read_enabled: true,
  communities_web_enable_tweet_community_results_fetch: true,
  c9s_tweet_anatomy_moderator_badge_enabled: true,
  articles_preview_enabled: true,
  responsive_web_edit_tweet_api_enabled: true,
  graphql_is_translatable_rweb_tweet_is_translatable_enabled: true,
  view_counts_everywhere_api_enabled: true,
  longform_notetweets_consumption_enabled: true,
  responsive_web_twitter_article_tweet_consumption_enabled: true,
  freedom_of_speech_not_reach_fetch_enabled: true,
  standardized_nudges_misinfo: true,
  tweet_with_visibility_results_prefer_gql_limited_actions_policy_enabled: true,
  longform_notetweets_rich_text_read_enabled: true,
  longform_notetweets_inline_media_enabled: true,
  rweb_tipjar_consumption_enabled: true,
  verified_phone_label_enabled: true,
  responsive_web_graphql_skip_user_profile_image_extensions_enabled: true,
  responsive_web_graphql_timeline_navigation_enabled: true,
  responsive_web_enhance_cards_enabled: true,
};

// ─── Helpers ───────────────────────────────────────────────

function detectTweetType(text: string): TweetType {
  if (text.startsWith('SHOWTIMES')) return 'showtimes';
  if (/admission/i.test(text)) return 'admissions';
  return 'other';
}

export function extractTweetId(url: string): string | null {
  if (/^\d+$/.test(url.trim())) return url.trim();
  const match = url.match(/(?:x\.com|twitter\.com)\/\w+\/status\/(\d+)/);
  return match ? match[1] : null;
}

/**
 * Fetch tweet from syndication API (fast, no auth).
 * If the tweet has a note_tweet (long-form text), resolve it via GraphQL.
 */
async function fetchTweetFromSyndication(tweetId: string): Promise<SyndicationTweet | null> {
  try {
    // Step 1: Fetch from syndication API (no auth needed)
    const res = await fetch(
      `https://cdn.syndication.twimg.com/tweet-result?id=${tweetId}&lang=en&token=x`,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
          'Accept': 'application/json',
        },
        next: { revalidate: 0 },
      },
    );
    if (!res.ok) return null;
    const data = await res.json();
    if (!data?.id_str && !data?.text) return null;

    const tweet = data as SyndicationTweet;

    // Step 2: Check for note_tweet (indicates truncated long-form text).
    // The syndication API may include note_tweet with just an id (no is_expandable),
    // or with is_expandable=true. Either way, if note_tweet exists, resolve full text.
    if (data.note_tweet?.id || data.note_tweet?.is_expandable) {
      const fullText = await resolveNoteTweet(tweetId);
      if (fullText) {
        tweet.text = fullText;
      }
    }

    return tweet;
  } catch {
    return null;
  }
}

/**
 * Resolve a note_tweet (long-form tweet text) via GraphQL with guest token.
 *
 * Flow:
 * 1. Activate guest token via POST api.twitter.com/1.1/guest/activate.json
 * 2. GET graphql/TweetResultByRestId with the guest token
 * 3. Extract note_tweet.note_tweet_results.result.text
 *
 * Returns the full text if resolved, or null on failure.
 */
async function resolveNoteTweet(tweetId: string): Promise<string | null> {
  try {
    // 1. Get guest token
    const gtRes = await fetch('https://api.twitter.com/1.1/guest/activate.json', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${TWITTER_BEARER}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': '*/*',
        'Origin': 'https://x.com',
        'Referer': 'https://x.com/',
      },
      next: { revalidate: 0 },
    });

    if (!gtRes.ok) return null;
    const gtData = await gtRes.json();
    const guestToken = gtData.guest_token as string;
    if (!guestToken) return null;

    // 2. Fetch tweet via GraphQL
    const variables = JSON.stringify({
      tweetId,
      withCommunity: false,
      includePromotedContent: false,
      withVoice: false,
    });
    const features = JSON.stringify(GRAPHQL_FEATURES);

    const params = new URLSearchParams({ variables, features });
    const gqlUrl = `https://api.twitter.com/graphql/${GRAPHQL_QUERY_ID}/TweetResultByRestId?${params}`;

    const gqlRes = await fetch(gqlUrl, {
      headers: {
        'Authorization': `Bearer ${TWITTER_BEARER}`,
        'x-guest-token': guestToken,
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': '*/*',
        'Origin': 'https://x.com',
        'Referer': 'https://x.com/',
        'x-twitter-active-user': 'yes',
        'x-twitter-client-language': 'en',
      },
      next: { revalidate: 0 },
    });

    if (!gqlRes.ok) return null;
    const gqlData = await gqlRes.json();

    // 3. Navigate to note_tweet text
    const result = gqlData?.data?.tweetResult?.result;
    const tweet = result?.tweet || result;
    const noteText = tweet?.note_tweet?.note_tweet_results?.result?.text;

    return typeof noteText === 'string' && noteText.length > 0 ? noteText : null;
  } catch {
    return null;
  }
}
