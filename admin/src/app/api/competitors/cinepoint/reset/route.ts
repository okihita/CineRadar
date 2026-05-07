/**
 * POST /api/competitors/cinepoint/reset — clear all catalog data + sync state
 *
 * Deletes the sync metadata document AND all movie documents.
 * Full clean slate for a fresh start.
 *
 * Admin-only.
 */

import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth-helpers';
import { firestoreRestClient } from '@/lib/firestore-rest';
import { CINEPOINT_CATALOG, CINEPOINT_SYNC_META } from '@/features/competitors/types';
import type { CinePointMovie } from '@/features/competitors/types';

export async function POST() {
  const authError = await requireAdmin();
  if (authError) return authError;

  try {
    // Delete all movie documents
    const movies = await firestoreRestClient.getCollectionWithQuery<CinePointMovie>(
      CINEPOINT_CATALOG,
      'id',
      10000,
    );

    let deleted = 0;
    for (const movie of movies) {
      await firestoreRestClient.deleteDocument(CINEPOINT_CATALOG, String(movie.id));
      deleted++;
    }

    // Delete sync metadata
    try {
      await firestoreRestClient.deleteDocument(CINEPOINT_SYNC_META, 'current');
    } catch { /* might not exist */ }

    return NextResponse.json({
      success: true,
      message: `Cleared ${deleted} movies + sync state`,
      deleted,
    });
  } catch (err) {
    console.error('[CinePoint Reset Error]', err);
    return NextResponse.json({ success: false, error: 'Failed to reset catalog' }, { status: 500 });
  }
}
