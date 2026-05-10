/**
 * GET /api/competitors/cinepoint/movies/[id]/detail
 *
 * Returns enriched movie detail (casts, description, language, trailer, etc.)
 * from cinepoint_movies Firestore collection.
 *
 * Admin-only.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth-helpers';
import { firestoreRestClient } from '@/lib/firestore-rest';
import { CINEPOINT_CATALOG } from '@/features/competitors/types';
import type { CinePointMovie } from '@/features/competitors/types';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authError = await requireAdmin();
  if (authError) return authError;

  try {
    const { id } = await params;
    const movieId = parseInt(id, 10);
    if (isNaN(movieId)) {
      return NextResponse.json({ success: false, error: 'Invalid movie ID' }, { status: 400 });
    }

    const movie = await firestoreRestClient.getDocument<CinePointMovie>(
      CINEPOINT_CATALOG,
      String(movieId),
    );

    if (!movie) {
      return NextResponse.json({ success: false, error: 'Movie not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: movie,
    });
  } catch (error) {
    console.error('[CinePoint Movie Detail Error]', error);
    return NextResponse.json({ success: false, error: 'Failed to load movie detail' }, { status: 500 });
  }
}
