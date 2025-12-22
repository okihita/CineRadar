/**
 * Daily Sync Script
 * 
 * Incremental sync for daily updates.
 * Run: npm run sync
 * 
 * This script is designed to be run by GitHub Actions on a schedule.
 */

import { scrapeMovieDirectory } from '../src/scrapers/movies.js';
import { scrapeShowtimes } from '../src/scrapers/showtimes.js';
import { scrapeBoxOffice } from '../src/scrapers/boxOffice.js';
import { scrapeInsights } from '../src/scrapers/insights.js';
import { getStorage } from '../src/storage/bigquery.js';

async function dailySync(): Promise<void> {
    const storage = getStorage();

    console.log('╔════════════════════════════════════════════╗');
    console.log('║   CINEPOINT DAILY SYNC                     ║');
    console.log('║   ' + new Date().toISOString().padEnd(40) + '║');
    console.log('╚════════════════════════════════════════════╝\n');

    const startTime = Date.now();
    const results: Record<string, string> = {};

    try {
        // 1. Update movie directory (catches new releases)
        console.log('\n📽️  Syncing movie directory...');
        await scrapeMovieDirectory();
        results.movies = '✓';

        // 2. Yesterday's showtimes (in case of late data)
        console.log('\n📊 Syncing showtime rankings (last 2 days)...');
        await scrapeShowtimes({ daysBack: 2 });
        results.showtimes = '✓';

        // 3. Yesterday's box office
        console.log('\n🎬 Syncing box office (last 2 days)...');
        await scrapeBoxOffice({ daysBack: 2, period: 'daily' });
        results.boxoffice = '✓';

        // 4. Check for new insights
        console.log('\n📰 Checking for new insights...');
        await scrapeInsights();
        results.insights = '✓';

    } catch (error) {
        console.error('\n❌ Sync error:', error);
        results.error = String(error);
        process.exitCode = 1;
    }

    const duration = Math.round((Date.now() - startTime) / 1000);

    // Log sync
    await storage.logSync('daily', {
        durationSeconds: duration,
        results
    });

    console.log('\n╔════════════════════════════════════════════╗');
    console.log('║   DAILY SYNC COMPLETE                      ║');
    console.log(`║   Duration: ${duration}s`.padEnd(44) + '║');
    console.log('╚════════════════════════════════════════════╝');
}

dailySync().catch(error => {
    console.error('Fatal sync error:', error);
    process.exit(1);
});

export { dailySync };
