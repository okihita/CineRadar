/**
 * Daily Showtime Ranking Scraper
 * 
 * Fetches daily showtime market share rankings.
 * Run: npm run scrape:showtimes
 */

import { getClient } from '../api/client.js';
import { getStorage } from '../storage/bigquery.js';
import type { ShowtimeRanking, DailyShowtimeItem } from '../models/types.js';

function formatDate(date: Date): string {
    return date.toISOString().split('T')[0];
}

function transformShowtime(item: DailyShowtimeItem, date: string): ShowtimeRanking {
    return {
        movieId: item.id,
        movieTitle: item.title,
        date,
        rank: item.rank,
        showtimeCount: item.showtime_count,
        showtimeChange: item.showtime_delta,
        marketSharePercent: item.showtime_pct,
        scrapedAt: new Date().toISOString()
    };
}

async function scrapeShowtimesForDate(date: string): Promise<ShowtimeRanking[]> {
    const client = getClient();
    const rankings: ShowtimeRanking[] = [];

    let page = 0;
    const limit = 50;
    let hasMore = true;

    while (hasMore) {
        try {
            const response = await client.getDailyShowtime(date, page, limit);
            const items = (response.data?.items || []) as DailyShowtimeItem[];

            if (items.length === 0) {
                hasMore = false;
                break;
            }

            for (const item of items) {
                rankings.push(transformShowtime(item, date));
            }

            const total = response.data?.total || 0;
            hasMore = (page + 1) * limit < total;
            page++;

        } catch (error) {
            console.error(`Error fetching showtimes for ${date} page ${page}:`, error);
            break;
        }
    }

    return rankings;
}

async function scrapeShowtimes(options: {
    startDate?: string;
    endDate?: string;
    daysBack?: number;
} = {}): Promise<void> {
    const storage = getStorage();

    console.log('=== Cinepoint Daily Showtime Scraper ===\n');

    // Determine date range
    const endDate = options.endDate
        ? new Date(options.endDate)
        : new Date();

    let startDate: Date;
    if (options.startDate) {
        startDate = new Date(options.startDate);
    } else if (options.daysBack) {
        startDate = new Date(endDate);
        startDate.setDate(startDate.getDate() - options.daysBack);
    } else {
        // Default: scrape just today
        startDate = endDate;
    }

    console.log(`Date range: ${formatDate(startDate)} to ${formatDate(endDate)}`);

    let totalRankings = 0;
    const current = new Date(startDate);

    while (current <= endDate) {
        const dateStr = formatDate(current);
        console.log(`\nScraping ${dateStr}...`);

        const rankings = await scrapeShowtimesForDate(dateStr);

        if (rankings.length > 0) {
            await storage.insertShowtimeRankings(rankings);
            totalRankings += rankings.length;
            console.log(`  Got ${rankings.length} movies`);
        } else {
            console.log(`  No data for this date`);
        }

        current.setDate(current.getDate() + 1);
    }

    // Log sync
    await storage.logSync('showtimes', {
        startDate: formatDate(startDate),
        endDate: formatDate(endDate),
        rankingsScraped: totalRankings,
        status: 'success'
    });

    console.log(`\n✓ Showtime scrape complete! Total rankings: ${totalRankings}`);
}

// Run if executed directly
const args = process.argv.slice(2);
const daysBack = args[0] ? parseInt(args[0]) : 1;
scrapeShowtimes({ daysBack }).catch(console.error);

export { scrapeShowtimes, scrapeShowtimesForDate };
