/**
 * GET /api/competitors/tweets — browse stored tweets
 *
 * Query params:
 *   source  — filter by source handle (e.g. "cinepoint_")
 *   type    — filter by tweet_type: "showtimes" | "admissions" | "other"
 *
 * Returns tweets sorted by created_at descending, plus source summaries.
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { firestoreRestClient } from '@/lib/firestore-rest';
import { TWEET_COLLECTION, type CompetitorTweet, type TweetSourceSummary } from '@/features/competitors/types';

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const sourceFilter = searchParams.get('source');
    const typeFilter = searchParams.get('type');

    // Fetch all tweets (collection is small: ~100-200 tweets max)
    const tweets = await firestoreRestClient.getCollectionWithQuery<CompetitorTweet>(
      TWEET_COLLECTION,
      'imported_at',
      500,
    );

    // Sort by created_at descending (newest first)
    tweets.sort((a, b) => {
      const da = new Date(a.created_at).getTime();
      const db = new Date(b.created_at).getTime();
      return db - da;
    });

    // Apply filters
    let filtered = tweets;
    if (sourceFilter) {
      filtered = filtered.filter((t) => t.source_handle === sourceFilter);
    }
    if (typeFilter) {
      filtered = filtered.filter((t) => t.tweet_type === typeFilter);
    }

    // Build source summaries
    const sourceMap = new Map<string, { handle: string; name: string; avatar: string; tweets: CompetitorTweet[] }>();
    for (const t of tweets) {
      if (!sourceMap.has(t.source_handle)) {
        sourceMap.set(t.source_handle, {
          handle: t.source_handle,
          name: t.source_name,
          avatar: t.source_avatar,
          tweets: [],
        });
      }
      sourceMap.get(t.source_handle)!.tweets.push(t);
    }

    const sources: TweetSourceSummary[] = [...sourceMap.values()].map((s) => {
      const dates = s.tweets
        .map((t) => t.created_at)
        .sort();
      return {
        handle: s.handle,
        name: s.name,
        avatar: s.avatar,
        tweet_count: s.tweets.length,
        earliest_date: dates[0] || '',
        latest_date: dates[dates.length - 1] || '',
        date_range: dates.length > 0
          ? Math.round((new Date(dates[dates.length - 1]).getTime() - new Date(dates[0]).getTime()) / (1000 * 60 * 60 * 24))
          : 0,
      };
    });

    return NextResponse.json({
      success: true,
      data: {
        tweets: filtered.map((t) => ({
          id: t.id,
          source_handle: t.source_handle,
          source_name: t.source_name,
          source_avatar: t.source_avatar,
          created_at: t.created_at,
          text: t.text,
          tweet_type: t.tweet_type,
          data_date: t.data_date,
          media_urls: t.media_urls,
          imported_at: t.imported_at,
        })),
        sources,
        total: filtered.length,
      },
    });
  } catch (error) {
    console.error('[Competitor Tweets Error]', error);
    return NextResponse.json({ success: false, error: 'Failed to load tweets' }, { status: 500 });
  }
}
