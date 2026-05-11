/**
 * GET /api/competitors/cinepoint/boxoffice
 *
 * Reads box office data from Firestore `cinepoint_box_office` collection.
 * Computes summary analytics for the insights dashboard.
 *
 * Query params:
 *   from  — start date (YYYY-MM-DD), default 30 days ago
 *   to    — end date (YYYY-MM-DD), default today
 *
 * Admin-only.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth-helpers';
import { firestoreRestClient } from '@/lib/firestore-rest';
import { CINEPOINT_BOX_OFFICE, CINEPOINT_BO_SYNC_META } from '@/features/competitors/types';
import type { BoxOfficeDoc } from '@/lib/cinepoint';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const authError = await requireAdmin();
  if (authError) return authError;

  const { searchParams } = new URL(req.url);
  const today = new Date().toISOString().slice(0, 10);
  const fromDate = searchParams.get('from') || new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
  const toDate = searchParams.get('to') || today;

  try {
    // Query Firestore for box office docs in date range
    const docs = await firestoreRestClient.runQuery<BoxOfficeDoc>({
      from: [{ collectionId: CINEPOINT_BOX_OFFICE }],
      where: {
        compositeFilter: {
          op: 'AND',
          filters: [
            {
              fieldFilter: {
                field: { fieldPath: 'date' },
                op: 'GREATER_THAN_OR_EQUAL',
                value: { stringValue: fromDate },
              },
            },
            {
              fieldFilter: {
                field: { fieldPath: 'date' },
                op: 'LESS_THAN_OR_EQUAL',
                value: { stringValue: toDate },
              },
            },
          ],
        },
      },
      orderBy: [{ field: { fieldPath: 'date' }, direction: 'DESCENDING' }],
      limit: 10000,
    });

    if (docs.length === 0) {
      // Also load sync meta to show backfill status
      const syncMeta = await firestoreRestClient.getDocument(CINEPOINT_BO_SYNC_META, 'current');

      return NextResponse.json({
        success: false,
        has_data: false,
        error: 'No box office data found for this date range.',
        sync_meta: syncMeta ? {
          status: syncMeta.status,
          date_start: syncMeta.date_start,
          date_end: syncMeta.date_end,
          last_scraped_date: syncMeta.last_scraped_date,
          docs_written: syncMeta.docs_written,
          dates_scraped: syncMeta.dates_scraped,
        } : null,
      });
    }

    // ── Compute analytics ──

    // Group by date
    const dateMap = new Map<string, BoxOfficeDoc[]>();
    for (const doc of docs) {
      if (!dateMap.has(doc.date)) dateMap.set(doc.date, []);
      dateMap.get(doc.date)!.push(doc);
    }

    // 1. Daily totals (sorted ascending for charts)
    const dailyTotals = [...dateMap.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, movies]) => ({
        date,
        total_admissions: movies.reduce((s, m) => s + m.admission, 0),
        total_showtimes: movies.reduce((s, m) => s + m.showtimes, 0),
        movie_count: movies.length,
        local_admissions: movies.filter((m) => m.type === 'local').reduce((s, m) => s + m.admission, 0),
        international_admissions: movies.filter((m) => m.type === 'international').reduce((s, m) => s + m.admission, 0),
      }));

    // 2. Per-movie time series
    const movieMap = new Map<number, {
      id: number;
      title: string;
      type: string;
      image_title: string | null;
      movie_genre: string[];
      release_date: string;
      daily: { date: string; admission: number; rank: number; change: number; total_admission: number; showtimes: number; score: number }[];
      total_period_admissions: number;
      latest_total_admission: number;
      latest_score: number;
      latest_rank: number | null;
      peak_admission: number;
      opening_admission: number | null;
    }>();

    for (const doc of docs) {
      if (!movieMap.has(doc.movie_id)) {
        movieMap.set(doc.movie_id, {
          id: doc.movie_id,
          title: doc.title,
          type: doc.type,
          image_title: doc.image_title,
          movie_genre: doc.movie_genre,
          release_date: doc.release_date,
          daily: [],
          total_period_admissions: 0,
          latest_total_admission: 0,
          latest_score: 0,
          latest_rank: null,
          peak_admission: 0,
          opening_admission: null,
        });
      }
      const entry = movieMap.get(doc.movie_id)!;
      entry.daily.push({
        date: doc.date,
        admission: doc.admission,
        rank: doc.current_rank,
        change: doc.change,
        total_admission: doc.total_admission,
        showtimes: doc.showtimes,
        score: doc.score,
      });
      entry.total_period_admissions += doc.admission;
      entry.latest_total_admission = doc.total_admission;
      entry.latest_score = doc.score;
      entry.latest_rank = doc.current_rank;
      if (doc.admission > entry.peak_admission) entry.peak_admission = doc.admission;
    }

    // Sort daily arrays ascending for each movie
    for (const entry of movieMap.values()) {
      entry.daily.sort((a, b) => a.date.localeCompare(b.date));
      // Opening admission = first day's admission
      entry.opening_admission = entry.daily[0]?.admission ?? null;
    }

    // Sort movies by total period admissions
    const movieRankings = [...movieMap.values()].sort(
      (a, b) => b.total_period_admissions - a.total_period_admissions,
    );

    // 3. Summary stats
    const uniqueMovies = movieMap.size;
    const grandTotalAdmissions = movieRankings.reduce((s, m) => s + m.total_period_admissions, 0);
    const datesWithData = dailyTotals.length;
    const avgDailyAdmissions = datesWithData > 0 ? Math.round(grandTotalAdmissions / datesWithData) : 0;
    const peakDay = dailyTotals.reduce(
      (best, d) => d.total_admissions > (best?.total_admissions ?? 0) ? d : best,
      dailyTotals[0] as (typeof dailyTotals)[0] | undefined,
    );

    // 4. Top movers (rank improvement)
    const topMovers = movieRankings
      .filter((m) => m.daily.length >= 2)
      .map((m) => {
        const firstRank = m.daily[0].rank;
        const lastRank = m.daily[m.daily.length - 1].rank;
        return { ...m, rank_change: firstRank - lastRank, first_rank: firstRank, last_rank: lastRank };
      })
      .sort((a, b) => b.rank_change - a.rank_change)
      .slice(0, 10);

    // 5. Genre breakdown
    const genreMap = new Map<string, number>();
    for (const m of movieRankings) {
      for (const g of m.movie_genre) {
        genreMap.set(g, (genreMap.get(g) || 0) + m.total_period_admissions);
      }
    }
    const genreBreakdown = [...genreMap.entries()]
      .map(([genre, admissions]) => ({ genre, admissions }))
      .sort((a, b) => b.admissions - a.admissions);

    // 6. Day-of-week patterns
    const dowMap = new Map<string, { total: number; count: number; label: string }>();
    const dowLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    for (const d of dailyTotals) {
      const dow = new Date(d.date + 'T00:00:00').getDay();
      const label = dowLabels[dow];
      if (!dowMap.has(label)) dowMap.set(label, { total: 0, count: 0, label });
      const entry = dowMap.get(label)!;
      entry.total += d.total_admissions;
      entry.count += 1;
    }
    const dayOfWeekPattern = dowLabels
      .map((label) => {
        const entry = dowMap.get(label);
        return {
          day: label,
          avg_admissions: entry ? Math.round(entry.total / entry.count) : 0,
          total_admissions: entry?.total ?? 0,
          days_count: entry?.count ?? 0,
        };
      });

    // 7. New releases (movies whose first appearance in the period has opening-like characteristics)
    const newReleases = movieRankings
      .filter((m) => {
        if (!m.release_date) return false;
        const releaseDate = m.release_date.slice(0, 10);
        return releaseDate >= fromDate && releaseDate <= toDate;
      })
      .sort((a, b) => b.total_period_admissions - a.total_period_admissions);

    return NextResponse.json({
      success: true,
      has_data: true,
      meta: {
        date_range: { start: fromDate, end: toDate },
        days_with_data: datesWithData,
        unique_movies: uniqueMovies,
        grand_total_admissions: grandTotalAdmissions,
        avg_daily_admissions: avgDailyAdmissions,
        peak_day: peakDay ? { date: peakDay.date, admissions: peakDay.total_admissions } : null,
        top_movie: movieRankings[0] ? {
          title: movieRankings[0].title,
          total_period_admissions: movieRankings[0].total_period_admissions,
          latest_total_admission: movieRankings[0].latest_total_admission,
        } : null,
      },
      daily_totals: dailyTotals,
      movie_rankings: movieRankings,
      top_movers: topMovers,
      genre_breakdown: genreBreakdown,
      day_of_week: dayOfWeekPattern,
      new_releases: newReleases,
    });
  } catch (error) {
    console.error('[BoxOffice API Error]', error);
    return NextResponse.json({ success: false, error: 'Failed to load box office data' }, { status: 500 });
  }
}
