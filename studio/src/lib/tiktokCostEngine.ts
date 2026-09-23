/**
 * Transparent Unit Economics & Cost Simulator for TikTok Crawling.
 *
 * Apify Clockworks pricing:
 * - TikTok Post Scraper: $3.00 per 1,000 items ($0.003 / post)
 * - TikTok Comments Scraper: $3.00 per 1,000 items ($0.003 / comment)
 *
 * Gemini 3.8 Flash pricing:
 * - Input: $0.75 per 1M tokens ($0.00000075 / token)
 * - Output: $3.75 per 1M tokens ($0.00000375 / token)
 * - Typical sentiment batch (30 comments): ~2,000 input tokens, ~150 output tokens
 *   = (2000 * 0.00000075) + (150 * 0.00000375) = $0.0015 + $0.00056 = $0.00206 per movie/tag
 *
 * Base Exchange Rate: Rp 17.500 / USD
 */

export const USD_TO_IDR = 17500;
export const APIFY_STARTER_MONTHLY_CREDITS_USD = 29.0;

export interface HashtagCostConfig {
    postsPerCrawl: number;
    includeComments: boolean;
    commentsPerCrawl?: number;
    crawlsPerDay?: number;
}

export interface UnitCostBreakdown {
    apifyPostsUsd: number;
    apifyCommentsUsd: number;
    apifyTotalUsd: number;
    geminiSentimentUsd: number;
    totalPerCrawlUsd: number;
    dailyCostUsd: number;
    monthlyCostUsd: number;
    dailyCostIdr: number;
    monthlyCostIdr: number;
    estimatedItemsPerCrawl: number;
}

export function computeHashtagUnitCost(config: HashtagCostConfig): UnitCostBreakdown {
    const posts = Math.max(0, config.postsPerCrawl || 40);
    const comments = config.includeComments ? (config.commentsPerCrawl ?? 30) : 0;
    const frequency = Math.max(1, config.crawlsPerDay ?? 1);

    // Apify charges $3.00 per 1,000 dataset items
    const apifyPostsUsd = (posts / 1000) * 3.0;
    const apifyCommentsUsd = (comments / 1000) * 3.0;
    const apifyTotalUsd = apifyPostsUsd + apifyCommentsUsd;

    // Gemini 3.8 Flash for sentiment classification
    const geminiInputTokens = config.includeComments ? Math.round(500 + comments * 50) : 0;
    const geminiOutputTokens = config.includeComments ? 150 : 0;
    const geminiSentimentUsd =
        (geminiInputTokens / 1_000_000) * 0.75 + (geminiOutputTokens / 1_000_000) * 3.75;

    const totalPerCrawlUsd = apifyTotalUsd + geminiSentimentUsd;
    const dailyCostUsd = totalPerCrawlUsd * frequency;
    const monthlyCostUsd = dailyCostUsd * 30;

    return {
        apifyPostsUsd,
        apifyCommentsUsd,
        apifyTotalUsd,
        geminiSentimentUsd,
        totalPerCrawlUsd,
        dailyCostUsd,
        monthlyCostUsd,
        dailyCostIdr: Math.round(dailyCostUsd * USD_TO_IDR),
        monthlyCostIdr: Math.round(monthlyCostUsd * USD_TO_IDR),
        estimatedItemsPerCrawl: posts + comments,
    };
}

export interface AggregateCostForecast {
    totalTags: number;
    activeTags: number;
    dailyCostUsd: number;
    monthlyCostUsd: number;
    dailyCostIdr: number;
    monthlyCostIdr: number;
    dailyItemsScraped: number;
    monthlyItemsScraped: number;
    percentOfStarterCredits: number;
    creditsStatus: 'safe' | 'warning' | 'overage';
}

export function computeAggregateCost(
    items: Array<{ active: boolean; target_posts?: number; include_comments?: boolean; cadence?: number }>
): AggregateCostForecast {
    let dailyCostUsd = 0;
    let dailyItems = 0;
    let activeCount = 0;

    for (const item of items) {
        if (!item.active) continue;
        activeCount++;
        const cadence = Math.max(1, item.cadence ?? 1);
        const cost = computeHashtagUnitCost({
            postsPerCrawl: item.target_posts ?? 40,
            includeComments: item.include_comments ?? true,
            crawlsPerDay: cadence,
        });
        dailyCostUsd += cost.dailyCostUsd;
        dailyItems += cost.estimatedItemsPerCrawl * cadence;
    }

    const monthlyCostUsd = dailyCostUsd * 30;
    const dailyCostIdr = Math.round(dailyCostUsd * USD_TO_IDR);
    const monthlyCostIdr = Math.round(monthlyCostUsd * USD_TO_IDR);
    const percentOfStarterCredits =
        APIFY_STARTER_MONTHLY_CREDITS_USD > 0
            ? Math.round((monthlyCostUsd / APIFY_STARTER_MONTHLY_CREDITS_USD) * 100)
            : 0;

    let creditsStatus: 'safe' | 'warning' | 'overage' = 'safe';
    if (percentOfStarterCredits > 100) {
        creditsStatus = 'overage';
    } else if (percentOfStarterCredits > 75) {
        creditsStatus = 'warning';
    }

    return {
        totalTags: items.length,
        activeTags: activeCount,
        dailyCostUsd,
        monthlyCostUsd,
        dailyCostIdr,
        monthlyCostIdr,
        dailyItemsScraped: dailyItems,
        monthlyItemsScraped: dailyItems * 30,
        percentOfStarterCredits,
        creditsStatus,
    };
}

export function formatIdr(amount: number): string {
    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        maximumFractionDigits: 0,
    }).format(amount);
}

export function formatUsd(amount: number): string {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
        maximumFractionDigits: 3,
    }).format(amount);
}
