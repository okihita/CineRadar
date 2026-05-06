/**
 * PUT /api/competitors/[date]/showtimes — paste & parse showtime tweet
 *
 * Accepts raw tweet text, parses it, matches to CineRadar movies,
 * saves to Firestore.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth-helpers';
import { firestoreRestClient } from '@/lib/firestore-rest';
import { COMPETITOR_COLLECTION } from '@/features/competitors/types';
import { parseShowtimeTweet } from '@/features/competitors/parsers';

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ date: string }> },
) {
  const authError = await requireAdmin();
  if (authError) return authError;

  const { date } = await params;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ success: false, error: 'Invalid date format' }, { status: 400 });
  }

  try {
    const body = await req.json();
    const raw: string = body.raw;

    if (!raw || typeof raw !== 'string') {
      return NextResponse.json({ success: false, error: 'Missing raw tweet text' }, { status: 400 });
    }

    const parsed = parseShowtimeTweet(raw);

    if (parsed.length === 0) {
      return NextResponse.json({ success: false, error: 'Could not parse any movies from the pasted text' }, { status: 422 });
    }

    // Upsert: create or update the snapshot document
    const existing = await firestoreRestClient.getDocument(COMPETITOR_COLLECTION, date);

    const data: Record<string, unknown> = {
      date,
      source: 'cinepoint',
      showtimes: {
        raw,
        parsed,
        source_tweet_id: '', // Manual paste — no source tweet
        updated_at: new Date().toISOString(),
      },
    };

    // Preserve existing admissions data if any
    data.admissions = existing?.admissions ?? null;

    const success = existing
      ? await firestoreRestClient.updateDocument(COMPETITOR_COLLECTION, date, data)
      : await firestoreRestClient.createDocument(COMPETITOR_COLLECTION, date, data);

    if (!success) {
      return NextResponse.json({ success: false, error: 'Failed to save snapshot' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data: { parsed_count: parsed.length, parsed },
    });
  } catch (error) {
    console.error('[Showtime Parse Error]', error);
    return NextResponse.json({ success: false, error: 'Failed to parse showtimes' }, { status: 500 });
  }
}
