/**
 * Shared Firestore query helpers for CinePoint box office data.
 *
 * Eliminates duplicated query construction and per-movie aggregation
 * between the boxoffice and years API routes.
 */

import { firestoreRestClient } from '@/lib/firestore-rest';
import { CINEPOINT_BOX_OFFICE } from '@/features/competitors/types';
import type { BoxOfficeDoc, MovieRanking, MovieDaily } from '@/lib/cinepoint';

/** Query box office documents for a date range */
export async function queryBoxOfficeDocs(from: string, to: string, limit = 10000): Promise<BoxOfficeDoc[]> {
  return firestoreRestClient.runQuery<BoxOfficeDoc>({
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
    limit,
  });
}

/** Per-movie aggregation result */
export interface AggregatedMovie {
  id: number;
  title: string;
  type: string;
  image_title: string | null;
  movie_genre: string[];
  release_date: string;
  daily: MovieDaily[];
  total_period_admissions: number;
  latest_total_admission: number;
  latest_score: number;
  latest_rank: number | null;
  peak_admission: number;
  opening_admission: number | null;
}

/** Aggregate raw docs into per-movie rankings sorted by total period admissions */
export function aggregateByMovie(docs: BoxOfficeDoc[]): AggregatedMovie[] {
  const movieMap = new Map<number, AggregatedMovie>();

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

  // Sort daily arrays and set opening admission
  for (const entry of movieMap.values()) {
    entry.daily.sort((a, b) => a.date.localeCompare(b.date));
    entry.opening_admission = entry.daily[0]?.admission ?? null;
  }

  return [...movieMap.values()].sort((a, b) => b.total_period_admissions - a.total_period_admissions);
}

/** Lightweight per-movie aggregation for yearly summaries (no daily array) */
export function aggregateYearlyTotals(docs: BoxOfficeDoc[]): {
  datesSet: Set<string>;
  movieMap: Map<number, { title: string; type: string; total: number; genre: string[]; release_date: string; score: number }>;
  localTotal: number;
  intlTotal: number;
} {
  const datesSet = new Set<string>();
  const movieMap = new Map<number, { title: string; type: string; total: number; genre: string[]; release_date: string; score: number }>();
  let localTotal = 0;
  let intlTotal = 0;

  for (const doc of docs) {
    datesSet.add(doc.date);
    const existing = movieMap.get(doc.movie_id);
    if (existing) {
      existing.total += doc.admission;
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

  return { datesSet, movieMap, localTotal, intlTotal };
}
