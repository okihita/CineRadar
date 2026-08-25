/**
 * GET /api/competitors/[date] — full snapshot + comparison data
 *
 * Fetches the CinePoint snapshot for a date, then fetches CineRadar's
 * performance data for the same date to enable client-side comparison.
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { firestoreRestClient } from '@/lib/firestore-rest';
import { COMPETITOR_COLLECTION, type CompetitorSnapshot } from '@/features/competitors/types';
import { matchShowtimes, matchAdmissions } from '@/features/competitors/matching';
import { buildComparison, type CineRadarDayPerformance } from '@/features/competitors/comparison';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ date: string }> },
) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const { date } = await params;

  // Validate date format
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ success: false, error: 'Invalid date format' }, { status: 400 });
  }

  try {
    // 1. Get CinePoint snapshot
    const snapshot = await firestoreRestClient.getDocument<CompetitorSnapshot>(
      COMPETITOR_COLLECTION,
      date,
    );

    if (!snapshot) {
      // Still return cinema count even when no snapshot exists
      const allTheatres = await firestoreRestClient.getCollection<{ id: string }>('theatres', ['id']);

      return NextResponse.json({
        success: true,
        data: {
          snapshot: null,
          comparison: null,
          cr_movies: [],
          cinema_count: allTheatres.length,
        },
      });
    }

    // 2. Get all CineRadar movies for matching
    const rawMovies = await firestoreRestClient.getCollection<{
      id: string;
      movie_id?: string;
      name?: string;
      title?: string;
    }>('movies');

    const crMovies = rawMovies.map((m) => ({
      id: m.id,
      movie_id: m.movie_id || m.id,
      title: m.name || m.title || '',
    }));

    // 3. Run matching on parsed data
    let matchedShowtimes = snapshot.showtimes?.parsed;
    let matchedAdmissions = snapshot.admissions?.parsed;

    if (matchedShowtimes && matchedShowtimes.length > 0) {
      const result = matchShowtimes(matchedShowtimes, crMovies);
      matchedShowtimes = result.items;
    }

    if (matchedAdmissions && matchedAdmissions.length > 0) {
      const result = matchAdmissions(matchedAdmissions, crMovies);
      matchedAdmissions = result.items;
    }

    // 4. Collect matched movie IDs and fetch their CineRadar performance
    const matchedIds = new Set<string>();
    matchedShowtimes?.forEach((s) => { if (s.matched_movie_id) matchedIds.add(s.matched_movie_id); });
    matchedAdmissions?.forEach((a) => { if (a.matched_movie_id) matchedIds.add(a.matched_movie_id); });

    const crPerformances: CineRadarDayPerformance[] = [];
    await Promise.all(
      [...matchedIds].map(async (movieId) => {
        const dayData = await firestoreRestClient.getDocument<{
          total_showtimes?: number;
          total_sold?: number;
        }>(`movie_performance_v2/${movieId}/days`, date);

        const movie = crMovies.find((m) => m.movie_id === movieId || m.id === movieId);
        crPerformances.push({
          movie_id: movieId,
          title: movie?.title || movieId,
          total_showtimes: dayData?.total_showtimes || 0,
          total_sold: dayData?.total_sold || 0,
        });
      }),
    );

    // 5. Get total theatre count for coverage context
    const allTheatres = await firestoreRestClient.getCollection<{ id: string }>('theatres', ['id']);

    // 6. Build comparison
    const { rows, summary } = buildComparison(
      matchedShowtimes,
      matchedAdmissions,
      crPerformances,
    );

    return NextResponse.json({
      success: true,
      data: {
        snapshot: {
          date: snapshot.date || snapshot.id,
          showtimes: snapshot.showtimes ? { ...snapshot.showtimes, parsed: matchedShowtimes } : null,
          admissions: snapshot.admissions ? { ...snapshot.admissions, parsed: matchedAdmissions } : null,
        },
        comparison: { rows, summary },
        cr_movies: crMovies.filter((m) => m.title), // for manual matching dropdown
        cinema_count: allTheatres.length,
      },
    });
  } catch (error) {
    console.error('[Competitor Snapshot Error]', error);
    return NextResponse.json({ success: false, error: 'Failed to load snapshot' }, { status: 500 });
  }
}
