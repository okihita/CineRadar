/**
 * POST /api/competitors/scrape-tweet — fetch a single tweet by URL and import it
 *
 * Body: { url: "https://x.com/cinepoint_/status/1234567890" }
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth-helpers';
import { scrapeAndImportTweet } from '@/features/competitors/lib/scrape-tweet';

export async function POST(req: NextRequest) {
  const authError = await requireAdmin();
  if (authError) return authError;

  try {
    const body = await req.json();
    const url: string = body.url;

    if (!url || typeof url !== 'string') {
      return NextResponse.json({ success: false, error: 'Missing or invalid url' }, { status: 400 });
    }

    const result = await scrapeAndImportTweet(url);

    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 });
    }

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error('[Scrape Tweet Error]', error);
    return NextResponse.json({ success: false, error: 'Failed to scrape tweet' }, { status: 500 });
  }
}
