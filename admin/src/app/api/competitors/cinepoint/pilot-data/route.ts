/**
 * GET /api/competitors/cinepoint/pilot-data
 *
 * Reads the local pilot scrape JSON file and returns it.
 * Also computes summary analytics.
 *
 * Admin-only.
 */

import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth-helpers';
import * as fs from 'fs';
import * as path from 'path';

export const dynamic = 'force-dynamic';

const DATA_FILE = path.join(process.cwd(), 'data', 'cinepoint-pilot.json');

interface BoxOfficeMovie {
  id: number;
  title: string;
  image_title: string | null;
  movie_genre: string[];
  duration: number;
  release_date: string;
  type: 'local' | 'international';
  admission: number;
  total_admission: number;
  change: number;
  showtimes: number;
  score: number;
  rank: { current_rank: number; last_rank?: number };
}

interface DayData {
  date: string;
  movies: BoxOfficeMovie[];
  scraped_at: string;
}

export async function GET() {
  const authError = await requireAdmin();
  if (authError) return authError;

  if (!fs.existsSync(DATA_FILE)) {
    return NextResponse.json({
      success: false,
      error: 'No pilot data found. Run pilot-scrape first.',
      has_data: false,
    });
  }

  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf-8');
    const data = JSON.parse(raw) as {
      scraped_at: string;
      days_scraped: number;
      date_range: { start: string; end: string };
      days: DayData[];
    };

    // ── Compute analytics ──

    // 1. Daily totals
    const dailyTotals = data.days.map((d) => ({
      date: d.date,
      total_admissions: d.movies.reduce((s, m) => s + m.admission, 0),
      total_showtimes: d.movies.reduce((s, m) => s + m.showtimes, 0),
      movie_count: d.movies.length,
      local_admissions: d.movies.filter((m) => m.type === 'local').reduce((s, m) => s + m.admission, 0),
      international_admissions: d.movies.filter((m) => m.type === 'international').reduce((s, m) => s + m.admission, 0),
    }));

    // 2. Per-movie time series (movies that appeared on any day)
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
    }>();

    for (const day of data.days) {
      for (const m of day.movies) {
        if (!movieMap.has(m.id)) {
          movieMap.set(m.id, {
            id: m.id,
            title: m.title,
            type: m.type,
            image_title: m.image_title,
            movie_genre: m.movie_genre,
            release_date: m.release_date,
            daily: [],
            total_period_admissions: 0,
            latest_total_admission: 0,
            latest_score: 0,
            latest_rank: null,
          });
        }
        const entry = movieMap.get(m.id)!;
        entry.daily.push({
          date: day.date,
          admission: m.admission,
          rank: m.rank.current_rank,
          change: m.change,
          total_admission: m.total_admission,
          showtimes: m.showtimes,
          score: m.score,
        });
        entry.total_period_admissions += m.admission;
        entry.latest_total_admission = m.total_admission;
        entry.latest_score = m.score;
        entry.latest_rank = m.rank.current_rank;
      }
    }

    // Sort movies by total period admissions
    const movieRankings = [...movieMap.values()].sort(
      (a, b) => b.total_period_admissions - a.total_period_admissions,
    );

    // 3. Summary stats
    const uniqueMovies = movieMap.size;
    const grandTotalAdmissions = movieRankings.reduce((s, m) => s + m.total_period_admissions, 0);
    const avgDailyAdmissions = grandTotalAdmissions / data.days_scraped;
    const peakDay = dailyTotals.reduce((best, d) => d.total_admissions > best.total_admissions ? d : best, dailyTotals[0]);

    // 4. Top movers (biggest rank improvement from first to last appearance)
    const topMovers = movieRankings
      .filter((m) => m.daily.length >= 2)
      .map((m) => {
        const firstRank = m.daily[0].rank;
        const lastRank = m.daily[m.daily.length - 1].rank;
        return { ...m, rank_change: firstRank - lastRank, first_rank: firstRank, last_rank: lastRank };
      })
      .sort((a, b) => b.rank_change - a.rank_change)
      .slice(0, 10);

    return NextResponse.json({
      success: true,
      has_data: true,
      meta: {
        scraped_at: data.scraped_at,
        days_scraped: data.days_scraped,
        date_range: data.date_range,
        unique_movies: uniqueMovies,
        grand_total_admissions: grandTotalAdmissions,
        avg_daily_admissions: Math.round(avgDailyAdmissions),
        peak_day: peakDay ? { date: peakDay.date, admissions: peakDay.total_admissions } : null,
      },
      daily_totals: dailyTotals,
      movie_rankings: movieRankings,
      top_movers: topMovers,
      raw_days: data.days,
    });
  } catch (error) {
    console.error('[Pilot Data Error]', error);
    return NextResponse.json({ success: false, error: 'Failed to parse pilot data' }, { status: 500 });
  }
}
