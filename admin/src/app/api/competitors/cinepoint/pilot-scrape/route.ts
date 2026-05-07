/**
 * POST /api/competitors/cinepoint/pilot-scrape
 *
 * SSE endpoint that scrapes the CinePoint Top Box Office Daily endpoint
 * for the last 14 days and saves the combined result to a local JSON file.
 *
 * No auth required — the CinePoint top-box-office endpoint is public.
 * Admin-only (our side).
 *
 * Query: ?days=14 (default 14, max 90)
 */

import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/auth-helpers';
import * as fs from 'fs';
import * as path from 'path';

export const dynamic = 'force-dynamic';

const DELAY_MS = 3000;
const MAX_DAYS = 90;
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
  rank: {
    current_rank: number;
    last_rank?: number;
  };
}

interface DayData {
  date: string;
  movies: BoxOfficeMovie[];
  scraped_at: string;
}

export async function POST(req: NextRequest) {
  const authError = await requireAdmin();
  if (authError) return authError;

  const days = Math.min(
    Math.max(parseInt(req.nextUrl.searchParams.get('days') ?? '14'), 1),
    MAX_DAYS,
  );

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: Record<string, unknown>) => {
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
        );
      };

      const sendLog = (message: string) => {
        send('log', { message, ts: new Date().toISOString() });
      };

      try {
        // Ensure data directory exists
        const dataDir = path.dirname(DATA_FILE);
        if (!fs.existsSync(dataDir)) {
          fs.mkdirSync(dataDir, { recursive: true });
        }

        const today = new Date();
        const results: DayData[] = [];

        sendLog(`Starting pilot scrape: ${days} days back from ${today.toISOString().slice(0, 10)}`);

        for (let i = days - 1; i >= 0; i--) {
          const d = new Date(today);
          d.setDate(d.getDate() - i);
          const dateStr = d.toISOString().slice(0, 10);

          const url = `https://cinepoint.com/bff/v1/movies/top-box-office/daily/detail?date_start=${dateStr}&date_end=${dateStr}&type=all&limit=100&order=desc&sort=admission`;

          let retries = 0;
          let movies: BoxOfficeMovie[] = [];

          while (retries < 3) {
            try {
              const res = await fetch(url, {
                headers: {
                  accept: 'application/json',
                  'content-type': 'application/json',
                  'x-app-request': 'true',
                  referer: 'https://cinepoint.com/',
                },
              });

              if (res.status === 429) {
                sendLog(`Rate limited on ${dateStr}, waiting 10s...`);
                await sleep(10000);
                retries++;
                continue;
              }

              if (!res.ok) {
                throw new Error(`HTTP ${res.status} for ${dateStr}`);
              }

              const json = await res.json();
              movies = json.response_output?.list?.content || [];
              break;
            } catch (err) {
              retries++;
              const msg = err instanceof Error ? err.message : 'Unknown error';
              sendLog(`Error on ${dateStr}: ${msg} (retry ${retries}/3)`);
              if (retries < 3) await sleep(5000);
            }
          }

          const dayData: DayData = {
            date: dateStr,
            movies,
            scraped_at: new Date().toISOString(),
          };
          results.push(dayData);

          send('day', {
            date: dateStr,
            movies: movies.length,
            total_admissions: movies.reduce((s, m) => s + m.admission, 0),
            progress_pct: Math.round(((days - i) / days) * 100),
          });

          // Rate-limit delay (skip on last day)
          if (i > 0) {
            await sleep(DELAY_MS);
          }

          // Check if client disconnected
          if (controller.desiredSize === null) {
            sendLog('Client disconnected — stopping.');
            break;
          }
        }

        // Save to local file
        const payload = {
          scraped_at: new Date().toISOString(),
          days_scraped: results.length,
          date_range: {
            start: results[0]?.date,
            end: results[results.length - 1]?.date,
          },
          days: results,
        };

        fs.writeFileSync(DATA_FILE, JSON.stringify(payload, null, 2), 'utf-8');

        send('complete', {
          days_scraped: results.length,
          total_movie_records: results.reduce((s, d) => s + d.movies.length, 0),
          unique_movies: new Set(results.flatMap((d) => d.movies.map((m) => m.id))).size,
          file: DATA_FILE,
        });

        sendLog(`✓ Saved ${results.length} days to ${DATA_FILE}`);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        send('error', { message });
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

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
