/**
 * POST /api/competitors/manual-entry — manually enter data for an unparseable tweet
 *
 * Body:
 *   tweet_id:  string          — Firestore tweet document ID
 *   date:      string          — "2026-05-05" target date for the snapshot
 *   data_type: 'showtimes' | 'admissions'
 *   entries:   ManualEntry[]   — structured data rows
 *
 * ManualEntry for showtimes:
 *   { title_cp, showtimes, daily_change_pct }
 * ManualEntry for admissions:
 *   { title_cp, daily_admissions, daily_change_pct, cumulative_admissions }
 *
 * Updates the tweet's tweet_type + data_date, and upserts the snapshot.
 * Admin-only.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth-helpers';
import { firestoreRestClient } from '@/lib/firestore-rest';
import { COMPETITOR_COLLECTION, TWEET_COLLECTION } from '@/features/competitors/types';
import type { CompetitorSnapshot, CinePointShowtime, CinePointAdmission } from '@/features/competitors/types';

export interface ManualShowtimeEntry {
  title_cp: string;
  showtimes: number;
  daily_change_pct: number;
}

export interface ManualAdmissionEntry {
  title_cp: string;
  daily_admissions: number;
  daily_change_pct: number;
  cumulative_admissions: number;
}

export async function POST(req: NextRequest) {
  const authError = await requireAdmin();
  if (authError) return authError;

  try {
    const body = await req.json();
    const { tweet_id, date, data_type, entries } = body as {
      tweet_id: string;
      date: string;
      data_type: 'showtimes' | 'admissions';
      entries: ManualShowtimeEntry[] | ManualAdmissionEntry[];
    };

    // Validate
    if (!tweet_id || !date || !data_type || !Array.isArray(entries) || entries.length === 0) {
      return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 });
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json({ success: false, error: 'Invalid date format (YYYY-MM-DD)' }, { status: 400 });
    }

    if (!['showtimes', 'admissions'].includes(data_type)) {
      return NextResponse.json({ success: false, error: 'data_type must be showtimes or admissions' }, { status: 400 });
    }

    const now = new Date().toISOString();

    // 1. Update the tweet document
    await firestoreRestClient.updateDocument(TWEET_COLLECTION, tweet_id, {
      tweet_type: data_type,
      data_date: date,
    } as Record<string, unknown>);

    // 2. Fetch existing snapshot (to preserve the other data type)
    const existing = await firestoreRestClient.getDocument<CompetitorSnapshot>(COMPETITOR_COLLECTION, date);

    const data: Record<string, unknown> = {
      date,
      source: 'cinepoint',
      updated_at: now,
    };

    if (data_type === 'showtimes') {
      data.showtimes = {
        raw: `[Manual Entry — ${tweet_id}]`,
        parsed: (entries as ManualShowtimeEntry[]).map((e): CinePointShowtime => ({
          title_cp: e.title_cp,
          showtimes: e.showtimes,
          daily_change_pct: e.daily_change_pct,
        })),
        source_tweet_id: tweet_id,
        updated_at: now,
      };
      // Preserve existing admissions
      data.admissions = existing?.admissions ?? null;
    } else {
      data.admissions = {
        raw: `[Manual Entry — ${tweet_id}]`,
        parsed: (entries as ManualAdmissionEntry[]).map((e): CinePointAdmission => ({
          title_cp: e.title_cp,
          daily_admissions: e.daily_admissions,
          daily_change_pct: e.daily_change_pct,
          cumulative_admissions: e.cumulative_admissions,
        })),
        source_tweet_id: tweet_id,
        updated_at: now,
      };
      // Preserve existing showtimes
      data.showtimes = existing?.showtimes ?? null;
    }

    // 3. Upsert snapshot
    if (existing) {
      await firestoreRestClient.updateDocument(COMPETITOR_COLLECTION, date, data);
    } else {
      await firestoreRestClient.createDocument(COMPETITOR_COLLECTION, date, data);
    }

    return NextResponse.json({
      success: true,
      data: {
        tweet_id,
        date,
        data_type,
        entries_count: entries.length,
      },
    });
  } catch (error) {
    console.error('[Manual Entry Error]', error);
    return NextResponse.json({ success: false, error: 'Failed to save manual entry' }, { status: 500 });
  }
}
