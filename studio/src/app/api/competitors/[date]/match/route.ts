/**
 * PATCH /api/competitors/[date]/match — update movie matching
 *
 * Body: { type: 'showtimes' | 'admissions', updates: [{ title_cp, matched_movie_id, matched_title }] }
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth-helpers';
import { firestoreRestClient } from '@/lib/firestore-rest';
import { COMPETITOR_COLLECTION, type CompetitorSnapshot, type CinePointShowtime, type CinePointAdmission, type ShowtimeDataPoint, type AdmissionDataPoint } from '@/features/competitors/types';

export async function PATCH(
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
    const { type, updates } = body as {
      type: 'showtimes' | 'admissions';
      updates: { title_cp: string; matched_movie_id: string; matched_title: string }[];
    };

    if (!type || !Array.isArray(updates)) {
      return NextResponse.json({ success: false, error: 'Missing type or updates' }, { status: 400 });
    }

    const snapshot = await firestoreRestClient.getDocument<CompetitorSnapshot>(
      COMPETITOR_COLLECTION,
      date,
    );

    if (!snapshot) {
      return NextResponse.json({ success: false, error: 'Snapshot not found' }, { status: 404 });
    }

    // Build update map
    const updateMap = new Map(updates.map((u) => [u.title_cp, u]));

    if (type === 'showtimes' && snapshot.showtimes?.parsed) {
      const updated: CinePointShowtime[] = snapshot.showtimes.parsed.map((item) => {
        const u = updateMap.get(item.title_cp);
        if (u) {
          return { ...item, matched_movie_id: u.matched_movie_id, matched_title: u.matched_title };
        }
        return item;
      });

      const updatedPoint: ShowtimeDataPoint = {
        ...snapshot.showtimes,
        parsed: updated,
      };

      await firestoreRestClient.updateDocument(COMPETITOR_COLLECTION, date, {
        showtimes: updatedPoint,
      });
    } else if (type === 'admissions' && snapshot.admissions?.parsed) {
      const updated: CinePointAdmission[] = snapshot.admissions.parsed.map((item) => {
        const u = updateMap.get(item.title_cp);
        if (u) {
          return { ...item, matched_movie_id: u.matched_movie_id, matched_title: u.matched_title };
        }
        return item;
      });

      const updatedPoint: AdmissionDataPoint = {
        ...snapshot.admissions,
        parsed: updated,
      };

      await firestoreRestClient.updateDocument(COMPETITOR_COLLECTION, date, {
        admissions: updatedPoint,
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Match Update Error]', error);
    return NextResponse.json({ success: false, error: 'Failed to update matching' }, { status: 500 });
  }
}
