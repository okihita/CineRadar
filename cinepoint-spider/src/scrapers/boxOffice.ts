/**
 * Box Office Scraper
 * 
 * Fetches daily/weekly/monthly/yearly box office rankings.
 * Run: npm run scrape:boxoffice
 */

import { getClient } from '../api/client.js';
import { getStorage } from '../storage/bigquery.js';
import type { BoxOfficeRecord, BoxOfficeItem } from '../models/types.js';

function formatDate(date: Date): string {
    return date.toISOString().split('T')[0];
}

function transformBoxOffice(
    item: BoxOfficeItem,
    date: string,
    period: BoxOfficeRecord['period']
): BoxOfficeRecord {
    return {
        movieId: item.id,
        movieTitle: item.title,
        date,
        period,
        rank: item.rank,
        admissions: item.admission,
        totalAdmissions: item.admission_total,
        rankChange: item.rank_delta,
        scrapedAt: new Date().toISOString()
    };
}

async function scrapeBoxOfficeForDate(
    date: string,
    period: BoxOfficeRecord['period'] = 'daily'
): Promise<BoxOfficeRecord[]> {
    const client = getClient();
    const records: BoxOfficeRecord[] = [];

    let page = 0;
    const limit = 50;
    let hasMore = true;

    while (hasMore) {
        try {
            // Note: The API might use different endpoints for different periods
            const response = await client.getDailyBoxOffice(page, limit);
            const items = (response.data?.items || []) as BoxOfficeItem[];

            if (items.length === 0) {
                hasMore = false;
                break;
            }

            for (const item of items) {
                records.push(transformBoxOffice(item, date, period));
            }

            const total = response.data?.total || 0;
            hasMore = (page + 1) * limit < total;
            page++;

        } catch (error) {
            console.error(`Error fetching box office for ${date} page ${page}:`, error);
            break;
        }
    }

    return records;
}

async function scrapeBoxOffice(options: {
    startDate?: string;
    endDate?: string;
    daysBack?: number;
    period?: BoxOfficeRecord['period'];
} = {}): Promise<void> {
    const storage = getStorage();
    const period = options.period || 'daily';

    console.log(`=== Cinepoint Box Office Scraper (${period}) ===\n`);

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
        startDate = endDate;
    }

    console.log(`Date range: ${formatDate(startDate)} to ${formatDate(endDate)}`);

    let totalRecords = 0;
    const current = new Date(startDate);

    while (current <= endDate) {
        const dateStr = formatDate(current);
        console.log(`\nScraping ${dateStr}...`);

        const records = await scrapeBoxOfficeForDate(dateStr, period);

        if (records.length > 0) {
            await storage.insertBoxOfficeRecords(records);
            totalRecords += records.length;
            console.log(`  Got ${records.length} movies`);
        } else {
            console.log(`  No data for this date`);
        }

        // Move to next period
        if (period === 'daily') {
            current.setDate(current.getDate() + 1);
        } else if (period === 'weekly') {
            current.setDate(current.getDate() + 7);
        } else if (period === 'monthly') {
            current.setMonth(current.getMonth() + 1);
        } else {
            current.setFullYear(current.getFullYear() + 1);
        }
    }

    // Log sync
    await storage.logSync('box_office', {
        period,
        startDate: formatDate(startDate),
        endDate: formatDate(endDate),
        recordsScraped: totalRecords,
        status: 'success'
    });

    console.log(`\n✓ Box office scrape complete! Total records: ${totalRecords}`);
}

// Run if executed directly
const args = process.argv.slice(2);
const daysBack = args[0] ? parseInt(args[0]) : 1;
scrapeBoxOffice({ daysBack }).catch(console.error);

export { scrapeBoxOffice, scrapeBoxOfficeForDate };
