/**
 * Historical Backfill Script
 * 
 * One-time script to backfill all historical data from Cinepoint.
 * Run: npm run backfill
 * 
 * Usage: 
 *   npx tsx scripts/backfill-historical.ts           # Full backfill (365 days)
 *   npx tsx scripts/backfill-historical.ts 30        # Last 30 days only
 *   npx tsx scripts/backfill-historical.ts movies    # Movies only
 */

import { scrapeMovieDirectory } from '../src/scrapers/movies.js';
import { scrapeShowtimes } from '../src/scrapers/showtimes.js';
import { scrapeBoxOffice } from '../src/scrapers/boxOffice.js';
import { scrapeInsights } from '../src/scrapers/insights.js';
import { getStorage } from '../src/storage/bigquery.js';

async function backfillHistorical(options: {
    daysBack?: number;
    onlyType?: 'movies' | 'showtimes' | 'boxoffice' | 'insights';
} = {}): Promise<void> {
    const storage = getStorage();
    const daysBack = options.daysBack || 365;

    console.log('╔════════════════════════════════════════════╗');
    console.log('║   CINEPOINT HISTORICAL BACKFILL            ║');
    console.log('╠════════════════════════════════════════════╣');
    console.log(`║   Days to backfill: ${daysBack.toString().padEnd(22)}║`);
    if (options.onlyType) {
        console.log(`║   Type filter: ${options.onlyType.padEnd(27)}║`);
    }
    console.log('╚════════════════════════════════════════════╝\n');

    const startTime = Date.now();
    const results: Record<string, string> = {};

    try {
        // 1. Movies (no date range needed)
        if (!options.onlyType || options.onlyType === 'movies') {
            console.log('\n📽️  PHASE 1: Movie Directory\n');
            await scrapeMovieDirectory();
            results.movies = '✓ Complete';
        }

        // 2. Showtimes (historical)
        if (!options.onlyType || options.onlyType === 'showtimes') {
            console.log('\n📊 PHASE 2: Daily Showtime Rankings\n');
            await scrapeShowtimes({ daysBack });
            results.showtimes = '✓ Complete';
        }

        // 3. Box Office (historical)
        if (!options.onlyType || options.onlyType === 'boxoffice') {
            console.log('\n🎬 PHASE 3: Box Office Rankings\n');
            await scrapeBoxOffice({ daysBack, period: 'daily' });
            results.boxoffice = '✓ Complete';
        }

        // 4. Insights
        if (!options.onlyType || options.onlyType === 'insights') {
            console.log('\n📰 PHASE 4: Industry Insights\n');
            await scrapeInsights();
            results.insights = '✓ Complete';
        }

    } catch (error) {
        console.error('\n❌ Backfill error:', error);
        results.error = String(error);
    }

    const duration = Math.round((Date.now() - startTime) / 1000 / 60);

    // Log final sync
    await storage.logSync('backfill', {
        daysBack,
        onlyType: options.onlyType || 'all',
        durationMinutes: duration,
        results
    });

    console.log('\n╔════════════════════════════════════════════╗');
    console.log('║   BACKFILL COMPLETE                        ║');
    console.log('╠════════════════════════════════════════════╣');
    console.log(`║   Duration: ${duration} minutes`.padEnd(44) + '║');
    for (const [key, value] of Object.entries(results)) {
        console.log(`║   ${key}: ${value}`.padEnd(44) + '║');
    }
    console.log('╚════════════════════════════════════════════╝');
}

// Parse CLI arguments
const args = process.argv.slice(2);
let daysBack: number | undefined;
let onlyType: 'movies' | 'showtimes' | 'boxoffice' | 'insights' | undefined;

for (const arg of args) {
    if (!isNaN(Number(arg))) {
        daysBack = Number(arg);
    } else if (['movies', 'showtimes', 'boxoffice', 'insights'].includes(arg)) {
        onlyType = arg as typeof onlyType;
    }
}

backfillHistorical({ daysBack, onlyType }).catch(console.error);

export { backfillHistorical };
