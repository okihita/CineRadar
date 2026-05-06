/**
 * GET /api/competitors/trend — 30-day trend data for the dashboard
 *
 * Returns per-day: coverage ratio, confidence score, match rate,
 * delta percentages, and per-movie heatmap data.
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { firestoreRestClient } from '@/lib/firestore-rest';
import {
  COMPETITOR_COLLECTION,
  type CompetitorSnapshot,
  type SnapshotStatus,
  type TrendDay,
  type TrendMovieDay,
  type ConfidenceResult,
} from '@/features/competitors/types';
import { matchShowtimes, matchAdmissions } from '@/features/competitors/matching';
import { buildComparison, computeConfidenceScore, type CineRadarDayPerformance } from '@/features/competitors/comparison';

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const daysParam = parseInt(searchParams.get('days') || '30', 10);
    const days = Math.min(Math.max(daysParam, 7), 90);

    // 1. Fetch all snapshots (we'll filter the last N days)
    const snapshots = await firestoreRestClient.getCollectionWithQuery<CompetitorSnapshot>(
      COMPETITOR_COLLECTION,
      'date',
      days + 10, // slight buffer for date gaps
    );

    // 2. Fetch all CineRadar movies once for matching
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

    // 3. Build date range (last N days, descending for priority)
    const today = new Date();
    const dateRange: string[] = [];
    for (let i = 0; i < days; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      dateRange.push(d.toISOString().split('T')[0]);
    }

    // Index snapshots by date
    const snapByDate = new Map<string, CompetitorSnapshot>();
    for (const s of snapshots) {
      const d = s.date || s.id;
      if (d) snapByDate.set(d, s);
    }

    // 4. Collect all unique matched movie IDs across all dates for batch perf fetch
    const allMatchedIds = new Set<string>();
    const matchCache = new Map<string, { showtimes: ReturnType<typeof matchShowtimes>; admissions: ReturnType<typeof matchAdmissions> }>();

    for (const date of dateRange) {
      const snap = snapByDate.get(date);
      if (!snap) continue;

      const mResult = {
        showtimes: snap.showtimes_parsed && snap.showtimes_parsed.length > 0
          ? matchShowtimes(snap.showtimes_parsed, crMovies)
          : { items: snap.showtimes_parsed || [], unmatched: [], matchCount: 0 },
        admissions: snap.admissions_parsed && snap.admissions_parsed.length > 0
          ? matchAdmissions(snap.admissions_parsed, crMovies)
          : { items: snap.admissions_parsed || [], unmatched: [], matchCount: 0 },
      };

      matchCache.set(date, mResult);

      for (const s of mResult.showtimes.items) {
        if (s.matched_movie_id) allMatchedIds.add(s.matched_movie_id);
      }
      for (const a of mResult.admissions.items) {
        if (a.matched_movie_id) allMatchedIds.add(a.matched_movie_id);
      }
    }

    // 5. Batch-fetch CineRadar performance for all matched movies across all dates
    // Structure: Map<"movieId|date", { total_showtimes, total_sold }>
    const perfCache = new Map<string, { total_showtimes: number; total_sold: number }>();

    await Promise.all(
      [...allMatchedIds].map(async (movieId) => {
        await Promise.all(
          dateRange.map(async (date) => {
            const dayData = await firestoreRestClient.getDocument<{
              total_showtimes?: number;
              total_sold?: number;
            }>(`movie_performance_v2/${movieId}/days`, date);

            perfCache.set(`${movieId}|${date}`, {
              total_showtimes: dayData?.total_showtimes || 0,
              total_sold: dayData?.total_sold || 0,
            });
          }),
        );
      }),
    );

    // 6. Build trend data per date
    const trendDays: TrendDay[] = [];

    for (const date of dateRange) {
      const snap = snapByDate.get(date);
      const mResult = matchCache.get(date);

      if (!snap || !mResult) {
        // No data for this date
        trendDays.push({
          date,
          status: 'empty' as SnapshotStatus,
          confidence: null,
          coverage_ratio: null,
          showtime_delta_pct: null,
          admission_delta_pct: null,
          match_rate: null,
          total_cp_showtimes: 0,
          total_cr_showtimes: 0,
          total_cp_admissions: 0,
          total_cr_admissions: 0,
          movies: [],
        });
        continue;
      }

      // Build CineRadar performance for this date from cache
      const matchedShowtimes = mResult.showtimes.items;
      const matchedAdmissions = mResult.admissions.items;

      const crPerformances: CineRadarDayPerformance[] = [];
      const seenIds = new Set<string>();

      for (const s of matchedShowtimes) {
        if (s.matched_movie_id && !seenIds.has(s.matched_movie_id)) {
          seenIds.add(s.matched_movie_id);
          const perf = perfCache.get(`${s.matched_movie_id}|${date}`);
          const movie = crMovies.find((m) => m.movie_id === s.matched_movie_id);
          crPerformances.push({
            movie_id: s.matched_movie_id,
            title: movie?.title || s.matched_movie_id,
            total_showtimes: perf?.total_showtimes || 0,
            total_sold: perf?.total_sold || 0,
          });
        }
      }
      for (const a of matchedAdmissions) {
        if (a.matched_movie_id && !seenIds.has(a.matched_movie_id)) {
          seenIds.add(a.matched_movie_id);
          const perf = perfCache.get(`${a.matched_movie_id}|${date}`);
          const movie = crMovies.find((m) => m.movie_id === a.matched_movie_id);
          crPerformances.push({
            movie_id: a.matched_movie_id,
            title: movie?.title || a.matched_movie_id,
            total_showtimes: perf?.total_showtimes || 0,
            total_sold: perf?.total_sold || 0,
          });
        }
      }

      // Build comparison
      const { summary } = buildComparison(matchedShowtimes, matchedAdmissions, crPerformances);

      // Status
      let status: SnapshotStatus = 'empty';
      if (matchedShowtimes.length > 0 && matchedAdmissions.length > 0) status = 'complete';
      else if (matchedShowtimes.length > 0) status = 'showtimes_only';
      else if (matchedAdmissions.length > 0) status = 'admissions_only';

      // Confidence
      let confidence: ConfidenceResult | null = null;
      if (status !== 'empty') {
        confidence = computeConfidenceScore(summary);
      }

      // Coverage ratio
      const coverageRatio = summary.total_cp_showtimes > 0
        ? summary.total_cr_showtimes / summary.total_cp_showtimes
        : null;

      // Per-movie heatmap data
      const allCpTitles = new Set<string>([
        ...matchedShowtimes.map((s) => s.title_cp),
        ...matchedAdmissions.map((a) => a.title_cp),
      ]);

      const movieDays: TrendMovieDay[] = [];
      for (const title of allCpTitles) {
        const showtime = matchedShowtimes.find((s) => s.title_cp === title);
        const admission = matchedAdmissions.find((a) => a.title_cp === title);
        const movieId = showtime?.matched_movie_id || admission?.matched_movie_id;
        const perf = movieId ? crPerformances.find((p) => p.movie_id === movieId) : undefined;

        let showDeltaPct: number | null = null;
        if (showtime && perf && showtime.showtimes > 0) {
          showDeltaPct = parseFloat((((perf.total_showtimes - showtime.showtimes) / showtime.showtimes) * 100).toFixed(2));
        }

        let admDeltaPct: number | null = null;
        if (admission && perf && admission.daily_admissions > 0) {
          admDeltaPct = parseFloat((((perf.total_sold - admission.daily_admissions) / admission.daily_admissions) * 100).toFixed(2));
        }

        movieDays.push({
          title_cp: title,
          matched: !!movieId,
          showtime_delta_pct: showDeltaPct,
          admission_delta_pct: admDeltaPct,
        });
      }

      trendDays.push({
        date,
        status,
        confidence,
        coverage_ratio: coverageRatio !== null ? parseFloat(coverageRatio.toFixed(4)) : null,
        showtime_delta_pct: summary.showtime_delta_pct,
        admission_delta_pct: summary.admission_delta_pct,
        match_rate: summary.total_cp_movies > 0
          ? parseFloat((summary.matched_movies / summary.total_cp_movies).toFixed(4))
          : null,
        total_cp_showtimes: summary.total_cp_showtimes,
        total_cr_showtimes: summary.total_cr_showtimes,
        total_cp_admissions: summary.total_cp_admissions,
        total_cr_admissions: summary.total_cr_admissions,
        movies: movieDays,
      });
    }

    return NextResponse.json({ success: true, data: trendDays });
  } catch (error) {
    console.error('[Competitor Trend Error]', error);
    return NextResponse.json({ success: false, error: 'Failed to load trend data' }, { status: 500 });
  }
}
