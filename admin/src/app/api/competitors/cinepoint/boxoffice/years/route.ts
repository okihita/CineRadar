/**
 * GET /api/competitors/cinepoint/boxoffice/years
 *
 * Returns yearly summaries: best movie per year, total admissions,
 * market composition. Queries Firestore per year in parallel.
 *
 * Admin-only.
 */

import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth-helpers';
import { queryBoxOfficeDocs, aggregateYearlyTotals } from '@/lib/cinepoint/firestore-queries';
import type { YearSummary } from '@/lib/cinepoint';

export const dynamic = 'force-dynamic';

export async function GET() {
  const authError = await requireAdmin();
  if (authError) return authError;

  const currentYear = new Date().getFullYear();
  const years = [];
  for (let y = 2000; y <= currentYear; y++) years.push(y);

  try {
    const results = await Promise.all(
      years.map(async (year): Promise<YearSummary> => {
        const from = `${year}-01-01`;
        const to = `${year}-12-31`;

        const docs = await queryBoxOfficeDocs(from, to);

        if (docs.length === 0) {
          return { year, dates_with_data: 0, total_admissions: 0, local_admissions: 0, international_admissions: 0, unique_movies: 0, top_movie: null, top_local: null, top_international: null };
        }

        // Shared aggregation
        const { datesSet, movieMap, localTotal, intlTotal } = aggregateYearlyTotals(docs);

        const sorted = [...movieMap.entries()].sort((a, b) => b[1].total - a[1].total);
        const top = sorted[0];
        const topLocal = sorted.filter(([, m]) => m.type === 'local')[0];
        const topIntl = sorted.filter(([, m]) => m.type === 'international')[0];

        return {
          year,
          dates_with_data: datesSet.size,
          total_admissions: localTotal + intlTotal,
          local_admissions: localTotal,
          international_admissions: intlTotal,
          unique_movies: movieMap.size,
          top_movie: top ? { movie_id: top[0], title: top[1].title, type: top[1].type, total_admissions: top[1].total, movie_genre: top[1].genre, release_date: top[1].release_date, score: top[1].score } : null,
          top_local: topLocal ? { movie_id: topLocal[0], title: topLocal[1].title, total_admissions: topLocal[1].total, movie_genre: topLocal[1].genre } : null,
          top_international: topIntl ? { movie_id: topIntl[0], title: topIntl[1].title, total_admissions: topIntl[1].total, movie_genre: topIntl[1].genre } : null,
        };
      }),
    );

    const yearsWithData = results.filter((y) => y.dates_with_data > 0);

    return NextResponse.json({
      success: true,
      years: yearsWithData,
      total_years: yearsWithData.length,
    });
  } catch (error) {
    console.error('[BoxOffice Years API Error]', error);
    return NextResponse.json({ success: false, error: 'Failed to load yearly data' }, { status: 500 });
  }
}
