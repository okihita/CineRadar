/**
 * POST /api/competitors/scrape-tweet/batch — fetch multiple tweets by URL
 *
 * Processes URLs sequentially to avoid rate-limiting.
 * Body: { urls: ["https://x.com/...", "https://x.com/..."] }
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth-helpers';
import { scrapeAndImportTweet, extractTweetId } from '@/features/competitors/lib/scrape-tweet';

export async function POST(req: NextRequest) {
  const authError = await requireAdmin();
  if (authError) return authError;

  try {
    const body = await req.json();
    const urls: string[] = body.urls;

    if (!Array.isArray(urls) || urls.length === 0) {
      return NextResponse.json({ success: false, error: 'Missing or empty urls array' }, { status: 400 });
    }

    if (urls.length > 20) {
      return NextResponse.json({ success: false, error: 'Maximum 20 URLs per batch' }, { status: 400 });
    }

    // Deduplicate by tweet ID
    const seen = new Set<string>();
    const uniqueUrls = urls.filter((url) => {
      const id = extractTweetId(url);
      if (!id || seen.has(id)) return false;
      seen.add(id);
      return true;
    });

    // Process sequentially to avoid rate-limiting
    const results = [];
    let successCount = 0;

    for (const url of uniqueUrls) {
      const result = await scrapeAndImportTweet(url);
      results.push(result);
      if (result.success) successCount++;
    }

    return NextResponse.json({
      success: true,
      data: {
        total: uniqueUrls.length,
        succeeded: successCount,
        failed: uniqueUrls.length - successCount,
        results,
      },
    });
  } catch (error) {
    console.error('[Scrape Tweet Batch Error]', error);
    return NextResponse.json({ success: false, error: 'Failed to scrape tweets' }, { status: 500 });
  }
}
