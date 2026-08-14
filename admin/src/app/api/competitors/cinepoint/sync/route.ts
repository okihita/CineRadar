/**
 * POST /api/competitors/cinepoint/sync — SSE endpoint for CinePoint catalog backfill
 *
 * Body: { token: string } — CinePoint Bearer token (JWT)
 *
 * Streams SSE events with progress updates.
 * 3-page validation gate (informational — auto-continues).
 * Stores checkpoint after each page for resume capability.
 *
 * Admin-only.
 */

import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/auth-helpers';
import { firestoreRestClient } from '@/lib/firestore-rest';
import { CINEPOINT_CATALOG, CINEPOINT_SYNC_META } from '@/features/competitors/types';
import type { CinePointMovie, CinePointSyncMeta } from '@/features/competitors/types';

export const dynamic = 'force-dynamic';

const PAGE_LIMIT = 25;
const DELAY_MS = 3000; // 3 seconds between requests
const GATE_PAGES = 3; // Validate first 3 pages before continuing

export async function POST(req: NextRequest) {
  const authError = await requireAdmin();
  if (authError) return authError;

  let token: string;
  try {
    const body = await req.json();
    token = body.token;
  } catch {
    token = '';
  }

  if (!token) {
    return new Response(JSON.stringify({ error: 'Missing token in body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Set up SSE stream
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };

      const sendLog = (message: string) => {
        send('log', { message, ts: new Date().toISOString() });
      };

      try {
        // Load or create sync metadata
        let meta = await loadMeta();
        if (meta?.status === 'running') {
          send('error', { message: 'Sync already in progress. Wait or clear state.' });
          controller.close();
          return;
        }

        const now = new Date().toISOString();
        meta = {
          id: 'current',
          status: 'running',
          total_movies: 0,
          total_pages: 0,
          last_scraped_page: meta?.last_scraped_page ?? -1,
          limit: PAGE_LIMIT,
          movies_scraped: meta?.movies_scraped ?? 0,
          pages_scraped: meta?.pages_scraped ?? 0,
          started_at: meta?.started_at ?? now,
          completed_at: null,
          error_message: null,
          auth_token: token,
        };

        // ── Phase 1: Discover total ──
        sendLog('Fetching page 0 to discover total...');
        const page0 = await fetchPage(0, PAGE_LIMIT, token);
        if (!page0) {
          throw new Error('Failed to fetch page 0 — token may be expired');
        }

        meta.total_movies = page0.pagination.total;
        meta.total_pages = Math.ceil(meta.total_movies / PAGE_LIMIT);

        send('discovered', {
          total_movies: meta.total_movies,
          total_pages: meta.total_pages,
          resuming_from: meta.last_scraped_page + 1,
        });

        await saveMeta(meta);

        // Upsert page 0 if not already done
        if (meta.last_scraped_page < 0) {
          await upsertMovies(page0.movies, now);
          meta.movies_scraped += page0.movies.length;
          meta.pages_scraped += 1;
          meta.last_scraped_page = 0;
          await saveMeta(meta);
          send('page', { page: 0, count: page0.movies.length, total_scraped: meta.movies_scraped });
        }

        // ── Phase 2: Scrape pages 1..N ──
        const startPage = meta.last_scraped_page + 1;
        const endPage = meta.total_pages;

        for (let page = startPage; page < endPage; page++) {
          // Gate: after GATE_PAGES, confirm we're good
          if (page === GATE_PAGES && meta.last_scraped_page < GATE_PAGES) {
            send('gate', {
              pages_validated: GATE_PAGES,
              movies_scraped: meta.movies_scraped,
              remaining_pages: endPage - GATE_PAGES,
              remaining_time_min: Math.round((endPage - GATE_PAGES) * DELAY_MS / 60000),
            });
            sendLog(`✓ Gate passed — ${GATE_PAGES} pages validated. Continuing...`);
          }

          // Rate-limit delay
          await sleep(DELAY_MS);

          const pageData = await fetchPage(page, PAGE_LIMIT, token);
          if (!pageData) {
            throw new Error(`Failed to fetch page ${page} — stopping`);
          }

          await upsertMovies(pageData.movies, now);
          meta.movies_scraped += pageData.movies.length;
          meta.pages_scraped += 1;
          meta.last_scraped_page = page;
          await saveMeta(meta);

          send('page', {
            page,
            count: pageData.movies.length,
            total_scraped: meta.movies_scraped,
            progress_pct: Math.round(((page + 1) / endPage) * 100),
          });

          // Check if client disconnected
          if (controller.desiredSize === null) {
            sendLog('Client disconnected — pausing sync.');
            meta.status = 'paused';
            await saveMeta(meta);
            controller.close();
            return;
          }
        }

        // ── Complete ──
        meta.status = 'complete';
        meta.completed_at = new Date().toISOString();
        meta.auth_token = ''; // Clear token
        await saveMeta(meta);

        send('complete', {
          total_movies: meta.movies_scraped,
          total_pages: meta.pages_scraped,
          duration_sec: Math.round((Date.now() - new Date(meta.started_at!).getTime()) / 1000),
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        send('error', { message });

        // Update meta with error state
        try {
          const meta = await loadMeta();
          if (meta) {
            meta.status = 'error';
            meta.error_message = message;
            await saveMeta(meta);
          }
        } catch {
          // Best effort
        }
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}

// ─── Helpers ───────────────────────────────────────────────

interface PageData {
  pagination: { limit: number; page: number; total: number };
  movies: CinePointRawMovie[];
}

interface CinePointRawMovie {
  id: number;
  title: string;
  image_title: string | null;
  movie_genre: string[];
  duration: number;
  release_date: string;
  type: 'local' | 'international';
}

async function fetchPage(page: number, limit: number, token: string): Promise<PageData | null> {
  try {
    const url = `https://cinepoint.com/bff/v1/movies/directory?limit=${limit}&page=${page}`;
    const res = await fetch(url, {
      headers: {
        'accept': 'application/json',
        'authorization': `Bearer ${token}`,
        'content-type': 'application/json',
        'x-app-request': 'true',
        'referer': 'https://cinepoint.com/',
      },
    });

    if (!res.ok) {
      console.error(`[CinePoint Sync] Page ${page} returned ${res.status}`);
      return null;
    }

    const json = await res.json();
    const list = json.response_output?.list;
    if (!list) return null;

    return {
      pagination: list.pagination,
      movies: list.content || [],
    };
  } catch (err) {
    console.error(`[CinePoint Sync] Page ${page} error:`, err);
    return null;
  }
}

function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^\w\s]/g, '') // strip punctuation
    .replace(/\s+/g, ' ')
    .trim();
}

async function upsertMovies(movies: CinePointRawMovie[], scrapedAt: string): Promise<void> {
  const now = scrapedAt;
  await Promise.all(
    movies.map(async (m) => {
      const doc: Record<string, unknown> = {
        id: m.id,
        title: m.title,
        title_cp: normalizeTitle(m.title),
        image_title: m.image_title ?? null,
        movie_genre: m.movie_genre,
        duration: m.duration,
        release_date: m.release_date,
        type: m.type,
        scraped_at: now,
      };
      // Preserve existing match data on re-scrape
      const existing = await firestoreRestClient.getDocument<Record<string, unknown>>(CINEPOINT_CATALOG, String(m.id)).catch(() => null);
      if (existing?.matched_movie_id) {
        doc.matched_movie_id = existing.matched_movie_id;
        doc.matched_title = existing.matched_title;
      } else {
        doc.matched_movie_id = null;
        doc.matched_title = null;
      }
      const updated = await firestoreRestClient.updateDocument(CINEPOINT_CATALOG, String(m.id), doc);
      if (!updated) {
        await firestoreRestClient.createDocument(CINEPOINT_CATALOG, String(m.id), doc);
      }
    })
  );
}

async function loadMeta(): Promise<CinePointSyncMeta | null> {
  try {
    return await firestoreRestClient.getDocument<CinePointSyncMeta>(CINEPOINT_SYNC_META, 'current');
  } catch {
    return null;
  }
}

async function saveMeta(meta: CinePointSyncMeta): Promise<void> {
  const data = meta as unknown as Record<string, unknown>;
  // Try update first (doc exists after first save), fall back to create
  const updated = await firestoreRestClient.updateDocument(CINEPOINT_SYNC_META, 'current', data);
  if (!updated) {
    await firestoreRestClient.createDocument(CINEPOINT_SYNC_META, 'current', data);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
