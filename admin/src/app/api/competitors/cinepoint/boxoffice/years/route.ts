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
import { firestoreRestClient } from '@/lib/firestore-rest';
import { CINEPOINT_BOX_OFFICE } from '@/features/competitors/types';

export const dynamic = 'force-dynamic';

interface BoxOfficeDoc {
  id: string;
  date: string;
  movie_id: number;
  title: string;
  type: 'local' | 'international';
  admission: number;
  total_admission: number;
  movie_genre: string[];
  release_date: string;
  score: number;
  current_rank: number;
}

interface YearSummary {
  year: number;
  dates_with_data: number;
  total_admissions: number;
  local_admissions: number;
  international_admissions: number;
  unique_movies: number;
  top_movie: {
    movie_id: number;
    title: string;
    type: string;
    total_admissions: number;
    movie_genre: string[];
    release_date: string;
    score: number;
  } | null;
  top_local: {
    movie_id: number;
    title: string;
    total_admissions: number;
    movie_genre: string[];
  } | null;
  top_international: {
    movie_id: number;
    title: string;
    total_admissions: number;
    movie_genre: string[];
  } | null;
}

export async function GET() {
  const authError = await requireAdmin();
  if (authError) return authError;

  const currentYear = new Date().getFullYear();
  const years = [];
  for (let y = 2000; y <= currentYear; y++) years.push(y);

  try {
    // Query each year in parallel
    const results = await Promise.all(
      years.map(async (year): Promise<YearSummary> => {
        const from = `${year}-01-01`;
        const to = `${year}-12-31`;

        const docs = await firestoreRestClient.runQuery<BoxOfficeDoc>({
          from: [{ collectionId: CINEPOINT_BOX_OFFICE }],
          where: {
            compositeFilter: {
              op: 'AND',
              filters: [
                { fieldFilter: { field: { fieldPath: 'date' }, op: 'GREATER_THAN_OR_EQUAL', value: { stringValue: from } } },
                { fieldFilter: { field: { fieldPath: 'date' }, op: 'LESS_THAN_OR_EQUAL', value: { stringValue: to } } },
              ],
            },
          },
          orderBy: [{ field: { fieldPath: 'date' }, direction: 'DESCENDING' }],
          limit: 10000,
        });

        if (docs.length === 0) {
          return { year, dates_with_data: 0, total_admissions: 0, local_admissions: 0, international_admissions: 0, unique_movies: 0, top_movie: null, top_local: null, top_international: null };
        }

        // Aggregate per movie
        const datesSet = new Set<string>();
        const movieMap = new Map<number, { title: string; type: string; total: number; genre: string[]; release_date: string; score: number }>();
        let localTotal = 0;
        let intlTotal = 0;

        for (const doc of docs) {
          datesSet.add(doc.date);
          const existing = movieMap.get(doc.movie_id);
          if (existing) {
            existing.total += doc.admission;
            // Keep latest score
            existing.score = doc.score;
          } else {
            movieMap.set(doc.movie_id, {
              title: doc.title,
              type: doc.type,
              total: doc.admission,
              genre: doc.movie_genre,
              release_date: doc.release_date,
              score: doc.score,
            });
          }
          if (doc.type === 'local') localTotal += doc.admission;
          else intlTotal += doc.admission;
        }

        // Sort movies by total admissions
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

    // Only return years that have data
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
