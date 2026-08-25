/**
 * GET /api/competitors/cumulative — Box office tracker from CinePoint cumulative admissions
 *
 * Returns per-movie cumulative admissions trajectory across all tracked dates.
 * Includes opening daily, peak daily, and week-over-week drop rate.
 */

import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { firestoreRestClient } from '@/lib/firestore-rest';
import {
  COMPETITOR_COLLECTION,
  type CompetitorSnapshot,
  type CumulativeMovieTrack,
  type CumulativeDataPoint,
} from '@/features/competitors/types';

export async function GET() {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Fetch all snapshots (up to 90 days of data)
    const snapshots = await firestoreRestClient.getCollectionWithQuery<CompetitorSnapshot>(
      COMPETITOR_COLLECTION,
      'date',
      120,
    );

    // Sort ascending by date for chronological analysis
    snapshots.sort((a, b) => (a.date || a.id).localeCompare(b.date || b.id));

    // Build per-movie cumulative data
    const movieMap = new Map<string, {
      title_cp: string;
      matched_movie_id?: string;
      matched_title?: string;
      points: CumulativeDataPoint[];
    }>();

    for (const snap of snapshots) {
      const date = snap.date || snap.id;
      const admissions = snap.admissions?.parsed;
      if (!admissions || admissions.length === 0) continue;

      for (const adm of admissions) {
        if (!movieMap.has(adm.title_cp)) {
          movieMap.set(adm.title_cp, {
            title_cp: adm.title_cp,
            matched_movie_id: adm.matched_movie_id,
            matched_title: adm.matched_title,
            points: [],
          });
        }

        const entry = movieMap.get(adm.title_cp)!;

        // Update matched info if available (latest snapshot may have better matching)
        if (adm.matched_movie_id) {
          entry.matched_movie_id = adm.matched_movie_id;
          entry.matched_title = adm.matched_title;
        }

        entry.points.push({
          date,
          daily_admissions: adm.daily_admissions,
          cumulative_admissions: adm.cumulative_admissions,
          daily_change_pct: adm.daily_change_pct,
        });
      }
    }

    // Build final tracks with computed metrics
    const tracks: CumulativeMovieTrack[] = [];

    for (const [, movie] of movieMap) {
      // Sort points by date ascending
      movie.points.sort((a, b) => a.date.localeCompare(b.date));

      // Remove duplicate dates (keep latest)
      const uniquePoints: CumulativeDataPoint[] = [];
      for (const pt of movie.points) {
        const existing = uniquePoints.find((p) => p.date === pt.date);
        if (existing) {
          // Keep the one with higher cumulative (more complete data)
          if (pt.cumulative_admissions > existing.cumulative_admissions) {
            uniquePoints[uniquePoints.indexOf(existing)] = pt;
          }
        } else {
          uniquePoints.push(pt);
        }
      }

      if (uniquePoints.length === 0) continue;

      const latestCumulative = uniquePoints[uniquePoints.length - 1].cumulative_admissions;
      const peakDaily = Math.max(...uniquePoints.map((p) => p.daily_admissions));
      const openingDaily = uniquePoints[0].daily_admissions;

      // Compute week-over-week drop rate (W1 avg / W2 avg)
      let dropRate: number | undefined;
      if (uniquePoints.length >= 7) {
        const week1 = uniquePoints.slice(0, 7);
        const week2 = uniquePoints.slice(7, 14);

        if (week2.length > 0) {
          const avgW1 = week1.reduce((s, p) => s + p.daily_admissions, 0) / week1.length;
          const avgW2 = week2.reduce((s, p) => s + p.daily_admissions, 0) / week2.length;
          if (avgW1 > 0) {
            dropRate = parseFloat((avgW2 / avgW1).toFixed(4));
          }
        }
      }

      tracks.push({
        title_cp: movie.title_cp,
        title_cr: movie.matched_title,
        matched_movie_id: movie.matched_movie_id,
        data_points: uniquePoints,
        latest_cumulative: latestCumulative,
        peak_daily: peakDaily,
        opening_daily: openingDaily,
        days_tracked: uniquePoints.length,
        drop_rate_w1_w2: dropRate,
      });
    }

    // Sort by latest cumulative descending (highest box office first)
    tracks.sort((a, b) => b.latest_cumulative - a.latest_cumulative);

    return NextResponse.json({ success: true, data: tracks });
  } catch (error) {
    console.error('[Competitor Cumulative Error]', error);
    return NextResponse.json({ success: false, error: 'Failed to load cumulative data' }, { status: 500 });
  }
}
