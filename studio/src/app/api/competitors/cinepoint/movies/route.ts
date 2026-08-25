/**
 * GET /api/competitors/cinepoint/movies — browse scraped CinePoint catalog
 *
 * Query params:
 *   page    — page number (default 0)
 *   limit   — page size (default 24, max 100)
 *   type    — filter by "local" | "international"
 *   search  — fuzzy search by title
 *   sort    — sort column: id | title | type | release_date | duration | matched (default: release_date)
 *   dir     — sort direction: asc | desc (default: desc)
 *
 * Admin-only.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth-helpers';
import { firestoreRestClient } from '@/lib/firestore-rest';
import { CINEPOINT_CATALOG, CINEPOINT_SYNC_META } from '@/features/competitors/types';
import type { CinePointMovie, CinePointSyncMeta } from '@/features/competitors/types';

const VALID_SORT_COLS = ['id', 'title', 'type', 'release_date', 'duration', 'matched'] as const;
type SortCol = typeof VALID_SORT_COLS[number];

export async function GET(req: NextRequest) {
  const authError = await requireAdmin();
  if (authError) return authError;

  try {
    const { searchParams } = new URL(req.url);
    const limit = Math.min(parseInt(searchParams.get('limit') ?? '24'), 100);
    const typeFilter = searchParams.get('type');
    const search = searchParams.get('search')?.toLowerCase().trim();
    const sortCol: SortCol = VALID_SORT_COLS.includes(searchParams.get('sort') as SortCol)
      ? (searchParams.get('sort') as SortCol)
      : 'release_date';
    const sortDir = searchParams.get('dir') === 'asc' ? 'asc' : 'desc';

    // Fetch all movies (catalog is small enough: ~4000 docs)
    const allMovies = await firestoreRestClient.getCollectionWithQuery<CinePointMovie>(
      CINEPOINT_CATALOG,
      'id',
      10000,
    );

    // Apply filters
    let filtered = allMovies;
    if (typeFilter) {
      filtered = filtered.filter((m) => m.type === typeFilter);
    }
    if (search) {
      filtered = filtered.filter((m) => m.title_cp?.includes(search));
    }

    // Server-side sort
    const dir = sortDir === 'asc' ? 1 : -1;
    filtered.sort((a, b) => {
      let cmp = 0;
      switch (sortCol) {
        case 'id': cmp = a.id - b.id; break;
        case 'title': cmp = (a.title || '').localeCompare(b.title || ''); break;
        case 'type': cmp = (a.type || '').localeCompare(b.type || ''); break;
        case 'release_date': cmp = (a.release_date || '').localeCompare(b.release_date || ''); break;
        case 'duration': cmp = (a.duration || 0) - (b.duration || 0); break;
        case 'matched': cmp = (a.matched_movie_id ? 1 : 0) - (b.matched_movie_id ? 1 : 0); break;
      }
      return cmp * dir;
    });

    // Pagination
    const page = parseInt(searchParams.get('page') ?? '0');
    const start = page * limit;
    const paged = filtered.slice(start, start + limit);

    // Load sync metadata
    let syncMeta: CinePointSyncMeta | null = null;
    try {
      syncMeta = await firestoreRestClient.getDocument<CinePointSyncMeta>(CINEPOINT_SYNC_META, 'current');
    } catch { /* no sync yet */ }

    // Compute stats
    const stats = {
      total_movies: allMovies.length,
      local: allMovies.filter((m) => m.type === 'local').length,
      international: allMovies.filter((m) => m.type === 'international').length,
      matched: allMovies.filter((m) => m.matched_movie_id).length,
      unmatched: allMovies.filter((m) => !m.matched_movie_id).length,
      with_poster: allMovies.filter((m) => m.image_title).length,
      genres: [...new Set(allMovies.flatMap((m) => m.movie_genre))].sort(),
    };

    return NextResponse.json({
      success: true,
      data: {
        movies: paged,
        pagination: {
          page,
          limit,
          total: filtered.length,
          total_pages: Math.ceil(filtered.length / limit),
          sort: sortCol,
          dir: sortDir,
        },
        stats,
        sync: syncMeta ? {
          status: syncMeta.status,
          total_movies: syncMeta.total_movies,
          movies_scraped: syncMeta.movies_scraped,
          pages_scraped: syncMeta.pages_scraped,
          last_scraped_page: syncMeta.last_scraped_page,
          started_at: syncMeta.started_at,
          completed_at: syncMeta.completed_at,
          error_message: syncMeta.error_message,
        } : null,
      },
    });
  } catch (error) {
    console.error('[CinePoint Movies Error]', error);
    return NextResponse.json({ success: false, error: 'Failed to load catalog' }, { status: 500 });
  }
}
