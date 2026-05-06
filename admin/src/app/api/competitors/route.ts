/**
 * GET /api/competitors — list all competitor snapshots with status
 */

import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { firestoreRestClient } from '@/lib/firestore-rest';
import { COMPETITOR_COLLECTION, type CompetitorSnapshot, type SnapshotStatus } from '@/features/competitors/types';

export async function GET() {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const snapshots = await firestoreRestClient.getCollectionWithQuery<CompetitorSnapshot>(
      COMPETITOR_COLLECTION,
      'date',
      30,
    );

    const result = snapshots.map((s) => {
      let status: SnapshotStatus = 'empty';
      if (s.showtimes_parsed && s.showtimes_parsed.length > 0 && s.admissions_parsed && s.admissions_parsed.length > 0) {
        status = 'complete';
      } else if (s.showtimes_parsed && s.showtimes_parsed.length > 0) {
        status = 'showtimes_only';
      } else if (s.admissions_parsed && s.admissions_parsed.length > 0) {
        status = 'admissions_only';
      }

      return {
        date: s.date || s.id,
        status,
        showtime_count: s.showtimes_parsed?.length || 0,
        admission_count: s.admissions_parsed?.length || 0,
      };
    });

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error('[Competitors List Error]', error);
    return NextResponse.json({ success: false, error: 'Failed to load snapshots' }, { status: 500 });
  }
}
