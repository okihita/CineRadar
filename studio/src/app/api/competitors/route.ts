/**
 * GET /api/competitors — list all competitor snapshots with status
 */

import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { firestoreRestClient } from '@/lib/firestore-rest';
import { COMPETITOR_COLLECTION, TWEET_COLLECTION, type CompetitorSnapshot, type CompetitorTweet, getSnapshotStatus } from '@/features/competitors/types';

export async function GET() {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const snapshots = await firestoreRestClient.getCollectionWithQuery<CompetitorSnapshot>(
      COMPETITOR_COLLECTION,
      'date',
      200,
    );

    const result = snapshots.map((s) => ({
      date: s.date || s.id,
      status: getSnapshotStatus(s),
      showtime_count: s.showtimes?.parsed?.length || 0,
      admission_count: s.admissions?.parsed?.length || 0,
    }));

    // Fetch "other" tweet dates for calendar orange dots
    const tweets = await firestoreRestClient.getCollectionWithQuery<CompetitorTweet>(
      TWEET_COLLECTION,
      'imported_at',
      500,
    );

    const otherDates = new Set<string>();
    for (const t of tweets) {
      if (t.tweet_type !== 'other') continue;
      const dateKey = t.data_date || twitterDateToLocalDate(t.created_at);
      if (dateKey) otherDates.add(dateKey);
    }

    return NextResponse.json({ success: true, data: result, other_dates: Array.from(otherDates) });
  } catch (error) {
    console.error('[Competitors List Error]', error);
    return NextResponse.json({ success: false, error: 'Failed to load snapshots' }, { status: 500 });
  }
}

/** Convert Twitter date format to local YYYY-MM-DD string */
function twitterDateToLocalDate(twitterDate: string): string | null {
  try {
    const d = new Date(twitterDate);
    if (isNaN(d.getTime())) return null;
    return d.toLocaleDateString('sv-SE', { timeZone: 'Asia/Jakarta' });
  } catch {
    return null;
  }
}
