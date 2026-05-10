/**
 * GET /api/competitors/cinepoint/analysis
 *
 * Returns lightweight raw movie data for client-side analysis.
 * Uses Firestore field selection to minimize payload (only 12 fields per doc).
 *
 * Admin-only.
 */

import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth-helpers';
import { firestoreRestClient } from '@/lib/firestore-rest';
import { CINEPOINT_CATALOG } from '@/features/competitors/types';

export const dynamic = 'force-dynamic';

// Only the fields we need for analysis — not the full enriched document
const SELECT_FIELDS = [
  'id', 'title', 'type', 'language', 'movie_genre', 'duration',
  'total_admission', 'score', 'rating_category', 'casts', 'release_date',
];

interface RawMovie {
  id: number;
  title: string;
  type: string;
  language: string;
  movie_genre: string[];
  duration: number;
  total_admission: number;
  score: number;
  rating_category: string[];
  casts: { role: string; names: string[] }[];
  release_date: string;
}

interface AnalysisMovie {
  id: number;
  title: string;
  type: string;
  language: string;
  genres: string[];
  duration: number;
  total_admission: number;
  score: number;
  rating_category: string[];
  directors: string[];
  actors: string[];
  release_year: number;
}

export async function GET() {
  const authError = await requireAdmin();
  if (authError) return authError;

  try {
    const raw = await firestoreRestClient.getCollectionWithSelect<RawMovie>(
      CINEPOINT_CATALOG,
      SELECT_FIELDS,
      'id',
      10000,
    );

    const data: AnalysisMovie[] = raw.map((m) => {
      const casts = m.casts ?? [];
      let releaseYear = 0;
      if (m.release_date) {
        const match = m.release_date.match(/^(\d{4})/);
        if (match) releaseYear = parseInt(match[1], 10);
      }

      return {
        id: m.id,
        title: m.title,
        type: m.type ?? 'unknown',
        language: m.language ?? '',
        genres: m.movie_genre ?? [],
        duration: m.duration ?? 0,
        total_admission: m.total_admission ?? 0,
        score: m.score ?? 0,
        rating_category: m.rating_category ?? [],
        directors: casts.find((c) => c.role === 'directors')?.names?.filter((n) => n && n.length > 1 && n !== 'abc' && n !== 'dir') ?? [],
        actors: casts.find((c) => c.role === 'casts')?.names?.filter((n) => n && n.length > 1) ?? [],
        release_year: releaseYear,
      };
    });

    return NextResponse.json({
      success: true,
      count: data.length,
      data,
    });
  } catch (error) {
    console.error('[CinePoint Analysis Error]', error);
    return NextResponse.json({ success: false, error: 'Failed to load analysis data' }, { status: 500 });
  }
}
