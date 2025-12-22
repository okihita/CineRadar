/**
 * Insights/Reports Scraper
 * 
 * Fetches industry articles and reports from Cinepoint.
 * Run: npm run scrape:insights
 */

import { getClient } from '../api/client.js';
import { getStorage } from '../storage/bigquery.js';
import type { InsightArticle } from '../models/types.js';

async function scrapeInsights(): Promise<void> {
    const client = getClient();
    const storage = getStorage();

    console.log('=== Cinepoint Insights Scraper ===\n');

    // Get existing insight IDs to avoid re-scraping
    const existingIds = await storage.getInsightIds();
    console.log(`Found ${existingIds.length} existing insights\n`);

    const articles: InsightArticle[] = [];
    let page = 0;
    const limit = 20;
    let hasMore = true;
    let newCount = 0;

    while (hasMore) {
        try {
            console.log(`Fetching page ${page}...`);
            const response = await client.getInsights(page, limit);
            const items = response.data?.items || [];

            if (items.length === 0) {
                hasMore = false;
                break;
            }

            for (const item of items) {
                const id = String(item.id || item.slug);

                // Skip if already scraped
                if (existingIds.includes(id)) {
                    console.log(`  Skipping ${id} (already exists)`);
                    continue;
                }

                // Fetch full article detail
                try {
                    const detailResponse = await client.getInsightDetail(item.slug);
                    const detail = detailResponse.data;

                    const article: InsightArticle = {
                        id,
                        title: detail.title || item.title,
                        slug: item.slug,
                        excerpt: item.excerpt || '',
                        content: detail.content || '',
                        publishedAt: detail.published_at || item.published_at,
                        category: detail.category || 'general',
                        imageUrl: detail.image || item.image,
                        scrapedAt: new Date().toISOString()
                    };

                    await storage.upsertInsight(article);
                    articles.push(article);
                    newCount++;
                    console.log(`  ✓ ${article.title}`);

                } catch (detailError) {
                    console.error(`  Error fetching detail for ${item.slug}:`, detailError);
                }
            }

            const total = response.data?.total || 0;
            hasMore = (page + 1) * limit < total;
            page++;

        } catch (error) {
            console.error(`Error fetching insights page ${page}:`, error);
            break;
        }
    }

    // Log sync
    await storage.logSync('insights', {
        newArticles: newCount,
        totalExisting: existingIds.length,
        status: 'success'
    });

    console.log(`\n✓ Insights scrape complete! New articles: ${newCount}`);
}

// Run if executed directly
scrapeInsights().catch(console.error);

export { scrapeInsights };
